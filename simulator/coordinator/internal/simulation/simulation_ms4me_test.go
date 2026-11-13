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

func TestMixedFrameworksIncludingMS4Me(t *testing.T) {
	testMixedFrameworks(t, false)
}

func TestMixedFrameworksIncludingDEVSimPy(t *testing.T) {
	testMixedFrameworks(t, true)
}

func testMixedFrameworks(t *testing.T, includeDEVSimPy bool) {
	t.Helper()
	manifest, err := loadManifestWithCode(filepath.Join("testdata", "multi_language", "runnable_manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	code, err := os.ReadFile(filepath.Join("testdata", "multi_language", "Ms4Collector.java"))
	if err != nil {
		t.Fatal(err)
	}
	manifest.SimulationID = "mixed-frameworks-ms4me"
	java := manifest.Models[2]
	java.Connections = []shared.RunnableModelConnection{{From: shared.ModelLink{ID: java.ID, Port: "out"}, To: shared.ModelLink{ID: "ms4-collector", Port: "in"}}}
	manifest.Models = append(manifest.Models, &shared.RunnableModel{
		ID: "ms4-collector", Name: "MS4 collector ", Code: string(code), Language: "java", IntegrationID: "ms4me-java", IntegrationVersion: "1.0.0",
		Ports:      []shared.RunnableModelPort{{ID: "in", Name: "in", Type: "in"}, {ID: "out", Name: "out", Type: "out"}},
		Parameters: []shared.RunnableModelParameter{{Name: "factor", Type: "float", Value: 3.0}},
	})
	if includeDEVSimPy {
		code, err := os.ReadFile(filepath.Join("testdata", "multi_language", "DevSimPyCollector.py"))
		if err != nil {
			t.Fatal(err)
		}
		ms4 := manifest.Models[len(manifest.Models)-1]
		ms4.Connections = []shared.RunnableModelConnection{{From: shared.ModelLink{ID: ms4.ID, Port: "out"}, To: shared.ModelLink{ID: "devsimpy-collector", Port: "in"}}}
		manifest.Models = append(manifest.Models, &shared.RunnableModel{
			ID: "devsimpy-collector", Name: "DEVSimPy collector ", Code: string(code), Language: "python", IntegrationID: "devsimpy-python", IntegrationVersion: "1.0.0",
			Ports:      []shared.RunnableModelPort{{ID: "in", Name: "in", Type: "in"}, {ID: "out", Name: "out", Type: "out"}},
			Parameters: []shared.RunnableModelParameter{{Name: "factor", Type: "float", Value: 2.0}},
		})
		manifest.SimulationID = "mixed-frameworks-devsimpy"
	}
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
	expected := map[string]float64{"go-sender": 5, "python-adder": 15, "java-collector": 30, "ms4-collector": 90}
	if includeDEVSimPy {
		expected["devsimpy-collector"] = 180
	}
	seen := map[string]int{}
	for _, message := range result.Messages {
		output, ok := message.Data.(*kafka.KafkaMessageOutputReport)
		if !ok {
			continue
		}
		for _, port := range output.Payload.Outputs {
			payload, ok := port.Value.(map[string]any)
			if !ok {
				t.Fatalf("output lost JSON structure: %+v", port.Value)
			}
			if payload["value"] != expected[output.SenderID] {
				t.Fatalf("%s: unexpected value %+v", output.SenderID, payload)
			}
			seen[output.SenderID]++
		}
	}
	for id := range expected {
		if seen[id] != 1 {
			t.Fatalf("%s: expected one output, got %d", id, seen[id])
		}
	}
}
