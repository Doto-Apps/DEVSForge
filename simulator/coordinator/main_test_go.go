package main

import (
	"context"
	"devsforge/simulator/coordinator/internal"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

func TestRunWithFileKafkaOnlyWithGO(t *testing.T) {
	ctx := context.Background()
	composeFile := "tests/docker-compose.yml"

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

	// ============================
	// Manifest avec GEN + COLLECTOR
	// ============================

	var manifest shared.RunnableManifest

	// Code du générateur (ton m1.go)
	genCode, err := os.ReadFile("tests/m1/m1.go")
	if err != nil {
		t.Fatalf("Error while reading generator code\n %v", err)
	}

	// Code du collecteur (m2.go qu'on vient de créer)
	collectorCode, err := os.ReadFile("tests/m2/m2.go")
	if err != nil {
		t.Fatalf("Error while reading collector code\n %v", err)
	}

	// Manifest JSON :
	// - modèle "gen" avec port "out"
	// - modèle "collector" avec port "in"
	// - une connexion gen.out -> collector.in
	jsonContent := fmt.Sprintf(`{
		"models": [
			{
				"language": "go",
				"id": "gen",
				"name": "GeneratorIncremental",
				"code": %q,
				"ports": [
					{ "id": "out", "type": "out" }
				],
				"connections": [
					{
						"from": { "id": "gen", "port": "out" },
						"to":   { "id": "collector", "port": "in" }
					}
				]
			},
			{
				"language": "go",
				"id": "collector",
				"name": "Collector",
				"code": %q,
				"ports": [
					{ "id": "in", "type": "in" }
				],
				"connections": []
			}
		],
		"count": 1,
		"simulationId": "test"
	}`, string(genCode), string(collectorCode))

	// On parse le manifest pour vérifier qu'il est bien formé
	if err := utils.ParseManifest(jsonContent, &manifest); err != nil {
		t.Fatalf("Error while parsing test manifest\n %v", err)
	}

	// On écrit le manifest JSON dans un fichier temporaire
	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	// Topic Kafka utilisé par le coordi / runners
	os.Setenv("KAFKA_TOPIC", "sim-test")

	// Lancement du simulateur avec le manifest et l'endpoint Kafka
	err = internal.RunSimulation([]string{"--file", jsonPath, "--kafka", "localhost:9092"})
	if err != nil {
		t.Fatalf("expected no error, got\n %v", err)
	}
}
