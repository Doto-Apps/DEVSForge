package config

import (
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"fmt"
	"log"
	"net"
	"os"

	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v3"
)

type RunnerConfig struct {
	Model        *shared.RunnableModel
	ID           string
	KafkaConfig  kafka.KafkaConfig
	KafkaClient  *kgo.Client
	GRPC         shared.YamlInputConfigGRPC
	TmpDirectory string
}

var config *RunnerConfig

// pickFreePort Choose a free port to run the model
func pickFreePort() (int, error) {
	for port := 50051; port <= 51051; port++ {
		addr := fmt.Sprintf("127.0.0.1:%d", port)

		lis, err := net.Listen("tcp", addr)
		if err != nil {
			// Port already in use, try next one
			continue
		}

		// Port available, close listener and return it
		lis.Close()
		return port, nil
	}

	return 0, fmt.Errorf("no free port found in range 50051-51051")
}

func InitConfig(manifest shared.RunnableManifest, yamlConfigPath string) *RunnerConfig {
	// Charge la config YAML (Kafka, gRPC, etc.) — on ne va garder que Kafka
	runnerConfig, err := LoadYamlConfig(yamlConfigPath)
	if err != nil {
		panic(err)
	}

	// Pour l'instant tu imposes 1 seul modèle par runner
	model := *manifest.Models[0]

	// 🔹 Choix dynamique du port gRPC pour CE runner
	grpcPort, err := pickFreePort()
	if err != nil {
		panic(fmt.Errorf("failed to allocate gRPC port: %w", err))
	}

	// On fixe l'host (tu peux garder celui du YAML si tu veux)
	if runnerConfig.GRPC.Host == "" {
		runnerConfig.GRPC.Host = "127.0.0.1"
	}
	runnerConfig.GRPC.Port = grpcPort

	log.Printf("[RUNNER %s] Connecting to kafka: %s | topic=%s | gRPC=%s:%d",
		model.ID,
		runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		runnerConfig.GRPC.Host,
		runnerConfig.GRPC.Port,
	)

	kafkaConfig := kafka.NewKafkaConfig(runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		model.ID)

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		log.Printf("Error while creating kafka client: %v\n", err)
		return nil
	}

	config = &RunnerConfig{
		ID:           model.ID,
		Model:        &model,
		KafkaConfig:  *kafkaConfig,
		GRPC:         runnerConfig.GRPC,
		KafkaClient:  client,
		TmpDirectory: runnerConfig.TmpDirectory,
	}

	return config
}

// LoadYamlConfig load YAML config file
func LoadYamlConfig(path string) (*shared.YamlInputConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var cfg shared.YamlInputConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("unmarshal yaml: %w", err)
	}

	return &cfg, nil
}

func GetConfig() *RunnerConfig {
	return config
}
