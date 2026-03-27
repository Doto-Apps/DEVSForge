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
	runnerCmd := os.Getenv("RUNNER_CMD")

	// Set simulator folder
	simulatorRootDir := os.Getenv(utils.EnvSimulatorRoot)
	if simulatorRootDir == "" {
		var err error
		simulatorRootDir, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
		log.Printf("Using simulator folder : %s", simulatorRootDir)
	}

	// Check runner command
	runnerDir := filepath.Join(simulatorRootDir, "runner")
	if runnerCmd != "" {
		log.Printf("Launching runners using %s command\n", runnerCmd)
	} else {
		log.Printf("Launching runners using go run inside %s directory\n", runnerDir)
		if _, err := os.Stat(filepath.Join(runnerDir, "main.go")); err != nil {
			return fmt.Errorf("main.go not found in %s", runnerDir)
		}
	}

	// Building initial runner states
	runnerStates := make(map[string]*RunnerState)
	for _, m := range manifest.Models {
		runnerStates[m.ID] = &RunnerState{
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

	coordinator := CreateCoordinnator(cfg, context.Background(), runnerStates)
	log.Println("All models started, launching coordinator main loop")

	if err := coordinator.RunCoordinator(&manifest); err != nil {
		return fmt.Errorf("coordination error: %w", err)
	}

	for range manifest.Models {
		if err := <-errCh; err != nil {
			fmt.Println("Runner failed:", err)
			return fmt.Errorf("runner failure: %w", err)
		}
	}

	return nil
}
