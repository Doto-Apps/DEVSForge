// Package integrations loads the versioned integration resources shared by the API and runner.
package integrations

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/template"
	"unicode"
	"unicode/utf8"
)

type Server struct {
	ID              string         `json:"id"`
	Command         string         `json:"command"`
	Args            []string       `json:"args"`
	Settings        map[string]any `json:"settings,omitempty"`
	AllowedCommands []string       `json:"allowedCommands,omitempty"`
}
type Capabilities struct {
	Simulation bool `json:"simulation"`
	Template   bool `json:"template"`
	AI         bool `json:"ai"`
	LSP        bool `json:"lsp"`
}
type Definition struct {
	ID             string       `json:"id"`
	Version        string       `json:"version"`
	Name           string       `json:"name"`
	Language       string       `json:"language"`
	Framework      string       `json:"framework"`
	Extension      string       `json:"extension"`
	LegacyLanguage string       `json:"legacyLanguage,omitempty"`
	Default        bool         `json:"default"`
	Preparation    string       `json:"preparation"`
	Wrapper        string       `json:"wrapper"`
	ModelPath      string       `json:"modelPath"`
	Template       string       `json:"template"`
	Prompt         string       `json:"prompt"`
	Context        []string     `json:"context"`
	Servers        []Server     `json:"servers"`
	Capabilities   Capabilities `json:"capabilities"`
	Digest         string       `json:"digest"`
	Dir            string       `json:"-"`
}

