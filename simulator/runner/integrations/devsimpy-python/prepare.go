package devsimpypython

import (
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	return util.LinkLibrary(source, w.ModelDir, "pypdevs")
}

func PrepareSources(w *generators.WrapperInfo, _ shared.RunnableManifest) error {
	if w.Cfg == nil || w.Cfg.Model == nil {
		return fmt.Errorf("DEVSimPy: missing model configuration")
	}
	return os.WriteFile(filepath.Join(w.ModelDir, "model.py"), []byte(w.Cfg.Model.Code), 0600)
}

func PrepareWrapper(w *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	if err := PrepareSources(w, manifest); err != nil {
		return err
	}
	modelJSON, err := json.Marshal(w.Cfg.Model)
	if err != nil {
		return err
	}
	cmd := exec.Command(generators.PythonCommand(), "main.py", "--json", string(modelJSON))
	return generators.LaunchModelProcess(w, cmd, "DEVSimPy Python")
}
