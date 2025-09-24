package internal

import (
	"devsforge/shared"
	"fmt"
	"log"
	"os"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v3"
)

type RunnerConfig struct {
	Model     *shared.RunnableModel
	ID        string
	Logger    *zerolog.Logger
	PeerCount int
	Producer  *KafkaProducer
	Collector *KafkaCollector
}

var config *RunnerConfig

func InitConfig(manifest shared.RunnableManifest, yamlConfigPath string) *RunnerConfig {
	runnerConfig, err := LoadYamlConfig(yamlConfigPath)
	if err != nil {
		panic(err)
	}
	model := *manifest.Models[0]
	log.Printf("Connecting to kafka: %s | %s | %s", runnerConfig.Kafka.Address, runnerConfig.Kafka.Topic, model.ID)
	// TODO: A rendre dynamique avec les args pour faire kafka ou autres
	logger, producer := NewLoggerWithKafka(runnerConfig.Kafka.Address, runnerConfig.Kafka.Topic, model.ID)

	logger.Debug().Any("informations", map[string]string{
		"IPC Provider": "File based /tmp/simulation.log",
		"ID":           model.ID,
		"Name":         model.Name,
		"Language":     "Todo",
		"Ports":        fmt.Sprintf("%v", model.Ports),
		"Connections":  fmt.Sprintf("%v", model.Connections),
	}).Msg("Config Information")

	collector := NewKafkaCollector(runnerConfig.Kafka.Address, runnerConfig.Kafka.Topic, model.ID)
	collector.Start()

	config = &RunnerConfig{
		ID:        model.ID,
		Model:     &model,
		Logger:    &logger,
		PeerCount: manifest.Count - 1,
		Producer:  producer,
		Collector: collector,
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
