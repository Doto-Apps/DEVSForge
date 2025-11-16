package internal

import (
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/kafka"
	"fmt"
	"log"
	"os"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v3"
)

type CoordConfig struct {
	Logger    *zerolog.Logger
	Producer  *kafka.KafkaProducer
	Collector *kafka.KafkaCollector
}

var config *CoordConfig

func InitConfig(yamlConfig shared.YamlInputConfig) *CoordConfig {
	// Charge la config YAML (Kafka, gRPC, etc.)

	log.Printf("Connecting to kafka: %s | topic=%s",
		yamlConfig.Kafka.Address,
		yamlConfig.Kafka.Topic,
	)

	// Logger + Producer Kafka
	logger, producer := kafka.NewLoggerWithKafka(yamlConfig.Kafka.Address, yamlConfig.Kafka.Topic, "Coordinator")

	collector := kafka.NewKafkaCollector(yamlConfig.Kafka.Address, yamlConfig.Kafka.Topic, "Coordinator")

	config = &CoordConfig{
		Logger:    &logger,
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

func GetConfig() *CoordConfig {
	return config
}
