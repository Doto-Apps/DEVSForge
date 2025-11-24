package main

import (
	"context"
	"devsforge-coordinator/internal"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

func TestRunWithFileKafka(t *testing.T) {
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
	// Manifest avec M1 (PY) + M2 (GO)
	// ============================

	var manifest shared.RunnableManifest

	// Code du modèle Python (m1.py)
	pyCode, err := os.ReadFile("tests/m1/m1.py")
	if err != nil {
		t.Fatalf("Error while reading python model code\n %v", err)
	}

	// Code du collecteur Go (m2.go)
	goCollectorCode, err := os.ReadFile("tests/m2/m2.go")
	if err != nil {
		t.Fatalf("Error while reading go collector code\n %v", err)
	}

	// Manifest JSON :
	// - modèle "m1" (python) avec port "out"
	// - modèle "m2" (go) avec port "in"
	// - connexion m1.out -> m2.in
	jsonContent := fmt.Sprintf(`{
		"models": [
			{
				"language": "python",
				"id": "m1",
				"name": "GeneratorIncremental",
				"code": %q,
				"ports": [
					{ "id": "out", "type": "out" }
				],
				"connections": [
					{
						"from": { "id": "m1", "port": "out" },
						"to":   { "id": "m2", "port": "in" }
					}
				]
			},
			{
				"language": "go",
				"id": "m2",
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
	}`, string(pyCode), string(goCollectorCode))

	// Vérifie que le manifest est bien formé
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
