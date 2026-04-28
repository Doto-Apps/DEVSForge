package tests

import (
	"devsforge-runner/cmd"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestGoRunner(t *testing.T) {
	t.Skip("Not now")
	runnerGoID := "m1-go"
	kafkaTopic := "runner-test-go"
	simID := "test-go-sim"
	tmpDir, err := os.MkdirTemp("/tmp", "devsforge_test_runner_*")
	if err != nil {
		t.Fatalf("cannot create tmp dir: %v", err)
	}

	codeContent, err := os.ReadFile(filepath.Join("testdata", "m1.go"))
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "go",
			"id": "%s",
			"name": "Generator Incremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test",
		"simulationID": "%s"
	}`, runnerGoID, string(codeContent), simID)

	if err != nil {
		t.Fatalf("failed to marshal manifest: %v", err)
	}

	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	yamlCfg := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: KafkaAddr,
			Topic:   kafkaTopic,
		},
		TmpDirectory: tmpDir,
	}

	cfgPath := filepath.Join(tmpDir, "runner-config.yaml")
	yamlBytes, err := yaml.Marshal(&yamlCfg)
	if err != nil {
		t.Fatalf("failed to marshal yaml config: %v", err)
	}

	if err := os.WriteFile(cfgPath, yamlBytes, 0o644); err != nil {
		t.Fatalf("failed to write yaml config: %v", err)
	}

	client := InitKafkaClient(kafkaTopic, KafkaAddr)
	err = CreateTopic(kafkaTopic, client)
	if err != nil {
		log.Fatalf("cant create kafka topic : %v", err)
	}

	go func() {
		if err := cmd.LaunchRunner(nil, &cfgPath, &jsonPath); err != nil {
			log.Fatalf("expected runner to exit cleanly, got error:\n%v", err)
		}
	}()

	currentTime := 0.0
	baseMessage := kafka.BaseKafkaMessage{
		SimulationRunID: simID,
		SenderID:        kafka.CoordinatorId,
		ReceiverID:      runnerGoID,
	}

	// Send init to model
	log.Println("Sending init message")
	initMsg := baseMessage.NewKafkaMessageSimulationInit(kafka.KafkaMessageSimulationInitParams{
		EventTime: currentTime,
	})
	err = SendMessage(
		client, initMsg,
	)
	if err != nil {
		log.Fatalf("❌ collector error in coordinator: %v", err)
	}

	err = StartReceiveLoop(client, func(msg any) error {
		if m, ok := msg.(*kafka.CommonKafkaMessage); ok && (m.SenderID == "" || m.SenderID == Sender) {
			return nil
		}

		switch m := msg.(type) {
		case *kafka.KafkaMessageNextInternalTimeReport:
			currentTime = m.NextInternalTime
			execTranstionMsg := baseMessage.NewKafkaMessageExecuteTransition(kafka.KafkaMessageExecuteTransitionParams{
				EventTime: currentTime,
				Payload: kafka.KafkaMessageExecuteTransitionPayload{
					Inputs: make([]*kafka.KafkaMessagePortPayload, 0),
				},
			})
			err = SendMessage(client, execTranstionMsg)
		case *kafka.KafkaMessageTransitionComplete:
			sendOutput := baseMessage.NewKafkaMessageRequestOutput(kafka.KafkaMessageRequestOutputParams{
				EventTime: currentTime,
			})
			err = SendMessage(client, sendOutput)
		case *kafka.KafkaMessageOutputReport:
			simulationDoneMsg := baseMessage.NewKafkaMessageSimulationTerminate(kafka.KafkaMessageSimulationTerminateParams{
				EventTime: currentTime,
				Payload: &kafka.KafkaMessageSimulationTerminatePayload{
					Reason: "ok",
				},
			})
			err = SendMessage(client, simulationDoneMsg)
			return ErrSimulationDone
		default:
			log.Printf("Unreconized message : %s\n", msg)
		}
		return nil
	})
	if err != nil && !errors.Is(err, ErrSimulationDone) {
		t.Fatalf("❌ collector error in coordinator: %v", err)
	}
}
