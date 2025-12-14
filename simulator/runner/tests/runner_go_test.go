// main_test.go — dans runners/go/
package tests

import (
	shared "devsforge-shared"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"devsforge-runner/cmd"
	"devsforge-shared/kafka"
	"devsforge-shared/utils"

	"gopkg.in/yaml.v3"
)

var RunnerGoID = "m1-go"

// TestLaunchRunnerWithKafka démarre Kafka via docker-compose, puis lance UN runner
// avec un manifest JSON (contenant ton DumbModel) + un YAML de config généré.
func TestRunGoModel(t *testing.T) {

	t.Helper()
	setupTest(t)

	var manifest shared.RunnableManifest

	codeContent, err := os.ReadFile("./tests/m1go/m1.go")
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "go",
			"id": "%s",
			"name": "GeneratorIncremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test"
	}`, RunnerGoID, string(codeContent))

	err = utils.ParseManifest(jsonContent, &manifest)
	if err != nil {
		t.Fatalf("Error while parsing test manifest\n %v", err)
	}

	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("failed to marshal manifest: %v", err)
	}

	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, data, 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	// 3️⃣ Générer un fichier YAML de config pour le runner
	kafkaTopic := "runner-test-go"

	yamlCfg := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: KafkaAddr,
			Topic:   kafkaTopic,
		},
		TmpDirectory: SimRoot,
	}

	cfgPath := filepath.Join(tmpDir, "runner-config.yaml")
	yamlBytes, err := yaml.Marshal(&yamlCfg)
	if err != nil {
		t.Fatalf("failed to marshal yaml config: %v", err)
	}

	if err := os.WriteFile(cfgPath, yamlBytes, 0o644); err != nil {
		t.Fatalf("failed to write yaml config: %v", err)
	}

	// 4️⃣ Lancer le runner directement via LaunchRunner
	//    On simule la ligne de commande :
	//    go run runners/go/main.go --file <manifest> --config <config>
	args := []string{
		"--file", jsonPath,
		"--config", cfgPath,
	}

	client := InitKafkaClient(kafkaTopic, KafkaAddr)
	err = CreateTopic(kafkaTopic, client)
	if err != nil {
		testLogger.Fatalf("cant create kafka topic : %v", err)
	}

	go func() {
		if err := cmd.LaunchRunner(args); err != nil {
			testLogger.Fatalf("expected runner to exit cleanly, got error:\n%v", err)
		}
	}()

	i := 0.0
	currentTime := 0.0

	// Send init to model
	testLogger.Println("Sending init message")
	err = SendMessage(
		client, &kafka.KafkaMessageInitSim{
			DevsType: kafka.DevsTypeInitSim,
			Time: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        i,
			},
			Target: RunnerGoID,
			Sender: Sender,
		},
	)
	if err != nil {
		testLogger.Fatalf("❌ collector error in coordinator: %v", err)
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
			SendMessage(client, &kafka.KafkaMessageExecuteTransition{
				DevsType: kafka.DevsTypeExecuteTransition,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				Target: RunnerGoID,
			})
			i = i + 1
		case kafka.DevsTypeTransitionDone:
			SendMessage(client, &kafka.KafkaMessageSendOutput{
				DevsType: kafka.DevsTypeSendOutput,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        currentTime,
				},
				Target: RunnerGoID,
				Sender: Sender,
			})
		case kafka.DevsTypeModelOutput:
			SendMessage(client, &kafka.KafkaMessageSimulationDone{
				DevsType: kafka.DevsTypeSimulationDone,
				Target:   RunnerGoID,
				Sender:   Sender,
			})
			return ErrSimulationDone
		default:
			testLogger.Printf("Unreconized message : %s\n", msg.DevsType.String())
		}
		return nil
	})
	if err != nil && !errors.Is(err, ErrSimulationDone) {
		t.Fatalf("❌ collector error in coordinator: %v", err)
	}
}
