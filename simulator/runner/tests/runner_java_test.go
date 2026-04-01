package tests

import (
	"devsforge-runner/cmd"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"devsforge-shared/utils"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

var runnerJavaID = "m1-java"

func TestRunJavaModel(t *testing.T) {
	t.Helper()
	setupTest(t)

	var manifest shared.RunnableManifest

	codeContent, err := os.ReadFile("tests/m1java/GeneratorIncremental.java")
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "java",
			"id": "%s",
			"name": "GeneratorIncremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test",
		"simulationID": "test-java-sim"
	}`, runnerJavaID, string(codeContent))

	err = utils.ParseManifest(jsonContent, &manifest)
	if err != nil {
		t.Fatalf("Error while parsing test manifest\n %v", err)
	}

	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("failed to marshal manifest: %v", err)
	}

	tmpDir, err := utils.CreateTempDir(SimRoot)
	if err != nil {
		t.Fatalf("failed to create temp dir in simulator/tmp: %v", err)
	}
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, data, 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	kafkaTopic := "runner-test-java"

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

	args := []string{
		"--file", jsonPath,
		"--config", cfgPath,
	}

	client := InitKafkaClient(kafkaTopic, KafkaAddr)
	err = CreateTopic(kafkaTopic, client)
	if err != nil {
		log.Fatalf("cant create kafka topic : %v", err)
	}

	go func() {
		if err := cmd.LaunchRunner(args); err != nil {
			log.Fatalf("expected runner to exit cleanly, got error:\n%v", err)
		}
	}()

	i := 0.0
	currentTime := 0.0

	log.Println("Sending init message")
	err = SendMessage(
		client, &kafka.KafkaMessageInitSim{
			DevsType: kafka.DevsTypeInitSim,
			Time: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        i,
			},
			Target: runnerJavaID,
			Sender: Sender,
		},
	)
	if err != nil {
		log.Fatalf("❌ collector error in coordinator: %v", err)
	}

	err = StartReceiveLoop(client, func(msg *kafka.BaseKafkaMessage) error {
		if i > 5 {
			return nil
		}
		if msg.Sender == "" || msg.Sender == Sender {
			return nil
		}

		switch msg.DevsType {

		case kafka.DevsTypeNextTime:
			currentTime = msg.NextTime.T
			err = SendMessage(client, &kafka.KafkaMessageExecuteTransition{
				DevsType: kafka.DevsTypeExecuteTransition,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				Target: runnerJavaID,
			})
			i = i + 1
		case kafka.DevsTypeTransitionDone:
			err = SendMessage(client, &kafka.KafkaMessageSendOutput{
				DevsType: kafka.DevsTypeSendOutput,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				Target: runnerJavaID,
				Sender: Sender,
			})
		case kafka.DevsTypeModelOutput:
			err = SendMessage(client, &kafka.KafkaMessageSimulationDone{
				DevsType: kafka.DevsTypeSimulationDone,
				Target:   runnerJavaID,
				Sender:   Sender,
			})
			return ErrSimulationDone
		default:
			log.Printf("Unreconized message : %s\n", msg.DevsType.String())
		}
		return nil
	})
	if err != nil && !errors.Is(err, ErrSimulationDone) {
		t.Fatalf("❌ collector error in coordinator: %v", err)
	}
}