func ValidName(name string) bool {
	if name == "" {
		return false
	}
	for i, r := range name {
		if r != '_' && !unicode.IsLetter(r) && (i <= 0 || !unicode.IsDigit(r)) {
			return false
		}
	}
	return true
}
func Root() (string, error) {
	if root := os.Getenv("INTEGRATIONS_DIR"); root != "" {
		return filepath.Abs(root)
	}
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		p := filepath.Join(dir, "simulator/runner/integrations")
		if st, e := os.Stat(p); e == nil && st.IsDir() {
			return p, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("set INTEGRATIONS_DIR: integration resources not found")
}

// Resource resolves only files inside an integration, including symlink checks.
func (d Definition) Resource(relative string) (string, error) {
	if relative == "" || filepath.IsAbs(relative) {
		return "", fmt.Errorf("invalid integration resource %q", relative)
	}
	root, err := filepath.EvalSymlinks(d.Dir)
	if err != nil {
		return "", err
	}
	p, err := filepath.EvalSymlinks(filepath.Join(root, relative))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(root, p)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("resource escapes integration")
	}
	return p, nil
}
func List() ([]Definition, error) {
	root, err := Root()
	if err != nil {
		return nil, err
	}
	result := []Definition{}
	seen := map[string]bool{}
	legacySeen := map[string]bool{}
	defaults := 0
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() && (entry.Name() == "wrapper" || entry.Name() == "node_modules" || entry.Name() == ".git") {
			return filepath.SkipDir
		}
		if entry.IsDir() || entry.Name() != "integration.json" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var d Definition
		decoder := json.NewDecoder(bytes.NewReader(data))
		decoder.DisallowUnknownFields()
		if err = decoder.Decode(&d); err != nil {
			return err
		}
		d.Dir = filepath.Dir(path)
		if d.ID == "" || d.Version == "" || d.Language == "" || d.Name == "" || d.Framework == "" || d.ModelPath == "" {
			return fmt.Errorf("incomplete integration: %s", path)
		}
		if (d.Preparation != "" && d.Wrapper == "") || (len(d.Servers) > 0 && (d.Preparation == "" || d.Wrapper == "")) || (d.Prompt != "" && (d.Template == "" || len(d.Context) == 0)) {
			return fmt.Errorf("incomplete integration resources: %s", path)
		}
		key := d.ID + "@" + d.Version
		if seen[key] {
			return fmt.Errorf("duplicate integration %s", key)
		}
		seen[key] = true
		if d.LegacyLanguage != "" {
			if legacySeen[d.LegacyLanguage] {
				return fmt.Errorf("duplicate legacy language alias %s", d.LegacyLanguage)
			}
			legacySeen[d.LegacyLanguage] = true
		}
		if d.Default {
			defaults++
		}
		for _, r := range append([]string{d.Wrapper, d.Template, d.Prompt}, d.Context...) {
			if r != "" {
				if _, err = d.Resource(r); err != nil {
					return fmt.Errorf("%s: %w", key, err)
				}
			}
		}
		if strings.Contains(d.ModelPath, "..") || filepath.IsAbs(d.ModelPath) {
			return fmt.Errorf("invalid modelPath")
		}
		serverIDs := map[string]bool{}
		for _, s := range d.Servers {
			if s.ID == "" || s.Command == "" || serverIDs[s.ID] {
				return fmt.Errorf("invalid LSP declaration in %s", key)
			}
			serverIDs[s.ID] = true
		}
		d.Capabilities = Capabilities{Simulation: d.Preparation != "" && d.Wrapper != "", Template: d.Template != "", AI: d.Prompt != "" && d.Template != "", LSP: len(d.Servers) > 0}
		// Content fingerprint covers the modeling, templates, and instructions, excluding build products.
		h := sha256.New()
		runtimeDefinition := d
		runtimeDefinition.Name = ""
		runtimeDefinition.Default = false
		runtimeDefinition.LegacyLanguage = ""
		runtimeBytes, _ := json.Marshal(runtimeDefinition)
		h.Write(runtimeBytes)
		for _, r := range []string{d.Template, d.Prompt, d.Wrapper} {
			if r == "" {
				continue
			}
			p, _ := d.Resource(r)
			err = filepath.WalkDir(p, func(file string, e fs.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if e.IsDir() {
					switch e.Name() {
					case "target", ".shared", ".git", "__pycache__", "node_modules", ".venv":
						return filepath.SkipDir
					}
					return nil
				}
				if strings.HasSuffix(file, ".pyc") {
					return nil
				}
				b, err := os.ReadFile(file)
				if err != nil {
					return err
				}
				h.Write([]byte(strings.TrimPrefix(file, d.Dir)))
				h.Write(b)
				return nil
			})
			if err != nil {
				return err
			}
		}
		d.Digest = hex.EncodeToString(h.Sum(nil))
		result = append(result, d)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(result) == 0 || defaults != 1 {
		return nil, fmt.Errorf("catalogue requires exactly one default integration")
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID+result[i].Version < result[j].ID+result[j].Version })
	return result, nil
}
func Resolve(id, version, legacy string) (Definition, error) {
	all, err := List()
	if err != nil {
		return Definition{}, err
	}
	for _, d := range all {
		if (id != "" && d.ID == id && d.Version == version) || (id == "" && legacy != "" && d.LegacyLanguage == legacy) {
			if legacy != "" && d.Language != legacy {
				return Definition{}, fmt.Errorf("integration and language disagree")
			}
			return d, nil
		}
	}
	return Definition{}, fmt.Errorf("unknown integration %s@%s (language %s)", id, version, legacy)
}
func Default() (Definition, error) {
	all, err := List()
	if err != nil {
		return Definition{}, err
	}
	for _, d := range all {
		if d.Default {
			return d, nil
		}
	}
	return Definition{}, fmt.Errorf("default integration missing")
}
func (d Definition) RenderTemplate(name string) (string, error) {
	name = strings.TrimSpace(name)
	if !ValidName(name) {
		return "", fmt.Errorf("model name must be a source identifier")
	}
	p, err := d.Resource(d.Template)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	t, err := template.New("atomic").Parse(string(b))
	if err != nil {
		return "", err
	}
	var out bytes.Buffer
	err = t.Execute(&out, map[string]string{"Name": name})
	return out.String(), err
}
func (d Definition) ModelPrompt() (string, error) {
	p, err := d.Resource(d.Prompt)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	var out strings.Builder
	tpl, err := d.RenderTemplate("MyModel")
	if err != nil {
		return "", err
	}
	out.WriteString(strings.ReplaceAll(string(b), "%s", tpl))
	out.WriteString("\nReference model:\n" + tpl)
	if out.Len() > 180000 {
		return "", fmt.Errorf("integration AI context exceeds 180KB")
	}
	for _, resource := range d.Context {
		p, err = d.Resource(resource)
		if err != nil {
			return "", err
		}
		err = filepath.WalkDir(p, func(path string, e fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if e.IsDir() {
				switch e.Name() {
				case "__pycache__", "target", ".git", "node_modules", ".venv":
					return filepath.SkipDir
				}
				return nil
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
				return nil
			}
			if out.Len()+len(data)+len(path)+32 > 180000 {
				return fmt.Errorf("integration AI context exceeds 180KB")
			}
			rel, _ := filepath.Rel(d.Dir, path)
			out.WriteString("\nLibrary source " + rel + ":\n")
			out.Write(data)
			return nil
		})
		if err != nil {
			return "", err
		}
	}
	return out.String(), nil
}
