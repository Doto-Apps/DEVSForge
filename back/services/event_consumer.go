package services

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"devsforge/config"
	"devsforge/database"
	"devsforge/model"

	"github.com/twmb/franz-go/pkg/kgo"
	"gorm.io/datatypes"
)

// DevsMessage represents the structure of a DEVS message from Kafka
type DevsMessage struct {
	DevsType string `json:"devsType"`
	Time     *struct {
		TimeType string   `json:"timeType"`
		T        *float64 `json:"t"`
	} `json:"time"`
	Sender *string `json:"sender"`
	Target *string `json:"target"`
}

// EventConsumer consumes Kafka messages and stores them in the database
type EventConsumer struct {
	simulationID string
	topic        string
	kafkaAddr    string
	client       *kgo.Client
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	stopped      bool
	mu           sync.Mutex
}

// NewEventConsumer creates a new EventConsumer for a simulation
func NewEventConsumer(simulationID, topic, kafkaAddr string) *EventConsumer {
	ctx, cancel := context.WithCancel(context.Background())
	return &EventConsumer{
		simulationID: simulationID,
		topic:        topic,
		kafkaAddr:    kafkaAddr,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start begins consuming messages from Kafka
func (ec *EventConsumer) Start() error {
	// Create Kafka client
	client, err := kgo.NewClient(
		kgo.SeedBrokers(ec.kafkaAddr),
		kgo.ConsumeTopics(ec.topic),
		kgo.ConsumerGroup("backend-events-"+ec.simulationID),
		kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()),
	)
	if err != nil {
		return err
	}
	ec.client = client

	ec.wg.Add(1)
	go ec.consumeLoop()

	return nil
}

// Stop stops the consumer
func (ec *EventConsumer) Stop() {
	ec.mu.Lock()
	if ec.stopped {
		ec.mu.Unlock()
		return
	}
	ec.stopped = true
	ec.mu.Unlock()

	ec.cancel()
	if ec.client != nil {
		ec.client.Close()
	}
	ec.wg.Wait()
}

func (ec *EventConsumer) consumeLoop() {
	defer ec.wg.Done()

	db := database.DB
	batchSize := 100
	events := make([]model.SimulationEvent, 0, batchSize)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	flushEvents := func() {
		if len(events) > 0 {
			if err := db.Create(&events).Error; err != nil {
				log.Printf("[EventConsumer] Error saving events: %v", err)
			}
			events = events[:0]
		}
	}

	for {
		select {
		case <-ec.ctx.Done():
			flushEvents()
			return
		case <-ticker.C:
			flushEvents()
		default:
			fetches := ec.client.PollRecords(ec.ctx, 100)
			if fetches.IsClientClosed() {
				flushEvents()
				return
			}

			simulationDone := false
			fetches.EachRecord(func(record *kgo.Record) {
				event := ec.parseMessage(record.Value)
				if event != nil {
					events = append(events, *event)

					// Check if simulation is done
					if event.DevsType == "devs.msg.SimulationDone" {
						simulationDone = true
					}
				}

				if len(events) >= batchSize {
					flushEvents()
				}
			})

			// If we saw SimulationDone, flush, update status and exit
			if simulationDone {
				flushEvents()
				ec.markSimulationCompleted()
				return
			}
		}
	}
}

func (ec *EventConsumer) parseMessage(data []byte) *model.SimulationEvent {
	var msg DevsMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[EventConsumer] Error parsing message: %v", err)
		return nil
	}

	// Skip empty messages
	if msg.DevsType == "" {
		return nil
	}

	event := &model.SimulationEvent{
		SimulationID: ec.simulationID,
		DevsType:     msg.DevsType,
		Sender:       msg.Sender,
		Target:       msg.Target,
		Payload:      datatypes.JSON(data),
	}

	if msg.Time != nil && msg.Time.T != nil {
		event.SimulationTime = msg.Time.T
	}

	return event
}

// markSimulationCompleted updates the simulation status in DB
func (ec *EventConsumer) markSimulationCompleted() {
	db := database.DB
	now := time.Now()

	// Update simulation status in database
	result := db.Model(&model.Simulation{}).
		Where("id = ?", ec.simulationID).
		Updates(map[string]interface{}{
			"status":       model.SimulationStatusCompleted,
			"completed_at": now,
		})

	if result.Error != nil {
		log.Printf("[EventConsumer] Error updating simulation status: %v", result.Error)
	}
}

// EventConsumerManager manages event consumers for all simulations
type EventConsumerManager struct {
	consumers map[string]*EventConsumer
	mu        sync.RWMutex
}

var EventConsumers = &EventConsumerManager{
	consumers: make(map[string]*EventConsumer),
}

// StartConsumer starts a new event consumer for a simulation
func (m *EventConsumerManager) StartConsumer(simulationID, topic string) error {
	kafkaAddr := config.Config("KAFKA_ADDRESS")
	if kafkaAddr == "" {
		kafkaAddr = "localhost:9092"
	}

	consumer := NewEventConsumer(simulationID, topic, kafkaAddr)
	if err := consumer.Start(); err != nil {
		return err
	}

	m.mu.Lock()
	m.consumers[simulationID] = consumer
	m.mu.Unlock()

	return nil
}

// StopConsumer stops the event consumer for a simulation
func (m *EventConsumerManager) StopConsumer(simulationID string) {
	m.mu.Lock()
	consumer, ok := m.consumers[simulationID]
	if ok {
		delete(m.consumers, simulationID)
	}
	m.mu.Unlock()

	if consumer != nil {
		consumer.Stop()
	}
}

// GenerateTopicName generates a Kafka topic name for a simulation
func GenerateTopicName(simulationID string) string {
	// Use first 8 chars of simulation ID for shorter topic name
	shortID := simulationID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return "sim-" + strings.ReplaceAll(shortID, "-", "")
}
