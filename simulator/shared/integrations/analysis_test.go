package integrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAnalysisSourcesUseInstalledModelingOnly(t *testing.T) {
	definitions, err := List()
	if err != nil {
		t.Fatal(err)
	}
	for _, definition := range definitions {
		t.Run(definition.ID, func(t *testing.T) {
			sources, err := definition.AnalysisSources()
			if err != nil {
				t.Fatal(err)
			}
			if len(sources.Files) == 0 || sources.Digest != definition.Digest {
				t.Fatal("missing sources or fingerprint")
			}
			if definition.Language == "go" && sources.Module != "devsforge-wrapper" {
				t.Fatalf("wrong module: %s", sources.Module)
			}
			for name, content := range sources.Files {
				if strings.Contains(name, "..") || strings.HasPrefix(name, "/") || strings.Contains(name, "ai/") {
					t.Fatalf("unexpected resource %s", name)
				}
				file, err := definition.Resource(filepath.Join(definition.Wrapper, name))
				if err != nil {
					t.Fatal(err)
				}
				original, err := os.ReadFile(file)
				if err != nil || content != string(original) {
					t.Fatalf("modeling source was copied or rewritten: %s", name)
				}
			}
		})
	}
}

func TestAnalysisSourcesRejectEscapesAndLargeFiles(t *testing.T) {
	root := t.TempDir()
	library := filepath.Join(root, "wrapper", "modeling")
	if err := os.MkdirAll(library, 0700); err != nil {
		t.Fatal(err)
	}
	d := Definition{Dir: root, Wrapper: "wrapper", Context: []string{"wrapper/modeling"}, Language: "python"}
	outside := filepath.Join(t.TempDir(), "secret.py")
	if err := os.WriteFile(outside, []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(library, "escape.py")
	if err := os.Symlink(outside, link); err != nil {
		t.Fatal(err)
	}
	if _, err := d.AnalysisSources(); err == nil {
		t.Fatal("exposed a file outside the integration")
	}
	if err := os.Remove(link); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(library, "huge.py"), make([]byte, (2<<20)+1), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := d.AnalysisSources(); err == nil {
		t.Fatal("accepted an unbounded resource")
	}
}
