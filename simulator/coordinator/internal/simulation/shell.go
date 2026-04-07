// Package simulation provides simulation execution and coordination logic.
package simulation

import (
	"context"
	"devsforge-coordinator/internal/config"
	"devsforge-coordinator/internal/logstore"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"path/filepath"
)

func RunShellSimulation(manifest shared.RunnableManifest, configFile *os.File, coordCfg *types.CoordConfig, logStore logstore.LogStore, logger *slog.Logger) error {
	slog.Info("Launching runners using shell", "count", len(manifest.Models), "loggerIsNil", logger == nil)
	errCh := make(chan error, len(manifest.Models))
	runnerCmd := config.Get().Paths.RunnerCmd

	// Set simulator folder
	simulatorRootDir := config.Get().Paths.SimulatorRoot
	if simulatorRootDir == "" {
		var err error
		simulatorRootDir, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
		slog.Info("Using simulator folder", "path", simulatorRootDir)
	}

	// Check runner command
	runnerDir := filepath.Join(simulatorRootDir, "runner")
	if runnerCmd != "" {
		slog.Info("Launching runners using command", "command", runnerCmd)
	} else {
		slog.Info("Launching runners using go run", "directory", runnerDir)
		if _, err := os.Stat(filepath.Join(runnerDir, "main.go")); err != nil {
			return fmt.Errorf("main.go not found in %s", runnerDir)
		}
	}

	// Building initial runner states
	runnerStates := make(map[string]*types.RunnerState)
	for _, m := range manifest.Models {
		runnerStates[m.ID] = &types.RunnerState{
			ID:       m.ID,
			NextTime: math.Inf(1),
			HasInit:  false,
			Inbox:    nil,
		}
	}

	for _, model := range manifest.Models {
		go func(m *shared.RunnableModel) {
			tmpFile, err := GenerateJSONRunnerManifest(m, manifest.Count, manifest.SimulationID)
			if err != nil {
				errCh <- err
				return
			}

			var cmd *exec.Cmd
			if runnerCmd != "" {
				cmd = exec.Command(runnerCmd,
					"--file", tmpFile.Name(),
					"--config", configFile.Name(),
				)
			} else {
				// Run from runner directory so Go can find the module
				runnerDir := filepath.Join(simulatorRootDir, "runner")
				cmd = exec.Command("go", "run", ".",
					"--file", tmpFile.Name(),
					"--config", configFile.Name(),
				)
				cmd.Dir = runnerDir
			}
			cmd.Env = append(os.Environ(), utils.EnvSimulatorRoot+"="+simulatorRootDir)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				errCh <- fmt.Errorf("error launching runner %s : %w", m.ID, err)
				return
			}
			errCh <- nil
		}(model)
	}

	coordinator := CreateCoordinnator(coordCfg, context.Background(), runnerStates)
	coordinator.Logger = logger
	slog.Info("All models started, launching coordinator main loop")

	if err := coordinator.RunCoordinator(&manifest); err != nil {
		return fmt.Errorf("coordination error: %w", err)
	}

	for range manifest.Models {
		if err := <-errCh; err != nil {
			slog.Error("Runner failed", "error", err)
			return fmt.Errorf("runner failure: %w", err)
		}
	}

	return nil
}
