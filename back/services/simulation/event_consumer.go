// Package simulation provides simulation management and execution services.
package simulation

import (
	"context"
	"devsforge/config"
	"devsforge/database"
	"devsforge/model"
	"encoding/json"
	"errors"
	"gorm.io/datatypes"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
)

// getModelRecursice retrieves models recursively
func getModelRecursice(id string, userId string) (models []model.Model, err error) {
	db := database.DB

	modelIds := make([]string, 0)
	modelIds = append(modelIds, id)
	models = make([]model.Model, 0)

	for len(modelIds) > 0 {
		var model model.Model

		flag := false

		for _, v := range models {
			if v.ID == modelIds[0] {
				flag = true
			}
		}
		if !flag {
			db.Find(&model, "user_id = ? AND id = ?", userId, modelIds[0])
			if model.Name == "" {
				return nil, errors.New("MODEL_NOT_FOUND")
			} else {
				models = append(models, model)
				for _, v := range model.Components {
					modelIds = append(modelIds, v.ModelID)
				}
			}
		}
		modelIds = modelIds[1:]
	}

	return models, nil
}

// generateTopicName generates a Kafka topic name for a simulation
func generateTopicName(simulationID string) string {
	// Use first 8 chars of simulation ID for shorter topic name
	shortID := simulationID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return "sim-" + strings.ReplaceAll(shortID, "-", "")
}

// eventConsumers is the global event consumer manager
var eventConsumers = &EventConsumerManager{
	consumers: make(map[string]*EventConsumer),
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
			simulationFailed := false
			failureMessage := ""
			fetches.EachRecord(func(record *kgo.Record) {
				event, done, failed, errorMessage := parseMessage(record.Value, ec.simulationID)
				if event != nil {
					events = append(events, *event)
				}
				if done {
					simulationDone = true
				}
				if failed {
					simulationFailed = true
					if errorMessage != "" {
						failureMessage = errorMessage
					}
				}

				if len(events) >= batchSize {
					flushEvents()
				}
			})

			// ErrorReport with severity error/fatal wins over SimulationDone.
			if simulationFailed {
				flushEvents()
				ec.markSimulationFailed(failureMessage)
				return
			}

			// If we saw SimulationDone, flush, update status and exit
			if simulationDone {
				flushEvents()
				ec.markSimulationCompleted()
				return
			}
		}
	}
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

func (ec *EventConsumer) markSimulationFailed(message string) {
	db := database.DB
	now := time.Now()

	if strings.TrimSpace(message) == "" {
		message = "Simulation failed (ErrorReport)"
	}

	result := db.Model(&model.Simulation{}).
		Where("id = ?", ec.simulationID).
		Updates(map[string]interface{}{
			"status":        model.SimulationStatusFailed,
			"error_message": message,
			"completed_at":  now,
		})

	if result.Error != nil {
		log.Printf("[EventConsumer] Error updating failed simulation status: %v", result.Error)
	}
}

// EventConsumerManager manages event consumers for all simulations
type EventConsumerManager struct {
	consumers map[string]*EventConsumer
	mu        sync.RWMutex
}

// StartConsumer starts a new event consumer for a simulation
func (m *EventConsumerManager) StartConsumer(simulationID, topic string) error {
	kafkaAddr := config.Get().Kafka.Address

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

// KafkaMessage represents a DEVS or ISO-like message from Kafka
type KafkaMessage struct {
	DevsType      string              `json:"devsType"`
	MessageType   string              `json:"messageType"`
	SimulationRun string              `json:"simulationRunId"`
	MessageID     string              `json:"messageId"`
	SenderID      string              `json:"senderId"`
	ReceiverID    string              `json:"receiverId"`
	Time          *TimeStruct         `json:"time"`
	EventTime     *TimeStruct         `json:"eventTime"`
	Sender        *string             `json:"sender"`
	Target        *string             `json:"target"`
	Payload       *ErrorReportPayload `json:"payload"`
}

type TimeStruct struct {
	TimeType string   `json:"timeType"`
	T        *float64 `json:"t"`
}

type ErrorReportPayload struct {
	OriginRole string      `json:"originRole"`
	OriginID   string      `json:"originId"`
	Severity   string      `json:"severity"`
	ErrorCode  interface{} `json:"errorCode"`
	Message    string      `json:"message"`
}

func parseMessage(data []byte, simulationID string) (*model.SimulationEvent, bool, bool, string) {
	var msg KafkaMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("[EventConsumer] Error parsing message: %v", err)
		return nil, false, false, ""
	}

	eventType := msg.DevsType
	if eventType == "" && msg.MessageType != "" {
		eventType = "iso.msg." + msg.MessageType
	}
	if eventType == "" {
		return nil, false, false, ""
	}

	sender := msg.Sender
	if sender == nil && strings.TrimSpace(msg.SenderID) != "" {
		sender = strPtr(msg.SenderID)
	}

	target := msg.Target
	if target == nil && strings.TrimSpace(msg.ReceiverID) != "" {
		target = strPtr(msg.ReceiverID)
	}

	event := &model.SimulationEvent{
		SimulationID: simulationID,
		DevsType:     eventType,
		Sender:       sender,
		Target:       target,
		Payload:      datatypes.JSON(data),
	}

	if msg.Time != nil && msg.Time.T != nil {
		event.SimulationTime = msg.Time.T
	} else if msg.EventTime != nil && msg.EventTime.T != nil {
		event.SimulationTime = msg.EventTime.T
	}

	isDone := eventType == "devs.msg.SimulationDone"

	isFatalErrorReport := false
	errorMessage := ""
	if msg.MessageType == "ErrorReport" && msg.Payload != nil {
		severity := strings.ToLower(strings.TrimSpace(msg.Payload.Severity))
		if severity == "error" || severity == "fatal" {
			isFatalErrorReport = true
			errorMessage = strings.TrimSpace(msg.Payload.Message)
			if errorMessage == "" {
				errorMessage = "Error report received from simulator"
			}
		}
	}

	return event, isDone, isFatalErrorReport, errorMessage
}

func strPtr(v string) *string {
	return &v
}
