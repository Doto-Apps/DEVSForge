package simulation

import (
	"context"
	"fmt"
	"log/slog"
	"os"
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
	envTopic := os.Getenv("KAFKA_TOPIC")
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

	if c.Logger != nil {
		c.Logger.Info("kafka_message",
			"sender", "coordinator",
			"devsType", getDevsType(msg),
			"data", msg,
		)
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
					"data", msg,
				)
			}

			err = handler(msg)
			if err != nil {
				return err
			}
		}
	}
}

func getDevsType(msg kafkaShared.KafkaMessageI) string {
	switch m := msg.(type) {
	case *kafkaShared.BaseKafkaMessage:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageInitSim:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageNextTime:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageExecuteTransition:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageTransitionDone:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageSendOutput:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageModelOutput:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageSimulationDone:
		return m.DevsType.String()
	case *kafkaShared.KafkaMessageErrorReport:
		return m.MessageType.String()
	default:
		return "unknown"
	}
}
