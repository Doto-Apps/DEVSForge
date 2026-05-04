// Package cmd provides command-line interface and runner execution logic.
package cmd

import (
	"devsforge-runner/internal"
	"devsforge-runner/internal/config"
	"devsforge-shared/logger"
	"devsforge-shared/utils"
	"fmt"
	"log/slog"
	"os"

	shared "devsforge-shared"
)

func LaunchRunner(jsonStr *string, configFile *string, filePath *string) error {
	if configFile == nil || *configFile == "" {
		return fmt.Errorf("no config file provided")
	}

	var manifest shared.RunnableManifest
	if jsonStr != nil && *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if filePath != nil && *filePath != "" {
		data, err := os.ReadFile(*filePath)
		if err != nil {
			return fmt.Errorf("error reading file: %w", err)
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			return fmt.Errorf("error parsing JSON file: %w", err)
		}
	} else {
		return fmt.Errorf("please provide --json or --file")
	}

	if len(manifest.Models) != 1 {
		return fmt.Errorf("manifest must contain exactly one model for a runner")
	}

	// Initialize logger
	logDir := config.Get().Env.Log.Dir

	logCfg := logger.DefaultConfig(manifest.SimulationID)
	logCfg.LogDir = logDir

	logInstance, err := logger.InitLogger(logCfg, "runner", manifest.Models[0].ID)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}
	slog.SetDefault(logInstance)

	slog.Info("Manifest validated", "model_id", manifest.Models[0].ID)

	wrapper, err := internal.PrepareGeneralWrapper(manifest, *configFile)
	if err != nil {
		return err
	}

	defer func() {
		if wrapper.Cmd != nil || wrapper.GRPCConn != nil {
			slog.Info("Cleaning up")
			if err := wrapper.Cleanup(); err != nil {
				slog.Error("Cleanup error", "error", err)
			}
		}
	}()

	slog.Info("Using language wrapper", "language", manifest.Models[0].Language)

	if manifest.Models[0] != nil {
		if err := internal.LaunchSim(manifest.Models[0].Language, wrapper, manifest); err != nil {
			return err
		}
	} else {
		slog.Error("Non model provided")
		return fmt.Errorf("no error provided")
	}

	if wrapper.Cmd != nil || wrapper.GRPCConn != nil {
		slog.Info("Cleaning up")
		if err := wrapper.Cleanup(); err != nil {
			slog.Error("Cleanup error", "error", err)
		}
	}

	slog.Info("Simulation ended successfully")
	return nil
}
