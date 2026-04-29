package testsutils

import (
	shared "devsforge-shared"
	"encoding/json"
	"os"
	"path/filepath"
)

func LoadManifestWithCode(manifestPath string) (*shared.RunnableManifest, error) {
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
