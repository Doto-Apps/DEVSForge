package internal

import (
	shared "devsforge-shared"
	"devsforge-shared/logger"
	"devsforge-shared/utils"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
)

func RunSimulation(params SimulationParams) error {
	manifest, err := CreateManifest(params.Json, params.File)
	if err != nil {
		return err
	}

	if len(manifest.Models) == 0 {
		return fmt.Errorf("no models provided in the manifest")
	}

	// Initialize logger
	logDir := os.Getenv("LOG_DIR")
	if logDir == "" {
		logDir = "logs"
	}

	logCfg := logger.DefaultConfig(manifest.SimulationID)
	logCfg.LogDir = logDir

	logInstance, err := logger.InitLogger(logCfg, "coordinator", "")
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}
	slog.SetDefault(logInstance)

	slog.Info("DEVSForge Simulator")

	kafkaTopic, err := GetKafkaTopic(*params.KafkaAddress, *params.KafkaTopic)
	if err != nil {
		return fmt.Errorf("failed to initialize Kafka topic: %w", err)
	}

	simRoot := os.Getenv(utils.EnvSimulatorRoot)
	if simRoot == "" {
		simRoot, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
	}

	// Ensure tmp base directory exists under simulator/tmp.
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

	// Pass an absolute tmp directory to runners (stable, no relative paths).
	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: *params.KafkaAddress,
			Topic:   kafkaTopic,
		},
		TmpDirectory: rootDir,
	}

	configFile, err := GenerateRunnerYamlConfig(yamlConfig)
	if err != nil {
		return fmt.Errorf("failed to generate runner YAML config: %w", err)
	}

	cfg := InitConfig(yamlConfig)

	if err := RunShellSimulation(manifest, configFile, cfg); err != nil {
		sendCoordinatorErrorReport(cfg, manifest.SimulationID, "COORDINATOR_SIMULATION_ERROR", err)
		return err
	}

	slog.Info("Simulation ended")
	slog.Info("Cleaning environment")

	if err := CleanupKafka(*params.KafkaAddress, kafkaTopic); err != nil {
		return fmt.Errorf("error during cleanup: %w", err)
	}
	if err = os.RemoveAll(rootDir); err != nil {
		slog.Error("Cannot remove simulation rootDir", "error", err)
	}

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
