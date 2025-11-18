package internal

import (
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/kafka"
	"fmt"
	"log"
	"net"
	"os"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v3"
)

type RunnerConfig struct {
	Model     *shared.RunnableModel
	ID        string
	Logger    *zerolog.Logger
	PeerCount int
	Producer  *kafka.KafkaProducer
	Collector *kafka.KafkaCollector
	GRPC      shared.YamlInputConfigGRPC
}

var config *RunnerConfig

// focntion qui laisse choiri le port
// TODO: verifier si il n'y a pas des os ou ca bug
func pickFreePort() (int, error) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer lis.Close()

	addr := lis.Addr().(*net.TCPAddr)
	return addr.Port, nil
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

	// Logger + Producer Kafka
	logger, producer := kafka.NewLoggerWithKafka(
		runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		model.ID,
	)

	logger.Debug().Any("informations", map[string]string{
		"IPC Provider": "File based /tmp/simulation.log",
		"ID":           model.ID,
		"Name":         model.Name,
		"Language":     "Todo",
		"Ports":        fmt.Sprintf("%v", model.Ports),
		"Connections":  fmt.Sprintf("%v", model.Connections),
		"GRPC Host":    runnerConfig.GRPC.Host,
		"GRPC Port":    fmt.Sprintf("%d", runnerConfig.GRPC.Port),
	}).Msg("Config Information")

	collector := kafka.NewKafkaCollector(
		runnerConfig.Kafka.Address,
		runnerConfig.Kafka.Topic,
		model.ID,
	)

	config = &RunnerConfig{
		ID:        model.ID,
		Model:     &model,
		Logger:    &logger,
		PeerCount: manifest.Count - 1,
		Producer:  producer,
		Collector: collector,
		GRPC:      runnerConfig.GRPC,
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
