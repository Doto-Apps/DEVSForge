// Package tests provides integration tests for the coordinator.
package tests

import (
	"context"
	"devsforge-shared/utils"
	"errors"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

var (
	SimRoot   string
	KafkaAddr = "localhost:9092"

	ErrSimulationDone = errors.New("simulation completed normally")
	Sender            = "fakecoordinator"

	// Global compose stack to ensure we can stop it reliably.
	stack *tccompose.DockerCompose
)

func TestMain(m *testing.M) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var err error
	SimRoot, err = utils.SimulatorRoot()
	if err != nil {
		log.Fatalf("Failed to locate simulator root: %v", err)
	}

	if err := os.Chdir(SimRoot); err != nil {
		log.Fatalf("Failed to chdir to simulator root %q: %v", SimRoot, err)
	}

	// Expose simulator root to subprocesses (runner via exec.Command).
	if err := os.Setenv(utils.EnvSimulatorRoot, SimRoot); err != nil {
		log.Fatalf("Failed to set %s: %v", utils.EnvSimulatorRoot, err)
	}

	composeFile := filepath.Join(SimRoot, "tests", "docker-compose.yml")
	if _, err := os.Stat(composeFile); err != nil {
		log.Fatalf("docker-compose file not found: %q: %v", composeFile, err)
	}

	stack, err = tccompose.NewDockerCompose(composeFile)
	if err != nil {
		log.Fatalf("Failed to create compose stack: %v", err)
	}

	// Handle SIGINT/SIGTERM so the Docker stack is stopped on Ctrl+C.
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("Interrupt received, shutting down Docker stack...")
		teardownGlobal(ctx)
		os.Exit(1)
	}()

	log.Println("Starting Docker stack...")
	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		log.Fatalf("Compose up failed: %v", err)
	}
	log.Println("Docker stack started.")

	exitCode := m.Run()

	teardownGlobal(ctx)

	os.Exit(exitCode)
}

func teardownGlobal(ctx context.Context) {
	if stack == nil {
		return
	}
	log.Println("Stopping Docker stack...")
	if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
		log.Printf("Stack down error: %v", err)
	}
}

// setupTest creates a per-test temp directory under <SimRoot>/tmp and schedules cleanup.
func setupTest(t *testing.T) string {
	t.Helper()

	tmpDir, err := utils.CreateTempDir(SimRoot)
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}

	t.Cleanup(func() {
		_ = os.RemoveAll(tmpDir)
	})

	return tmpDir
}
