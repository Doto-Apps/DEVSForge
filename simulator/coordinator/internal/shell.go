package internal

import (
	"context"
	shared "devsforge-shared"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
)

func RunShellSimulation(manifest shared.RunnableManifest, configFile *os.File, cfg *CoordConfig) error {
	log.Printf("Launching %d runners using shell...\n", len(manifest.Models))
	errCh := make(chan error, len(manifest.Models))
	// Pour dev je recupere le dossier parent et je fais direct un go run
	// Faudra modifier pour utiliser le binaire directement
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	parent := filepath.Dir(cwd)

	runnerStates := make(map[string]*RunnerState)
	for _, m := range manifest.Models {
		runnerStates[m.ID] = &RunnerState{
			ID:       m.ID,
			NextTime: math.Inf(1),
			HasInit:  false,
			Inbox:    nil,
		}
	}

	// lance les runner
	for _, model := range manifest.Models {
		go func(m *shared.RunnableModel) {
			tmpFile, err := GenerateJSONRunnerManifest(m, manifest.Count, manifest.SimulationID)
			if err != nil {
				errCh <- err
				return
			}
			cmd := exec.Command("go", "run", "simulator/runner/main.go", "--file", tmpFile.Name(), "--config", configFile.Name())
			cmd.Dir = parent

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
	log.Println("All Model started, lauching coordinator main loop")
	if err := coordinator.RunCoordinator(&manifest); err != nil {
		return fmt.Errorf("coordination error: %w", err)
	}

	// Attente de la fin de tout les runner
	for range manifest.Models {
		if err := <-errCh; err != nil {
			fmt.Println("❌ Runner failed:", err)
		}
	}
	return nil
}
