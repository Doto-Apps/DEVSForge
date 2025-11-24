package tests

import (
	"context"
	"devsforge/simulator/shared/kafka"
	"fmt"
	"log"
	"time"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
)

func InitKafkaClient(topic string, address string) *kgo.Client {
	log.Printf("Connecting to kafka: %s | topic=%s",
		address,
		topic,
	)

	// Logger + Producer Kafka
	kafkaConfig := kafka.NewKafkaConfig(address, topic, "Fake Coordinator")

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		log.Printf("Error while creating kafka client: %v\n", err)
		return nil
	}

	return client
}

func SendMessage(client *kgo.Client, msg kafka.KafkaMessageI) error {
	ctx := context.Background()
	data, err := msg.Marshal()
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	log.Println("[ TEST COORDINATOR ]: Sending : " + string(data))
	return client.ProduceSync(ctx, &kgo.Record{Value: data}).FirstErr()
}

func StartReceiveLoop(client *kgo.Client, handler func(*kafka.BaseKafkaMessage) error) error {
	ctx := context.Background()
	for {
		fetches := client.PollFetches(ctx)
		if errs := fetches.Errors(); len(errs) > 0 {
			// All errors are retried internally when fetching, but non-retriable errors are
			// returned from polls so that users can notice and take action.
			panic(fmt.Sprint(errs))
		}

		// We can iterate through a record iterator...
		iter := fetches.RecordIter()
		for !iter.Done() {
			record := iter.Next()
			msg, err := kafka.UnmarshalKafkaMessage(record.Value)
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
		fmt.Printf("topic %v already exists\n", topicName)
		return nil
	}
	fmt.Printf("Creating topic %v\n", topicName)

	createTopicResponse, err := adminClient.CreateTopic(ctx, -1, -1, nil, topicName)
	if err != nil {
		return fmt.Errorf("failed to create topic: %v", err)
	}
	fmt.Printf("Successfully created topic %v\n", createTopicResponse.Topic)
	return nil
}
