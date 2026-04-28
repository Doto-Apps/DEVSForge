// Package tests provides integration tests for the runner.
package tests

//
import (
	"context"
	"devsforge-shared/kafka"
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
	KafkaAddr = func() string {
		if addr := os.Getenv("KAFKA_ADDRESS"); addr != "" {
			return addr
		}
		return "localhost:9092"
	}()

	ErrSimulationDone = errors.New("simulation completed normally")
	Sender            = kafka.CoordinatorId

	// Global compose stack to ensure we can stop it reliably.
	stack *tccompose.DockerCompose
)

func TestMain(m *testing.M) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var err error
	err = os.Setenv("LOG_MODE", "console")
	if err != nil {
		log.Fatalf("Cannot set LOG_MODE env var: %v", err)
	}

	composeFile := filepath.Join("testdata", "docker-compose.yml")
	if _, err := os.Stat(composeFile); err != nil {
		log.Fatalf("docker-compose file not found: %q: %v", composeFile, err)
	}

	stack, err = tccompose.NewDockerCompose(composeFile)
	if err != nil {
		log.Fatalf("Failed to create compose stack: %v", err)
	}
	log.Println("Ensure docker compose is down")
	if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
		log.Printf("Stack down error: %v", err)
	}

	log.Println("Starting Docker stack...")
	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		log.Fatalf("Compose up failed: %v", err)
	}
	log.Println("Docker stack started.")

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("Interrupt received, shutting down Docker stack...")
		if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
			log.Printf("Stack down error: %v", err)
		}
		os.Exit(1)
	}()

	defer func() {
		log.Println("Stopping Docker stack...")
		if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
			log.Printf("Stack down error: %v", err)
		}
	}()

	exitCode := m.Run()

	if stack == nil {
		return
	}

	os.Exit(exitCode)
}
