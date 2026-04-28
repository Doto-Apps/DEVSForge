package simulation

import (
	"devsforge-coordinator/internal/config"
	"devsforge-coordinator/internal/logstore"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/logger"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

// Error code custom 5000 - 9999
const ERROR_CODE_COORDINATOR_SIMULATION_ERROR = 5000

func handleError(logStore logstore.LogStore, simulationID string, kafkaTopic string, err error, createdAt int64) error {
	return logStore.SetStatus(simulationID, logstore.SimulationStatus{
		Status:       "failed",
		CreatedAt:    createdAt,
		EndedAt:      time.Now().Unix(),
		ErrorMessage: err.Error(),
		KafkaTopic:   kafkaTopic,
	})
}

func RunSimulation(params types.SimulationParams) (*logstore.SimulationStatus, error) {
	manifest, err := CreateManifest(params.Json, params.File)
	if err != nil {
		return nil, err
	}

	if len(manifest.Models) == 0 {
		return nil, fmt.Errorf("no models provided in the manifest")
	}

	logDir := config.Get().Log.Dir

	logStore := logstore.NewFileLogStore(logDir)
	createdAt := time.Now().UnixMicro()

	simLogger, err := logStore.GetLogger(manifest.SimulationID)
	if err != nil {
		return nil, fmt.Errorf("failed to create simulation logger: %w", err)
	}

	logCfg := logger.DefaultConfig(manifest.SimulationID)
	logCfg.LogDir = logDir

	logInstance, err := logger.InitLogger(logCfg, "coordinator", "")
	if err != nil {
		return nil, fmt.Errorf("failed to initialize logger: %w", err)
	}
	slog.SetDefault(logInstance)

	slog.Info("DEVSForge Simulator")

	kafkaAddress := ""
	if params.KafkaAddress != nil {
		kafkaAddress = *params.KafkaAddress
	}
	kafkaTopicParam := ""
	if params.KafkaTopic != nil {
		kafkaTopicParam = *params.KafkaTopic
	}

	kafkaTopic, err := GetKafkaTopic(kafkaAddress, kafkaTopicParam)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Kafka topic: %w", err)
	}

	tmpBase := filepath.Join(config.Get().Paths.SimulationDirRoot)
	prefix := "devsforge_" + manifest.SimulationID + "_*"
	rootDir, err := os.MkdirTemp(tmpBase, prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to create simulation temp dir with prefix %q under %q: %w", prefix, tmpBase, err)
	}
	slog.Info("Created simulation temp dir", "path", rootDir)

	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: kafkaAddress,
			Topic:   kafkaTopic,
		},
		TmpDirectory: rootDir,
	}

	configFile, err := GenerateRunnerYamlConfig(yamlConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate runner YAML config: %w", err)
	}

	cfg := InitConfig(yamlConfig, manifest.SimulationID)

	err = logStore.SetStatus(manifest.SimulationID, logstore.SimulationStatus{
		Status:     "running",
		CreatedAt:  createdAt,
		KafkaTopic: getKafkaTopic(params.KafkaTopic),
	})
	if err != nil {
		slog.Error("Failed to write simulation status", "error", err)
		return nil, err
	}

	if err := RunShellSimulation(manifest, configFile, cfg, logStore, simLogger); err != nil {
		slog.Warn("RunShellSimulation error", "error", err)
		if setStatusErr := handleError(logStore, manifest.SimulationID, kafkaTopic, err, createdAt); setStatusErr != nil {
			slog.Error("Failed to write simulation status", "error", setStatusErr)
		}
		return nil, err
	}

	slog.Info("Simulation ended")
	slog.Info("Cleaning environment")

	messages, err := logStore.GetAll(manifest.SimulationID)
	if err != nil {
		slog.Error("failed to retrieve all messages", "error", err)
		if setStatusErr := handleError(logStore, manifest.SimulationID, kafkaTopic, err, createdAt); setStatusErr != nil {
			slog.Error("Failed to write simulation status", "error", setStatusErr)
		}
	}
	if len(messages) == 0 {
		slog.Warn("no messages retrieved to store in simulation.json")
	}
	finalStatus := logstore.SimulationStatus{
		Status:       "completed",
		CreatedAt:    createdAt,
		EndedAt:      time.Now().UnixMicro(),
		ErrorMessage: "",
		KafkaTopic:   kafkaTopic,
		Messages:     messages,
	}
	err = logStore.SetStatus(manifest.SimulationID, finalStatus)
	if err != nil {
		slog.Error("Failed to write final simulation status", "error", err)
	}

	if err := logStore.DeleteAllLog(manifest.SimulationID); err != nil {
		slog.Warn("Failed to delete all.log", "simulationId", manifest.SimulationID, "error", err)
	}

	if err := CleanupKafka(*params.KafkaAddress, kafkaTopic); err != nil {
		return nil, fmt.Errorf("error during cleanup: %w", err)
	}

	slog.Info("Done")
	return &finalStatus, nil
}

func CleanupKafka(kafkaConnStr string, kafkaTopic string) error {
	if kafkaConnStr != "" && kafkaTopic != "" {
		if err := DeleteTopic(kafkaConnStr, kafkaTopic); err != nil {
			return err
		}
	}
	return nil
}

func getKafkaTopic(topic *string) string {
	if topic != nil {
		return *topic
	}
	return ""
}
