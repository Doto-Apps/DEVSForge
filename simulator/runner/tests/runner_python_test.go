// main_test.go — dans runners/go/
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

var runnerPythonID = "m1-python"

// TestLaunchRunnerWithKafka démarre Kafka via docker-compose, puis lance UN runner
// avec un manifest JSON (contenant ton DumbModel) + un YAML de config généré.
func TestRunPythonModel(t *testing.T) {
	kafkaTopic := "runner-test-python"
	tmpDir, err := os.MkdirTemp("/tmp", "devsforge_test_runner_*")
	if err != nil {
		t.Fatalf("cannot create tmp dir: %v", err)
	}

	codeContent, err := os.ReadFile(filepath.Join("testdata", "m1.py"))
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "python",
			"id": "%s",
			"name": "Generator Incremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test",
		"simulationID": "test-python-sim"
	}`, runnerPythonID, string(codeContent))

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

	i := 0.0
	currentTime := 0.0

	// Send init to model
	log.Println("Sending init message")
	err = SendMessage(
		client, &kafka.KafkaMessageInitSim{
			MsgType: kafka.MsgTypeSimulationInit,
			EventTime: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        i,
			},
			ReceiverID: runnerPythonID,
			SenderID:   Sender,
		},
	)
	if err != nil {
		log.Fatalf("❌ collector error in coordinator: %v", err)
	}

	err = StartReceiveLoop(client, func(msg *kafka.BaseKafkaMessage) error {
		if i > 5 {
			return nil
		}
		if msg.SenderID == "" || msg.SenderID == Sender {
			return nil
		}

		switch msg.MsgType {

		case kafka.MsgTypeNextInternalTimeReport:
			currentTime = msg.NextInternalTime.T
			err = SendMessage(client, &kafka.KafkaMessageExecuteTransition{
				MsgType: kafka.MsgTypeExecuteTransition,
				EventTime: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				ReceiverID: runnerPythonID,
			})
			i = i + 1
		case kafka.MsgTypeTransitionComplete:
			err = SendMessage(client, &kafka.KafkaMessageSendOutput{
				MsgType: kafka.MsgTypeRequestOutput,
				EventTime: &kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				ReceiverID: runnerPythonID,
				SenderID:   Sender,
			})
		case kafka.MsgTypeOutputReport:
			err = SendMessage(client, &kafka.KafkaMessageSimulationDone{
				MsgType:    kafka.MsgTypeSimulationTerminate,
				ReceiverID: runnerPythonID,
				SenderID:   Sender,
			})
			return ErrSimulationDone
		default:
			log.Printf("Unreconized message : %s\n", msg.MsgType)
		}
		return nil
	})
	if err != nil && !errors.Is(err, ErrSimulationDone) {
		t.Fatalf("❌ collector error in coordinator: %v", err)
	}
}
