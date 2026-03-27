package config

import (
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"net"
	"os"

	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v3"
)

type RunnerConfig struct {
	SimulationID string
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
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("failed to listen on random port: %w", err)
	}
	defer func() {
		if err = l.Close(); err != nil {
			slog.Debug("Cannot close listening connection", "error", err)
		}
	}()

	addr, ok := l.Addr().(*net.TCPAddr)
	if !ok {
		return 0, fmt.Errorf("listener addr is not *net.TCPAddr, got %T", l.Addr())
	}

	return addr.Port, nil
}

func InitConfig(manifest shared.RunnableManifest, yamlConfigPath string) *RunnerConfig {
	// Charge la config YAML (Kafka, gRPC, etc.) — on ne va garder que Kafka
	runnerConfig, err := LoadYamlConfig(yamlConfigPath)
	if err != nil {
		panic(fmt.Errorf("failed to load YAML config at %s with error :  %w", yamlConfigPath, err))
	}

	// Pour l'instant tu imposes 1 seul modèle par runner
	model := *manifest.Models[0]

	// 🔹 Choix dynamique du port gRPC pour CE runner
	grpcPort, err := pickFreePort()
	if err != nil {
		panic(fmt.Errorf("failed to allocate gRPC port: %w", err))
	}

	if runnerConfig.GRPC.Host == "" {
		runnerConfig.GRPC.Host = "127.0.0.1"
	}

	grpcConfig := shared.YamlInputConfigGRPC{
		Host: runnerConfig.GRPC.Host,
		Port: grpcPort,
	}

	// On fixe l'host (tu peux garder celui du YAML si tu veux)

	slog.Info("Connecting to kafka", "runner_id",
		model.ID,
		runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		grpcConfig.Host,
		grpcConfig.Port,
	)

	kafkaConfig := kafka.NewKafkaConfig(runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		model.ID)

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		slog.Error("Error creating kafka client", "error", err)
		return nil
	}

	config = &RunnerConfig{
		SimulationID: manifest.SimulationID,
		ID:           model.ID,
		Model:        &model,
		KafkaConfig:  *kafkaConfig,
		GRPC:         grpcConfig,
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
