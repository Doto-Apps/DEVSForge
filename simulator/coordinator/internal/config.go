package internal

import (
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"fmt"
	"log"
	"os"

	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v3"
)

type CoordConfig struct {
	KafkaConfig kafka.KafkaConfig
	KafkaClient *kgo.Client
}

var config *CoordConfig

func InitConfig(yamlConfig shared.YamlInputConfig) *CoordConfig {
	// Charge la config YAML (Kafka, gRPC, etc.)

	log.Printf("Connecting to kafka: %s | topic=%s",
		yamlConfig.Kafka.Address,
		yamlConfig.Kafka.Topic,
	)

	// Logger + Producer Kafka
	kafkaConfig := kafka.NewKafkaConfig(yamlConfig.Kafka.Address, yamlConfig.Kafka.Topic, "Coordinator")

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		log.Printf("Error while creating kafka client: %v\n", err)
		return nil
	}

	config = &CoordConfig{
		KafkaConfig: *kafkaConfig,
		KafkaClient: client,
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
