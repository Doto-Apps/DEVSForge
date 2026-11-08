package integrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstalledProfiles(t *testing.T) {
	defs, err := List()
	if err != nil {
		t.Fatal(err)
	}
	if len(defs) != 3 {
		t.Fatalf("expected three installed integrations, got %d", len(defs))
	}
	for _, d := range defs {
		legacy, err := Resolve("", "", d.LegacyLanguage)
		if err != nil || legacy.ID != d.ID {
			t.Fatalf("legacy mapping: %v", err)
		}
		code, err := d.RenderTemplate("Example")
		if err != nil || !strings.Contains(code, "Example") {
			t.Fatalf("template %s: %v", d.ID, err)
		}
		prompt, err := d.ModelPrompt()
		if err != nil || !strings.Contains(prompt, "Library source") {
			t.Fatalf("AI context %s: %v", d.ID, err)
		}
	}
}
func TestRejectUnknownAndConflictingProfiles(t *testing.T) {
	for _, args := range [][3]string{{"unknown", "1.0.0", ""}, {"xdevs-java", "1.0.0", "python"}, {"xdevs-java", "9.0.0", ""}} {
		if _, err := Resolve(args[0], args[1], args[2]); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}
func TestResourcesCannotEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
		t.Fatal(err)
	}
	d := Definition{Dir: root}
	if _, err := d.Resource("link/secret"); err == nil {
		t.Fatal("followed an escaping symlink")
	}
	if _, err := d.Resource("../secret"); err == nil {
		t.Fatal("accepted traversal")
	}
}
func TestModelNameMustBeIdentifier(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"../Escape", "Name\nimport os", "Model;exit()", ""} {
		if _, err := d.RenderTemplate(name); err == nil {
			t.Fatalf("accepted %q", name)
		}
	}
}

func TestPromptContextAcceptsNewSourceExtensionsWithoutRewritingCode(t *testing.T) {
	root := t.TempDir()
	for name, content := range map[string]string{"prompt.md": "Template: %s", "atomic.tmpl": "class {{.Name}}", "modeling.rs": "format!(\"%s\");"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	d := Definition{Dir: root, Prompt: "prompt.md", Template: "atomic.tmpl", Context: []string{"modeling.rs"}}
	text, err := d.ModelPrompt()
	if err != nil || !strings.Contains(text, `format!("%s");`) || !strings.Contains(text, "class MyModel") {
		t.Fatalf("source context corrupted or omitted: %q %v", text, err)
	}
}
