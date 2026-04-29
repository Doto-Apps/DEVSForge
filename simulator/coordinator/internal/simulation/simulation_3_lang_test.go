package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-coordinator/testsutils"
	"encoding/json"
	"path/filepath"
	"testing"

	"gotest.tools/v3/golden"
)

func Test3Lang(t *testing.T) {
	manifestPath := filepath.Join("testdata", "multi_language", "runnable_manifest.json")

	manifest, err := testsutils.LoadManifestWithCode(manifestPath)
	if err != nil {
		t.Fatalf("Failed to load manifest: %v", err)
	}

	jsonBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Failed to marshal manifest: %v", err)
	}
	jsonStr := string(jsonBytes)

	kafkaTopic := "test-multi-lang"

	if status, err := RunSimulation(types.SimulationParams{
		Json:         &jsonStr,
		KafkaTopic:   &kafkaTopic,
		KafkaAddress: &KafkaAddr,
	}); err != nil {
		t.Fatalf("Simulation failed: %v", err)
	} else {
		t.Log("Check simulation.json golden")
		status.CreatedAt = 1
		status.EndedAt = 1
		data, err := json.MarshalIndent(&status, " ", "  ")
		if err != nil {
			t.Fatalf("cannot marshal simulation status")
		}

		// Normaliser les messageId pour des tests déterministes
		normalized := testsutils.NormalizeMessageIds(data)

		goldenPath := filepath.Join("multi_language", "simulation.golden.json")
		golden.Assert(t, string(normalized), goldenPath)

	}
}
