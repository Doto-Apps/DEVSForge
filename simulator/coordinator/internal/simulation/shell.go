// Package simulation provides simulation execution and coordination logic.
package simulation

import (
	"context"
	"devsforge-coordinator/internal/config"
	"devsforge-coordinator/internal/logstore"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
)

func RunShellSimulation(manifest shared.RunnableManifest, configFile *os.File, coordCfg *types.CoordinatorConfig, logStore logstore.LogStore, logger *slog.Logger) error {
	slog.Info("Launching runners using shell", "count", len(manifest.Models), "loggerIsNil", logger == nil)
	errCh := make(chan error, len(manifest.Models)+1) // +1 for coordinator
	runnerCmd := config.Get().Paths.RunnerCmd

	// Check runner command
	if runnerCmd == "" {
		return fmt.Errorf("runner command not provided")
	}
	if _, err := os.Stat(runnerCmd); err != nil {
		return fmt.Errorf("cannot stat on runnerCmd: %s: %w", runnerCmd, err)
	}

	// Building initial runner states
	runnerStates := make(map[string]*types.RunnerState)
	for _, m := range manifest.Models {
		runnerStates[m.ID] = &types.RunnerState{
			ID:               m.ID,
			NextInternalTime: math.Inf(1),
			HasInit:          false,
			InPorts:          make([]*kafka.KafkaMessagePortPayload, 0),
		}
	}

	for _, model := range manifest.Models {
		go func(m *shared.RunnableModel) {
			tmpFile, err := GenerateJSONRunnerManifest(m, manifest.Count, manifest.SimulationID)
			if err != nil {
				errCh <- err
				return
			}

			cmd := exec.Command(runnerCmd,
				"--file", tmpFile.Name(),
				"--config", configFile.Name(),
			)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			slog.Info("Launch runner", "model", m.ID)
			if err := cmd.Run(); err != nil {
				slog.Error("Runner error", "model", m.ID, "error", err)
				errCh <- fmt.Errorf("error launching runner %s : %w", m.ID, err)
				return
			}
			errCh <- nil
		}(model)
	}

	// Launch coordinator in a goroutine
	go func() {
		coordinator := CreateCoordinnator(coordCfg, context.Background(), runnerStates)
		coordinator.Logger = logger
		slog.Info("All models started, launching coordinator main loop")

		if err := coordinator.RunCoordinator(&manifest); err != nil {
			errCh <- fmt.Errorf("coordination error: %w", err)
		} else {
			errCh <- nil
		}
	}()

	// Wait for all runners + coordinator to complete
	totalTasks := len(manifest.Models) + 1 // runners + coordinator
	for i := 0; i < totalTasks; i++ {
		if err := <-errCh; err != nil {
			slog.Error("Simulation failed", "error", err)
			return fmt.Errorf("simulation error: %w", err)
		}
	}

	return nil
}
