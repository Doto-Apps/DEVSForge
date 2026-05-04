package cmd

import (
	"context"
	"devsforge-runner/testsutils"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"devsforge-shared/simulation"
	"errors"
	"log"
	"os"
	"path/filepath"
	"testing"

	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v2"
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

func testGenerator(
	jsonContent string,
	kafkaTopic string,
	baseMessage kafka.BaseKafkaMessage,
	currentTime float64,
	t *testing.T,
	client *kgo.Client,
	handler func(any) error,
) {
	tmpDir, err := os.MkdirTemp("/tmp", "devsforge_test_runner_*")
	if err != nil {
		t.Fatalf("cannot create tmp dir: %v", err)
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

	err = testsutils.CreateTopic(kafkaTopic, client)
	if err != nil {
		t.Fatalf("cant create kafka topic : %v", err)
	}

	done := make(chan bool, 1)
	go func() {
		if err := LaunchRunner(nil, &cfgPath, &jsonPath); err != nil {
			t.Logf("expected runner to exit cleanly, got error:\n%v", err)
			t.Fail()
		} else {
			done <- true
			t.Log("function LaunchRunner ended successfully")
		}
	}()

	t.Log("Sending init message")
	initMsg := baseMessage.NewKafkaMessageSimulationInit(kafka.KafkaMessageSimulationInitParams{
		EventTime: currentTime,
	})
	err = testsutils.SendMessage(
		client, initMsg,
	)
	if err != nil {
		t.Fatalf("cant seed message: %v", err)
	}

	err = testsutils.StartReceiveLoop(client, handler)
	if err != nil && !errors.Is(err, simulation.ErrSimulationDone) {
		t.Fatalf("collector error in test coordinator: %v", err)
	}
	if ok := <-done; ok != false {
		t.Log("runner stopped")
	}
}
