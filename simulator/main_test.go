package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

func TestRunWithFileKafka(t *testing.T) {
	ctx := context.Background()
	composeFile := "../tests/docker-compose.yml"

	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		t.Skipf("docker-compose file %s not found, skipping test", composeFile)
	}

	stack, err := tccompose.NewDockerCompose(
		composeFile,
	)
	if err != nil {
		t.Fatalf("could not create compose stack: %v", err)
	}

	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		t.Fatalf("compose up failed: %v", err)
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal)
		os.Exit(1)
	}()

	defer stack.Down(ctx, tccompose.RemoveOrphans(true))
	t.Log("Kafka started...")

	// JSON statique pour tester
	jsonContent, err := os.ReadFile("test/manifest.json")
	if err != nil {
		t.Fatalf("Error while reading test manifest\n %v", err)
	}
	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	os.Setenv("KAFKA_TOPIC", "sim-test")
	err = run([]string{"--file", jsonPath, "--kafka", "localhost:9092"})
	if err != nil {
		t.Fatalf("expected no error, got\n %v", err)
	}
}
