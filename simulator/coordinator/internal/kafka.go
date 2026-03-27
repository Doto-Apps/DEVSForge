package internal

import (
	"context"
	"fmt"
	"log"
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
			log.Println("cannot close conn: ", err)
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
			log.Println("cannot close conn: ", err)
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
			log.Println("cannot close ctrlConn: ", err)
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

	return c.Config.KafkaClient.ProduceSync(c.Context, &kgo.Record{Value: data}).FirstErr()
}

func (c *Coordinator) StartReceiveLoop(handler func(*kafkaShared.BaseKafkaMessage) error) error {
	client := c.Config.KafkaClient
	for {
		fetches := client.PollFetches(c.Context)
		if errs := fetches.Errors(); len(errs) > 0 {
			// All errors are retried internally when fetching, but non-retriable errors are
			// returned from polls so that users can notice and take action.
			return fmt.Errorf("kafka poll error: %v", errs)
		}

		// We can iterate through a record iterator...
		iter := fetches.RecordIter()
		for !iter.Done() {
			record := iter.Next()
			msg, err := kafkaShared.UnmarshalKafkaMessage(record.Value)
			if err != nil {
				return fmt.Errorf("cannot unmarshall kafka message : %w", err)
			}

			err = handler(msg)
			if err != nil {
				return err
			}
		}
	}
}
