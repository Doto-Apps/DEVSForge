package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

func startKafkaContainer(ctx context.Context) (brokerAddr string, terminate func(), err error) {
	req := testcontainers.ContainerRequest{
		Image:        "apache/kafka:latest",
		ExposedPorts: []string{"9092/tcp"},
		Env: map[string]string{
			"KAFKA_NODE_ID":                                  "1",
			"KAFKA_PROCESS_ROLES":                            "broker,controller",
			"KAFKA_LISTENERS":                                "PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093",
			"KAFKA_ADVERTISED_LISTENERS":                     "PLAINTEXT://localhost:9092",
			"KAFKA_CONTROLLER_LISTENER_NAMES":                "CONTROLLER",
			"KAFKA_LISTENER_SECURITY_PROTOCOL_MAP":           "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT",
			"KAFKA_CONTROLLER_QUORUM_VOTERS":                 "1@localhost:9093",
			"KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR":         "1",
			"KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR": "1",
			"KAFKA_TRANSACTION_STATE_LOG_MIN_ISR":            "1",
			"KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS":         "0",
			"KAFKA_NUM_PARTITIONS":                           "1",
		},
		WaitingFor: wait.ForListeningPort("9092/tcp"),
	}
	kafkaC, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return "", nil, err
	}

	host, err := kafkaC.Host(ctx)
	if err != nil {
		return "", nil, err
	}
	port, err := kafkaC.MappedPort(ctx, "9092")
	if err != nil {
		return "", nil, err
	}

	broker := fmt.Sprintf("%s:%s", host, port.Port())
	return broker, func() { kafkaC.Terminate(ctx) }, nil
}

func TestRunWithFileKafka(t *testing.T) {
	ctx := context.Background()

	// Lance Kafka temporaire
	broker, terminate, err := startKafkaContainer(ctx)
	if err != nil {
		t.Fatalf("failed to start Kafka: %v", err)
	}
	t.Log("Kafka started...")
	defer terminate()

	// JSON statique pour tester
	jsonContent := `{
		"models": [
			{"id": "m1", "name": "ModelOne"},
			{"id": "m2", "name": "ModelTwo"}
		],
        "count": 2
	}`

	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	// Configurer le runner pour utiliser ce broker Kafka
	os.Setenv("KAFKA_BROKER", broker)
	defer os.Unsetenv("KAFKA_BROKER")

	// Appelle run() avec --file
	err = run([]string{"--file", jsonPath})
	if err != nil {
		t.Fatalf("expected no error, got\n %v", err)
	}
}
