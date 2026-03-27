package internal

import (
	"crypto/rand"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

// RandomStringWithPrefix get a random string with prefix and dynamic random part length.
// Example: prefix="topic" -> "topic-3fa85f64"
func RandomStringWithPrefix(prefix string, length int) (string, error) {
	if length <= 0 {
		length = 8
	}

	bytes := make([]byte, length/2+length%2)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random string: %w", err)
	}

	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(bytes)[:length]), nil
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
			log.Println("cannot close tmpFile: ", err)
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
			log.Println("cannot close tmpFile: ", err)
		}
	}()
	if _, err := tmpFile.Write(rawJSON); err != nil {
		return nil, fmt.Errorf("error when launching %s : cannot write tmp file: %w", m.ID, err)
	}

	return tmpFile, nil
}

func CreateManifest(jsonStr *string, filePath *string) (shared.RunnableManifest, error) {
	var manifest shared.RunnableManifest
	if *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return manifest, fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if *filePath != "" {
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
