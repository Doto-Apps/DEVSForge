package tests

import (
	"devsforge-coordinator/internal/simulation"
	"devsforge-coordinator/internal/types"
	"devsforge-shared/kafka"
	"encoding/json"
	"path/filepath"
	"testing"

	"gotest.tools/v3/golden"
)

func TestRunWithFileKafka(t *testing.T) {
	manifestPath := filepath.Join("testdata", "multi_language", "runnable_manifest.json")

	oldGenerateUUID := kafka.GenerateMessageId
	defer func() { kafka.GenerateMessageId = oldGenerateUUID }()

	kafka.GenerateMessageId = func() string {
		return "test-uuid"
	}

	manifest, kafkaAddr, err := LoadManifestWithCode(manifestPath)
	if err != nil {
		t.Fatalf("Failed to load manifest: %v", err)
	}

	jsonBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Failed to marshal manifest: %v", err)
	}
	jsonStr := string(jsonBytes)

	kafkaTopic := "test-multi-lang"

	if status, err := simulation.RunSimulation(types.SimulationParams{
		Json:         &jsonStr,
		KafkaTopic:   &kafkaTopic,
		KafkaAddress: &kafkaAddr,
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
		goldenPath := filepath.Join("multi_language", "simulation.golden.json")
		golden.Assert(t, string(data), goldenPath)

	}
}
