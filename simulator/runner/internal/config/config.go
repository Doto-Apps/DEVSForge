// Package config provides environment and YAML-based configuration management for the runner.
package config

import (
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"net"
	"os"
	"sync"

	shared "devsforge-shared"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v3"
)

var (
	once     sync.Once
	instance *RunnerConfig
)

type EnvConfig struct {
	Log   LogConfig
	Paths PathsConfig
	Java  JavaConfig
	Kafka KafkaConfig
}

type LogConfig struct {
	Dir  string `env:"LOG_DIR" envDefault:"/tmp/devsforge-logs/"`
	Mode string `env:"LOG_MODE" envDefault:"all"`
}

type PathsConfig struct {
	SimulatorRoot string `env:"PATHS_SIM_ROOT" envDefault:"/app"`
}

type JavaConfig struct {
	Home string `env:"JAVA_HOME"`
}

type KafkaConfig struct {
	Address string `env:"KAFKA_ADDRESS" envDefault:"localhost:9092"`
}

type RunnerConfig struct {
	SimulationID string
	Model        *shared.RunnableModel
	ID           string
	KafkaConfig  kafka.KafkaConfig
	KafkaClient  *kgo.Client
	GRPC         shared.YamlInputConfigGRPC
	TmpDirectory string
	Env          *EnvConfig
}

func Get() *RunnerConfig {
	once.Do(func() {
		_ = godotenv.Load(".env")

		cfg := &RunnerConfig{}
		err := env.Parse(cfg)
		if err != nil {
			panic("config error: " + err.Error())
		}

		envCfg := &EnvConfig{}
		if err := env.Parse(envCfg); err != nil {
			panic("config error: " + err.Error())
		}
		cfg.Env = envCfg

		instance = cfg
	})
	return instance
}

func InitConfig(manifest shared.RunnableManifest, yamlConfigPath string) *RunnerConfig {
	_ = godotenv.Load(".env")

	envCfg := &EnvConfig{}
	if err := env.Parse(envCfg); err != nil {
		panic("config error: " + err.Error())
	}

	runnerConfig, err := LoadYamlConfig(yamlConfigPath)
	if err != nil {
		panic(fmt.Errorf("failed to load YAML config at %s with error : %w", yamlConfigPath, err))
	}

	model := *manifest.Models[0]

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

	instance = &RunnerConfig{
		SimulationID: manifest.SimulationID,
		ID:           model.ID,
		Model:        &model,
		KafkaConfig:  *kafkaConfig,
		GRPC:         grpcConfig,
		KafkaClient:  client,
		TmpDirectory: runnerConfig.TmpDirectory,
		Env:          envCfg,
	}

	return instance
}

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
