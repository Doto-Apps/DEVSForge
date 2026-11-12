package integrations

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// AnalysisSources contains only the declared modeling sources. Browser engines
// receive the same library used by simulations, never AI prompts or user files.
type AnalysisSources struct {
	IntegrationID      string            `json:"integrationId"`
	IntegrationVersion string            `json:"integrationVersion"`
	Language           string            `json:"language"`
	ModelPath          string            `json:"modelPath"`
	Digest             string            `json:"digest"`
	Module             string            `json:"module,omitempty"`
	Files              map[string]string `json:"files"`
}

func (d Definition) AnalysisSources() (AnalysisSources, error) {
	result := AnalysisSources{IntegrationID: d.ID, IntegrationVersion: d.Version, Language: d.Language, ModelPath: d.ModelPath, Digest: d.Digest, Files: map[string]string{}}
	total := 0
	wrapper, err := d.Resource(d.Wrapper)
	if err != nil {
		return result, err
	}
	if d.Language == "go" {
		manifest, err := d.Resource(filepath.Join(d.Wrapper, "go.mod"))
		if err != nil {
			return result, err
		}
		data, err := os.ReadFile(manifest)
		if err != nil {
			return result, err
		}
		for _, line := range strings.Split(string(data), "\n") {
			fields := strings.Fields(line)
			if len(fields) == 2 && fields[0] == "module" {
				result.Module = fields[1]
				break
			}
		}
		if result.Module == "" {
			return result, fmt.Errorf("go integration has no module declaration")
		}
	}
	for _, resource := range d.Context {
		root, err := d.Resource(resource)
		if err != nil {
			return result, err
		}
		err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				switch entry.Name() {
				case "__pycache__", "target", ".venv", "node_modules", ".git":
					return filepath.SkipDir
				}
				return nil
			}
			if strings.HasPrefix(entry.Name(), ".") {
				return nil
			}
			rel, err := filepath.Rel(d.Dir, path)
			if err != nil {
				return err
			}
			// Resource resolves symlinks and refuses escapes, including individual files.
			safe, err := d.Resource(rel)
			if err != nil {
				return err
			}
			name, err := filepath.Rel(wrapper, safe)
			if err != nil || name == ".." || strings.HasPrefix(name, ".."+string(filepath.Separator)) {
				return fmt.Errorf("analysis source is outside the wrapper: %s", resource)
			}
			info, err := os.Stat(safe)
			if err != nil {
				return err
			}
			if info.Size() > 2<<20 || int64(total)+info.Size() > 8<<20 {
				return fmt.Errorf("analysis sources exceed the 8 MiB limit")
			}
			data, err := os.ReadFile(safe)
			if err != nil {
				return err
			}
			if !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
				return nil
			}
			total += len(data)
			result.Files[filepath.ToSlash(name)] = string(data)
			return nil
		})
		if err != nil {
			return result, err
		}
	}
	if len(result.Files) == 0 {
		return result, fmt.Errorf("integration has no modeling sources")
	}
	return result, nil
}
