package tests

import (
	"devsforge-coordinator/internal"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestRunWithFileKafka(t *testing.T) {

	// ============================
	// Manifest avec M1 (PY) + M2 (GO)
	// ============================

	var manifest shared.RunnableManifest

	// Code du modèle Python (m1.py)
	pyCode, err := os.ReadFile("../../tests/m1py/m1.py")
	if err != nil {
		t.Fatalf("Error while reading python model code\n %v", err)
	}

	// Code du collecteur Go (m2.go)
	goCollectorCode, err := os.ReadFile("../../tests/m2go/m2.go")
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
				"id": "m1go",
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
				"id": "m2go",
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
