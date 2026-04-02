package cmd

import (
	"context"
	"devsforge-runner/internal"
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-shared/logger"
	"devsforge-shared/utils"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	shared "devsforge-shared"
	kafkaShared "devsforge-shared/kafka"

	"github.com/twmb/franz-go/pkg/kgo"
)

func LaunchRunner(args []string) error {
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("config", "", "Path to YAML config file")

	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("error parsing flags: %w", err)
	}
	if *configFile == "" {
		return fmt.Errorf("no config file provided")
	}

	var manifest shared.RunnableManifest
	if *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if *filePath != "" {
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
	logDir := os.Getenv("LOG_DIR")
	if logDir == "" {
		logDir = "logs"
	}

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
		slog.Info("Cleaning up")
		if err := wrapper.Cleanup(); err != nil {
			slog.Error("Cleanup error", "error", err)
		}
	}()

	slog.Info("Using language wrapper", "language", manifest.Models[0].Language)
	switch manifest.Models[0].Language {
	case "go":
		if err := generators.PrepareGoWraper(wrapper, manifest); err != nil {
			emitRunnerErrorReport(wrapper.Cfg, "RUNNER_PREPARE_GO_ERROR", err)
			return err
		}
	case "python":
		if err := generators.PreparePythonWraper(wrapper, manifest); err != nil {
			emitRunnerErrorReport(wrapper.Cfg, "RUNNER_PREPARE_PYTHON_ERROR", err)
			return err
		}
	case "java":
		if err := generators.PrepareJavaWrapper(wrapper, manifest); err != nil {
			emitRunnerErrorReport(wrapper.Cfg, "RUNNER_PREPARE_JAVA_ERROR", err)
			return err
		}
	default:
		err := fmt.Errorf("runner cannot handle language %s", manifest.Models[0].Language)
		emitRunnerErrorReport(wrapper.Cfg, "RUNNER_UNSUPPORTED_LANGUAGE", err)
		return err
	}

	if err := internal.LaunchSim(wrapper); err != nil {
		return err
	}

	slog.Info("Simulation ended successfully")
	return nil
}

func emitRunnerErrorReport(cfg *config.RunnerConfig, errorCode string, sourceErr error) {
	if sourceErr == nil || cfg == nil || cfg.KafkaClient == nil || cfg.Model == nil {
		return
	}
	if errorCode == "" {
		errorCode = "RUNNER_ERROR"
	}

	report := kafkaShared.NewErrorReportMessage(
		cfg.SimulationID,
		cfg.ID,
		"Coordinator",
		"Runner",
		cfg.Model.ID,
		"fatal",
		errorCode,
		sourceErr.Error(),
		nil,
		nil,
	)

	data, err := report.Marshal()
	if err != nil {
		slog.Error("Failed to marshal runner ErrorReport", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := cfg.KafkaClient.ProduceSync(ctx, &kgo.Record{Value: data}).FirstErr(); err != nil {
		slog.Error("Failed to publish runner ErrorReport", "error", err)
	}
}
