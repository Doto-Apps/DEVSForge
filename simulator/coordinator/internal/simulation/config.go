// Package simulation Simulation functions
package simulation

import (
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"devsforge-shared/utils"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"github.com/twmb/franz-go/pkg/kgo"
	"gopkg.in/yaml.v3"
)

var coordConfig *types.CoordinatorConfig

func InitConfig(yamlConfig shared.YamlInputConfig, simulationID string) *types.CoordinatorConfig {
	// Charge la config YAML (Kafka, gRPC, etc.)

	slog.Info("Connecting to kafka", "broker",
		yamlConfig.Kafka.Address,
		"topic",
		yamlConfig.Kafka.Topic,
	)

	// Logger + Producer Kafka
	kafkaConfig := kafka.NewKafkaConfig(yamlConfig.Kafka.Address, yamlConfig.Kafka.Topic, "Coordinator")

	client, err := kgo.NewClient(kafkaConfig.Config...)
	if err != nil {
		slog.Error("Error creating kafka client", "error", err)
		return nil
	}

	coordConfig = &types.CoordinatorConfig{
		KafkaConfig:  *kafkaConfig,
		KafkaClient:  client,
		SimulationID: simulationID,
	}

	return coordConfig
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

func GetConfig() *types.CoordinatorConfig {
	return coordConfig
}

func GenerateRunnerYamlConfig(config shared.YamlInputConfig) (*os.File, error) {
	rawYAML, err := yaml.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("error serializing YAML: %w", err)
	}

	tmpFile, err := os.CreateTemp("", "runner-*.yaml")
	if err != nil {
		return nil, fmt.Errorf("error creating tmp file: %w", err)
	}

	defer func() {
		if err = tmpFile.Close(); err != nil {
			slog.Debug("Cannot close temp file", "error", err)
		}
	}()
	if _, err := tmpFile.Write(rawYAML); err != nil {
		return nil, fmt.Errorf("error writing YAML tmp file: %w", err)
	}

	return tmpFile, nil
}

func GenerateJSONRunnerManifest(m *shared.RunnableModel, modelCount int, simulationID string) (*os.File, error) {
	rawJSON, err := json.Marshal(shared.RunnableManifest{
		Models:       []*shared.RunnableModel{m},
		Count:        modelCount,
		SimulationID: simulationID,
	})
	if err != nil {
		return nil, fmt.Errorf("error when launching %s : Invalid JSON to stringify", m.ID)
	}
	tmpFile, _ := os.CreateTemp("", "model-*.json")
	defer func() {
		if err = tmpFile.Close(); err != nil {
			slog.Debug("Cannot close temp file", "error", err)
		}
	}()
	if _, err := tmpFile.Write(rawJSON); err != nil {
		return nil, fmt.Errorf("error when launching %s : cannot write tmp file: %w", m.ID, err)
	}

	return tmpFile, nil
}

func CreateManifest(jsonStr *string, filePath *string) (shared.RunnableManifest, error) {
	var manifest shared.RunnableManifest
	if jsonStr != nil && *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return manifest, fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if filePath != nil && *filePath != "" {
		data, err := os.ReadFile(*filePath)
		if err != nil {
			return manifest, fmt.Errorf("error reading file: %w", err)
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			return manifest, fmt.Errorf("error parsing JSON file: %w", err)
		}
	} else {
		return manifest, fmt.Errorf("please provide --json or --file")
	}

	return manifest, nil
}
