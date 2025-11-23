// main_test.go — dans runners/go/
package tests

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"testing"
	"time"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

var KafkaAddr = "localhost:9092"
var TmpDirectory = "./tmp"

// TestLaunchRunnerWithKafka démarre Kafka via docker-compose, puis lance UN runner
// avec un manifest JSON (contenant ton DumbModel) + un YAML de config généré.
func TestMain(m *testing.M) {

	ctx := context.Background()

	// ⚠️ Adapte le chemin si ton docker-compose n'est pas là.
	composeFile := "../../tests/docker-compose.yml"

	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		log.Fatalf("docker-compose file %s not found, skipping test", composeFile)
	}

	// 1️⃣ Démarrer Kafka avec testcontainers-go
	stack, err := tccompose.NewDockerCompose(
		composeFile,
	)

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal)
		cleanup()
		os.Exit(1)
	}()

	defer func() {
		if err := stack.Down(ctx, tccompose.RemoveOrphans(true)); err != nil {
			log.Fatalf("compose down returned error: %v", err)
		}
		cleanup()
	}()

	if err != nil {
		log.Fatalf("could not create compose stack: %v", err)
	}

	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		log.Fatalf("compose up failed: %v", err)

	}

	// Gestion propre du Ctrl+C pendant le test

	log.Println("✅ Kafka started for runner test...")

	tests := m.Run()

	// 3) Teardown global : stopper le container, fermer les connexions, etc.

	os.Exit(tests)
}

func cleanup() {
	// Réessayer plusieurs fois avec backoff (au cas où)
	var lastErr error
	for i := range 5 {
		if i > 0 {
			delay := time.Duration(i*300) * time.Millisecond
			time.Sleep(delay)
			log.Printf("Retrying cleanup (attempt %d/5)...", i+1)
		}

		if err := os.RemoveAll(TmpDirectory); err != nil {
			lastErr = err
			continue
		}

		log.Printf("🧹 temp dir %s removed", TmpDirectory)
		lastErr = nil
		break
	}

	if lastErr != nil {
		// Si échec après 5 tentatives, logger mais ne pas bloquer
		log.Printf("⚠️ Could not remove temp dir %s after 5 attempts: %v", TmpDirectory, lastErr)
		log.Printf("   Directory will be reused on next run")

	}
}
