package simulation

import (
	"context"
	"devsforge-coordinator/internal/config"
	"fmt"
	"log/slog"
	"time"

	kafkaShared "devsforge-shared/kafka"

	kafka "github.com/segmentio/kafka-go"
	"github.com/twmb/franz-go/pkg/kgo"
)

func CreateTopic(brokerAddress, topic string, partitions int, replicationFactor int) error {
	dialer := &kafka.Dialer{
		Timeout:  10 * time.Second,
		ClientID: "simulator",
	}

	// Connexion au broker (assume qu'il est aussi controller en single-node)
	conn, err := dialer.DialContext(context.Background(), "tcp", brokerAddress)
	if err != nil {
		return fmt.Errorf("failed to dial Kafka broker %s: %w", brokerAddress, err)
	}
	defer func() {
		if err = conn.Close(); err != nil {
			slog.Debug("Cannot close connection", "error", err)
		}
	}()

	topicConfig := kafka.TopicConfig{
		Topic:             topic,
		NumPartitions:     partitions,
		ReplicationFactor: replicationFactor,
	}

	if err := conn.CreateTopics(topicConfig); err != nil {
		return fmt.Errorf("failed to create topic %q: %w", topic, err)
	}

	return nil
}

// DeleteTopic delete a Kafka topic.
// Exemple: err := DeleteTopic("localhost:9092", "my-topic")
func DeleteTopic(broker, topic string) error {
	conn, err := kafka.Dial("tcp", broker)
	if err != nil {
		return fmt.Errorf("failed to dial broker: %w", err)
	}
	defer func() {
		if err = conn.Close(); err != nil {
			slog.Debug("Cannot close connection", "error", err)
		}
	}()

	controller, err := conn.Controller()
	if err != nil {
		return fmt.Errorf("failed to get controller: %w", err)
	}

	controllerAddr := fmt.Sprintf("%s:%d", controller.Host, controller.Port)
	ctrlConn, err := kafka.Dial("tcp", controllerAddr)
	if err != nil {
		return fmt.Errorf("failed to dial controller: %w", err)
	}
	defer func() {
		if err = ctrlConn.Close(); err != nil {
			slog.Debug("Cannot close controller connection", "error", err)
		}
	}()

	err = ctrlConn.DeleteTopics(topic)
	if err != nil {
		return fmt.Errorf("failed to delete topic %s: %w", topic, err)
	}

	return nil
}

func GetKafkaTopic(kafkaConnStr string, providedTopic string) (string, error) {
	kafkaTopic := providedTopic

	// If no topic provided, generate one
	if kafkaTopic == "" {
		var err error
		kafkaTopic, err = RandomStringWithPrefix("sim", 8)
		if err != nil {
			return "", err
		}
	}

	// Testing purpose only - env var overrides
	envTopic := config.Get().Kafka.Topic
	if envTopic != "" {
		kafkaTopic = envTopic
	}

	if kafkaConnStr != "" {
		err := CreateTopic(kafkaConnStr, kafkaTopic, 1, 1)
		if err != nil {
			return "", err
		}
	}

	return kafkaTopic, nil
}

func (c *Coordinator) SendMessage(msg kafkaShared.KafkaMessageI) error {
	data, err := msg.Marshal()
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	return c.Config.KafkaClient.ProduceSync(c.Context, &kgo.Record{Value: data}).FirstErr()
}

func (c *Coordinator) StartReceiveLoop(handler func(*kafkaShared.BaseKafkaMessage) error) error {
	client := c.Config.KafkaClient
	if c.Logger == nil {
		slog.Debug("Logger is nil in StartReceiveLoop")
	}
	for {
		fetches := client.PollFetches(c.Context)
		if errs := fetches.Errors(); len(errs) > 0 {
			return fmt.Errorf("kafka poll error: %v", errs)
		}

		iter := fetches.RecordIter()
		for !iter.Done() {
			record := iter.Next()
			msg, err := kafkaShared.UnmarshalKafkaMessage(record.Value)
			if err != nil {
				return fmt.Errorf("cannot unmarshall kafka message : %w", err)
			}

			if c.Logger != nil {
				c.Logger.Info("kafka_message",
					"sender", msg.Sender,
					"devsType", msg.DevsType.String(),
					"data", normalizeMessageData(msg),
				)
			}

			err = handler(msg)
			if err != nil {
				return err
			}
		}
	}
}

func normalizeMessageData(msg *kafkaShared.BaseKafkaMessage) map[string]interface{} {
	data := make(map[string]interface{})

	if msg.DevsType != "" {
		data["devsType"] = msg.DevsType.String()
	}
	if msg.MessageType != "" {
		data["messageType"] = msg.MessageType.String()
	}
	if msg.SimulationRunID != "" {
		data["simulationRunId"] = msg.SimulationRunID
	}
	if msg.MessageID != "" {
		data["messageId"] = msg.MessageID
	}
	if msg.SenderID != "" {
		data["senderId"] = msg.SenderID
	}
	if msg.ReceiverID != "" {
		data["receiverId"] = msg.ReceiverID
	}
	if msg.Time != nil {
		data["time"] = msg.Time
	}
	if msg.EventTime != nil {
		data["eventTime"] = msg.EventTime
	}
	if msg.NextTime != nil {
		data["nextTime"] = msg.NextTime
	}
	if msg.Sender != "" {
		data["sender"] = msg.Sender
	}
	if msg.Target != "" {
		data["target"] = msg.Target
	}
	if msg.ModelInputsOption != nil {
		data["modelInputsOption"] = msg.ModelInputsOption
	}
	if msg.ModelOutput != nil {
		data["modelOutput"] = msg.ModelOutput
	}
	if msg.Payload != nil {
		data["payload"] = msg.Payload
	}

	return data
}
