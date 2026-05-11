package simulation

import (
	"context"
	"devsforge-coordinator/testsutils"
	"log"
	"os"
	"testing"
)

var KafkaAddr string

func TestMain(m *testing.M) {
	ctx := context.Background()
	kafkaContainer, err := testsutils.StartKafka(ctx)
	if err != nil {
		log.Fatalf("cannot start kafka: %s", err.Error())
	}
	KafkaAddr, err = testsutils.GetKafkaAddress(ctx, kafkaContainer)
	if err != nil {
		log.Fatalf("cannot start kafka: %s", err.Error())
	}

	defer func() {
		log.Println("terminating kafka")
		if err := kafkaContainer.Terminate(ctx); err != nil {
			log.Printf("failed to terminate Kafka: %v", err)
		}
	}()

	// Lancer les tests
	exitCode := m.Run()

	log.Println("exiting")
	os.Exit(exitCode)
}
