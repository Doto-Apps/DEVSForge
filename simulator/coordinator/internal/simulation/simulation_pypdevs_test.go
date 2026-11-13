package simulation

import (
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// Several outputs and two simultaneous senders must become one complete input
// bag in one external transition. Duplicate messages and list payloads survive.
func TestMixedFrameworksWithPyPDEVSBags(t *testing.T) {
	manifest, err := loadManifestWithCode(filepath.Join("testdata", "multi_language", "runnable_manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	goSender := manifest.Models[0]
	goSender.Connections = []shared.RunnableModelConnection{{From: shared.ModelLink{ID: goSender.ID, Port: "out"}, To: shared.ModelLink{ID: "bag-collector", Port: "in"}}}
	manifest.Models = []*shared.RunnableModel{goSender}
	for _, fixture := range []struct{ id, file string }{{"bag-source", "PyPDEVSBagSource.py"}, {"bag-collector", "PyPDEVSBagCollector.py"}} {
		code, err := os.ReadFile(filepath.Join("testdata", "multi_language", fixture.file))
		if err != nil {
			t.Fatal(err)
		}
		m := &shared.RunnableModel{ID: fixture.id, Name: fixture.id, Code: string(code), Language: "python", IntegrationID: "devsimpy-python", IntegrationVersion: "1.0.0",
			Ports: []shared.RunnableModelPort{{ID: "out", Name: "out", Type: "out"}}}
		if fixture.id == "bag-source" {
			m.Connections = []shared.RunnableModelConnection{{From: shared.ModelLink{ID: m.ID, Port: "out"}, To: shared.ModelLink{ID: "bag-collector", Port: "in"}}}
		} else {
			m.Ports = append(m.Ports, shared.RunnableModelPort{ID: "in", Name: "in", Type: "in"})
		}
		manifest.Models = append(manifest.Models, m)
	}
	manifest.SimulationID = "mixed-pypdevs-bags"
	manifest.Count = len(manifest.Models)
	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	jsonStr, topic := string(data), "test-"+manifest.SimulationID
	result, err := RunSimulation(types.SimulationParams{Json: &jsonStr, KafkaTopic: &topic, KafkaAddress: &KafkaAddr})
	if err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, message := range result.Messages {
		output, ok := message.Data.(*kafka.KafkaMessageOutputReport)
		if !ok || output.SenderID != "bag-collector" {
			continue
		}
		for _, port := range output.Payload.Outputs {
			payload, ok := port.Value.(map[string]any)
			if !ok || payload["calls"] != float64(1) {
				t.Fatalf("input bag was split into multiple transitions: %+v", port.Value)
			}
			values, ok := payload["values"].([]any)
			if !ok || len(values) != 4 {
				t.Fatalf("input bag lost messages: %+v", payload)
			}
			counts := map[string]int{}
			for _, value := range values {
				b, err := json.Marshal(value)
				if err != nil {
					t.Fatal(err)
				}
				counts[string(b)]++
			}
			if counts[`{"value":2}`] != 2 || counts[`{"value":5}`] != 1 || counts[`[4,5]`] != 1 {
				t.Fatalf("bag changed payloads or duplicates: %+v", counts)
			}
			seen++
		}
	}
	if seen != 1 {
		t.Fatalf("expected exactly one collector output, got %d", seen)
	}
}
