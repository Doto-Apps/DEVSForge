// Package tests provides integration tests for the coordinator.
package tests

import (
	"context"
	baseLog "log"
	"os"
	"path/filepath"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

func TestMain(m *testing.M) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	log := baseLog.New(os.Stdout, "", 0)

	composeFile := filepath.Join("testdata", "docker-compose.yml")
	if _, err := os.Stat(composeFile); err != nil {
		log.Fatalf("docker-compose file not found: %q: %v", composeFile, err)
	}

	stack, err := tccompose.NewDockerCompose(composeFile)
	if err != nil {
		log.Fatalf("Failed to create compose stack: %v", err)
	}

	log.Println("Starting Docker stack...")
	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		log.Fatalf("Compose up failed: %v", err)
	}
	log.Println("Docker stack started.")

	exitCode := m.Run()

	log.Println("Stopping Docker stack...")
	if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
		log.Printf("Stack down error: %v", err)
	}

	os.Exit(exitCode)
}
