package tests

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"devsforge-coordinator/internal/simulation"
	"devsforge-coordinator/internal/types"
)

func TestRunWithFileKafka(t *testing.T) {
	setupTest(t)

	manifestPath := filepath.Join(SimRoot, "coordinator", "tests", "testdata", "multi_language", "manifest.json")

	manifest, err := LoadManifestWithCode(manifestPath)
	if err != nil {
		t.Fatalf("Failed to load manifest: %v", err)
	}

	jsonBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Failed to marshal manifest: %v", err)
	}
	jsonStr := string(jsonBytes)

	kafkaTopic := "test-multi-lang"

	err = simulation.RunSimulation(types.SimulationParams{
		Json:       &jsonStr,
		KafkaTopic: &kafkaTopic,
	})

	if err != nil {
		t.Fatalf("Simulation failed: %v", err)
	}
}
