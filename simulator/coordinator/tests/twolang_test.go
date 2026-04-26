package tests

import (
	"devsforge-coordinator/internal/simulation"
	"devsforge-coordinator/internal/types"
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestRunWithFileKafka(t *testing.T) {
	manifestPath := filepath.Join("testdata", "multi_language", "runnable_manifest.json")

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
		Json:         &jsonStr,
		KafkaTopic:   &kafkaTopic,
		KafkaAddress: &KafkaAddr,
	})
	if err != nil {
		t.Fatalf("Simulation failed: %v", err)
	}
}
