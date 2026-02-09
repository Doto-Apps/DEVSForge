package tests

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"devsforge-coordinator/internal"
	shared "devsforge-shared"
	"devsforge-shared/utils"
)

func TestRunWithFileKafka(t *testing.T) {
	t.Helper()

	// Keep all temp files under simulator/tmp.
	tmpDir := setupTest(t)

	var manifest shared.RunnableManifest

	pyPath := filepath.Join(SimRoot, "tests", "m1py", "m1.py")
	pyCode, err := os.ReadFile(pyPath)
	if err != nil {
		t.Fatalf("Failed to read python model code %q: %v", pyPath, err)
	}

	goPath := filepath.Join(SimRoot, "tests", "m2go", "m2.go")
	goCollectorCode, err := os.ReadFile(goPath)
	if err != nil {
		t.Fatalf("Failed to read go collector code %q: %v", goPath, err)
	}

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

	if err := utils.ParseManifest(jsonContent, &manifest); err != nil {
		t.Fatalf("Failed to parse test manifest: %v", err)
	}

	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0o644); err != nil {
		t.Fatalf("Failed to write temp manifest %q: %v", jsonPath, err)
	}

	// Kafka topic used by coordinator/runners.
	prevTopic := os.Getenv("KAFKA_TOPIC")
	_ = os.Setenv("KAFKA_TOPIC", "sim-test")
	t.Cleanup(func() {
		_ = os.Setenv("KAFKA_TOPIC", prevTopic)
	})

	if err := internal.RunSimulation([]string{"--file", jsonPath, "--kafka", KafkaAddr}); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
}
