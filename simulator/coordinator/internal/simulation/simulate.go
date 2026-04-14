package simulation

import (
	"devsforge-coordinator/internal/config"
	"devsforge-coordinator/internal/logstore"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/logger"
	"devsforge-shared/utils"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

func RunSimulation(params types.SimulationParams) error {
	manifest, err := CreateManifest(params.Json, params.File)
	if err != nil {
		return err
	}

	if len(manifest.Models) == 0 {
		return fmt.Errorf("no models provided in the manifest")
	}

	logDir := config.Get().Log.Dir

	logStore := logstore.NewFileLogStore(logDir)
	createdAt := time.Now().Unix()

	simLogger, err := logStore.GetLogger(manifest.SimulationID)
	if err != nil {
		return fmt.Errorf("failed to create simulation logger: %w", err)
	}

	err = logStore.SetStatus(manifest.SimulationID, logstore.SimulationStatus{
		Status:     "running",
		CreatedAt:  createdAt,
		KafkaTopic: getKafkaTopic(params.KafkaTopic),
	})
	if err != nil {
		slog.Warn("Failed to write simulation status", "error", err)
	}

	logCfg := logger.DefaultConfig(manifest.SimulationID)
	logCfg.LogDir = logDir

	logInstance, err := logger.InitLogger(logCfg, "coordinator", "")
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
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
		return fmt.Errorf("failed to initialize Kafka topic: %w", err)
	}

	simRoot := config.Get().Paths.SimulatorRoot
	if simRoot == "" {
		simRoot, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
	}

	tmpBase := filepath.Join(simRoot, "tmp")
	if err := os.MkdirAll(tmpBase, 0o755); err != nil {
		return fmt.Errorf("failed to create tmp base directory %q: %w", tmpBase, err)
	}

	prefix := "devsforge_" + manifest.SimulationID + "_"
	rootDir, err := os.MkdirTemp(tmpBase, prefix)
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir with prefix %q under %q: %w", prefix, tmpBase, err)
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
		return fmt.Errorf("failed to generate runner YAML config: %w", err)
	}

	cfg := InitConfig(yamlConfig)

	if err := RunShellSimulation(manifest, configFile, cfg, logStore, simLogger); err != nil {
		slog.Info("RunShellSimulation error", "error", err)
		if setStatusErr := logStore.SetStatus(manifest.SimulationID, logstore.SimulationStatus{
			Status:       "failed",
			CreatedAt:    createdAt,
			EndedAt:      time.Now().Unix(),
			ErrorMessage: err.Error(),
			KafkaTopic:   kafkaTopic,
		}); setStatusErr != nil {
			slog.Warn("Failed to write simulation status", "error", setStatusErr)
		}
		sendCoordinatorErrorReport(cfg, manifest.SimulationID, "COORDINATOR_SIMULATION_ERROR", err)
		return err
	}

	slog.Info("Simulation ended")
	slog.Info("Cleaning environment")

	messages, _ := logStore.GetAll(manifest.SimulationID)
	err = logStore.SetStatus(manifest.SimulationID, logstore.SimulationStatus{
		Status:       "completed",
		CreatedAt:    createdAt,
		EndedAt:      time.Now().Unix(),
		ErrorMessage: "",
		KafkaTopic:   kafkaTopic,
		Messages:     messages,
	})
	if err != nil {
		slog.Warn("Failed to write final simulation status", "error", err)
	}

	if err := logStore.DeleteAllLog(manifest.SimulationID); err != nil {
		slog.Warn("Failed to delete all.log", "simulationId", manifest.SimulationID, "error", err)
	}

	if err := CleanupKafka(*params.KafkaAddress, kafkaTopic); err != nil {
		return fmt.Errorf("error during cleanup: %w", err)
	}
	// Disable actually we need a better way to delete the simulation files
	// if err = os.RemoveAll(rootDir); err != nil {
	// 	slog.Error("Cannot remove simulation rootDir", "error", err)
	// }

	slog.Info("Done")
	return nil
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
