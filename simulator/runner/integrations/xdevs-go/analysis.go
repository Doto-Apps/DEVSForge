package xdevsgo

import (
	"devsforge-runner/internal/generators"
	"os"
	"path/filepath"
	"regexp"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	dir := w.ModelDir
	original, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return err
	}
	framework := filepath.Join(dir, ".framework")
	if err = os.MkdirAll(framework, 0700); err != nil {
		return err
	}
	if err = os.WriteFile(filepath.Join(framework, "go.mod"), original, 0600); err != nil {
		return err
	}
	for _, folder := range []string{"modeling", "rpc"} {
		if err = os.Symlink(filepath.Join(source, folder), filepath.Join(framework, folder)); err != nil {
			return err
		}
		if err = os.RemoveAll(filepath.Join(dir, folder)); err != nil {
			return err
		}
	}
	updated := regexp.MustCompile(`(?m)^module\s+\S+`).ReplaceAllString(string(original), "module devsforge-analysis/"+w.Cfg.Model.ID)
	updated += "\nrequire devsforge-wrapper v0.0.0\nreplace devsforge-wrapper => ./.framework\n"
	return os.WriteFile(filepath.Join(dir, "go.mod"), []byte(updated), 0600)
}
