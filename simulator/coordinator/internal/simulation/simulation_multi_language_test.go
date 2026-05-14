package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-coordinator/testsutils"
	shared "devsforge-shared"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"gotest.tools/v3/golden"
)

func TestMultiLanguage(t *testing.T) {
	testFolder := "multi_language"
	manifestPath := filepath.Join("testdata", testFolder, "runnable_manifest.json")

	manifest, err := loadManifestWithCode(manifestPath)
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
		t.Log("check simulation.golden.json golden")
		status.CreatedAt = 1
		status.EndedAt = 1

		data, err := json.MarshalIndent(&status, " ", "  ")
		if err != nil {
			t.Fatalf("cannot marshal simulation status")
		}

		normalized := testsutils.NormalizeParallel(data)

		goldenPath := filepath.Join(testFolder, "simulation.golden.json")

		if golden.FlagUpdate() {
			golden.Assert(t, string(normalized), goldenPath)
		} else {
			expectedBytes := golden.Get(t, goldenPath)
			var expected, actual map[string]any
			if err := json.Unmarshal(expectedBytes, &expected); err != nil {
				t.Fatalf("cannot unmarshal expected golden: %v", err)
			}
			if err := json.Unmarshal(normalized, &actual); err != nil {
				t.Fatalf("cannot unmarshal actual status: %v", err)
			}

			assert.ElementsMatch(t, expected["messages"], actual["messages"], "Messages don't match")
		}
	}
}

func loadManifestWithCode(manifestPath string) (*shared.RunnableManifest, error) {
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
		switch model.Language {
		case "go":
			codeFile = filepath.Join(baseDir, "m1.go")
		case "python":
			codeFile = filepath.Join(baseDir, "m1.py")
		case "java":
			codeFile = filepath.Join(baseDir, "JavaCollector.java")
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
