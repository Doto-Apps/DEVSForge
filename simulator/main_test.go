package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRunWithFile(t *testing.T) {
	// JSON statique pour tester
	jsonContent := `{
		"models": [
			{"id": "m1", "name": "ModelOne"},
			{"id": "m2", "name": "ModelTwo"}
		]
	}`

	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, []byte(jsonContent), 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	// Appelle run() avec --file
	err := run([]string{"--file", jsonPath})
	if err != nil {
		t.Fatalf("expected no error, got\n %v", err)
	}
}
