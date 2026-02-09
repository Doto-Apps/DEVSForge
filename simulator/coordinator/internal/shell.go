package internal

import (
	"context"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
)

func RunShellSimulation(manifest shared.RunnableManifest, configFile *os.File, cfg *CoordConfig) error {
	log.Printf("Launching %d runners using shell...", len(manifest.Models))
	errCh := make(chan error, len(manifest.Models))

	// Resolve simulator root in a deterministic way.
	simDir := os.Getenv(utils.EnvSimulatorRoot)
	if simDir == "" {
		var err error
		simDir, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
	}

	// Validate runner entrypoint early to avoid confusing runtime failures.
	runnerMain := filepath.Join(simDir, "runner", "main.go")
	if _, err := os.Stat(runnerMain); err != nil {
		return fmt.Errorf("runner entrypoint not found: %q: %w", runnerMain, err)
	}

	runnerStates := make(map[string]*RunnerState)
	for _, m := range manifest.Models {
		runnerStates[m.ID] = &RunnerState{
			ID:       m.ID,
			NextTime: math.Inf(1),
			HasInit:  false,
			Inbox:    nil,
		}
	}

	log.Printf("Using simulator root: %s", simDir)

	for _, model := range manifest.Models {
		go func(m *shared.RunnableModel) {
			tmpFile, err := GenerateJSONRunnerManifest(m, manifest.Count, manifest.SimulationID)
			if err != nil {
				errCh <- err
				return
			}

			// Run from runner directory so Go can find the module
			runnerDir := filepath.Join(simDir, "runner")
			cmd := exec.Command("go", "run", ".",
				"--file", tmpFile.Name(),
				"--config", configFile.Name(),
			)
			cmd.Dir = runnerDir
			cmd.Env = append(os.Environ(), utils.EnvSimulatorRoot+"="+simDir)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				errCh <- fmt.Errorf("error launching runner %s via go run: %w", m.ID, err)
				return
			}
			errCh <- nil
		}(model)
	}

	coordinator := CreateCoordinnator(cfg, context.Background(), runnerStates)
	log.Println("All models started, launching coordinator main loop")

	if err := coordinator.RunCoordinator(&manifest); err != nil {
		return fmt.Errorf("coordination error: %w", err)
	}

	for range manifest.Models {
		if err := <-errCh; err != nil {
			fmt.Println("Runner failed:", err)
		}
	}

	return nil
}
