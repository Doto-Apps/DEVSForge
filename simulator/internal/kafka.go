package internal

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
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
	defer conn.Close()

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
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		return fmt.Errorf("failed to get controller: %w", err)
	}
	conn.Close()

	controllerAddr := fmt.Sprintf("%s:%d", controller.Host, controller.Port)
	ctrlConn, err := kafka.Dial("tcp", controllerAddr)
	if err != nil {
		return fmt.Errorf("failed to dial controller: %w", err)
	}
	defer ctrlConn.Close()

	err = ctrlConn.DeleteTopics(topic)
	if err != nil {
		return fmt.Errorf("failed to delete topic %s: %w", topic, err)
	}

	return nil
}

func GetKafkaTopic(kafkaConnStr string) (string, error) {
	kafkaTopic, err := RandomStringWithPrefix("sim", 8)
	if err != nil {
		return "", err
	}
	// Testing purpose only
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
