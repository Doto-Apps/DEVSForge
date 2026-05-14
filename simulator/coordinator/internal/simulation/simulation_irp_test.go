package simulation

import (
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestIrp(t *testing.T) {
	manifestPath := filepath.Join("testdata", "irp", "runnable_manifest.json")

	manifest, err := loadManifestWithCodeIrp(manifestPath)
	if err != nil {
		t.Fatalf("Failed to load manifest: %v", err)
	}

	jsonBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Failed to marshal manifest: %v", err)
	}
	jsonStr := string(jsonBytes)

	kafkaTopic := "test-irp"

	if _, err := RunSimulation(types.SimulationParams{
		Json:         &jsonStr,
		KafkaTopic:   &kafkaTopic,
		KafkaAddress: &KafkaAddr,
	}); err != nil {
		t.Fatalf("Simulation failed: %v", err)
	}
	// INFO: DO NOT USE GOLDENS AS GENERATOR USE RANDOM VALUES SO GOLDEN CANNOT BE CONSISTENT
}

func loadManifestWithCodeIrp(manifestPath string) (*shared.RunnableManifest, error) {
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, err
	}

	var manifest shared.RunnableManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}

	baseDir := filepath.Dir(manifestPath)

	for _, model := range manifest.Models {
		var codeFile string
		switch model.Name {
		case "Retailer":
			codeFile = filepath.Join(baseDir, "retailer.py")
		case "Vehicle":
			codeFile = filepath.Join(baseDir, "vehicle.py")
		case "Manufacturer":
			codeFile = filepath.Join(baseDir, "manufacturer.py")
		case "Transducer":
			codeFile = filepath.Join(baseDir, "transducer.py")
		case "DeliveryScheduleGenerator":
			codeFile = filepath.Join(baseDir, "delivery_schedule_generator.py")
		default:
			continue
		}

		code, err := os.ReadFile(codeFile)
		if err != nil {
			return nil, err
		}
		model.Code = string(code)
	}

	return &manifest, nil
}
