// Package testsutils helpers for testing
package testsutils

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	sharedKafka "devsforge-shared/kafka"

	"github.com/testcontainers/testcontainers-go/modules/kafka"
	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
)

func GetKafkaAddress(ctx context.Context, kafkaContainer *kafka.KafkaContainer) (string, error) {
	kafkaAddrs, err := kafkaContainer.Brokers(ctx)
	if err != nil {
		return "", err
	}
	if len(kafkaAddrs) == 0 {
		return "", fmt.Errorf("no kafka address")
	}

	fmt.Printf("Endpoint : %s", kafkaAddrs[0])

	return kafkaAddrs[0], nil
}

func StartKafka(ctx context.Context) (*kafka.KafkaContainer, error) {
	kafkaContainer, err := kafka.Run(ctx, "confluentinc/confluent-local:7.5.0",
		kafka.WithClusterID("1"),
	)
	if err != nil {
		return nil, err
	}
	return kafkaContainer, nil
}

func InitKafkaClient(topic string, address string) *kgo.Client {
	log.Printf("Connecting to kafka: %s | topic=%s",
		address,
		topic,
	)

	kafkaConfig := sharedKafka.NewKafkaConfig(address, topic, sharedKafka.CoordinatorId)

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		log.Printf("Error while creating kafka client: %v\n", err)
		return nil
	}

	return client
}

func SendMessage(client *kgo.Client, msg sharedKafka.KafkaMessageInterface) error {
	ctx := context.Background()
	data, err := json.Marshal(&msg)
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	return client.ProduceSync(ctx, &kgo.Record{Value: data}).FirstErr()
}

func StartReceiveLoop(client *kgo.Client, handler func(any) error) error {
	ctx := context.Background()
	for {
		fetches := client.PollFetches(ctx)
		if errs := fetches.Errors(); len(errs) > 0 {
			panic(fmt.Sprint(errs))
		}

		iter := fetches.RecordIter()
		for !iter.Done() {
			record := iter.Next()
			if msg, err := sharedKafka.UnmarshalKafkaMessage(record.Value); err != nil {
				return fmt.Errorf("cannot unmarshall kafka message : %w", err)
			} else {
				if m, ok := msg.(sharedKafka.KafkaMessageInterface); ok {
					if m.GetSenderID() != "" && m.GetSenderID() != sharedKafka.CoordinatorId {
						if err := handler(msg); err != nil {
							return err
						}
					}
				}
			}
		}
	}
}

func CreateTopic(topic string, client *kgo.Client) error {
	adminClient := kadm.NewClient(client)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	topicName := topic
	topicDetails, err := adminClient.ListTopics(ctx)
	if err != nil {
		return fmt.Errorf("failed to list topics: %v", err)
	}

	if topicDetails.Has(topicName) {
		log.Printf("topic %v already exists\n", topicName)
		return nil
	}
	log.Printf("creating topic %v\n", topicName)

	createTopicResponse, err := adminClient.CreateTopic(ctx, -1, -1, nil, topicName)
	if err != nil {
		return fmt.Errorf("failed to create topic: %v", err)
	}
	log.Printf("successfully created topic %v\n", createTopicResponse.Topic)
	return nil
}
