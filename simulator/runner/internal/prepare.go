package internal

import (
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"fmt"
	"os"
	"path/filepath"
)

func PrepareGeneralWrapper(manifest shared.RunnableManifest, yamlConfigFilePath string) (*generators.WrapperInfo, error) {
	cfg := config.InitConfig(manifest, yamlConfigFilePath)

	simRoot := os.Getenv(utils.EnvSimulatorRoot)
	if simRoot == "" {
		wd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("failed to get working directory: %w", err)
		}
		simRoot = wd
	}

	if !filepath.IsAbs(cfg.TmpDirectory) {
		cfg.TmpDirectory = filepath.Join(simRoot, cfg.TmpDirectory)
	}
	if err := os.MkdirAll(cfg.TmpDirectory, 0o755); err != nil {
		return nil, fmt.Errorf("failed to create tmp directory %q: %w", cfg.TmpDirectory, err)
	}

	modelRoot := filepath.Join(cfg.TmpDirectory, "model_"+cfg.Model.ID)
	modelingFolder := filepath.Join(simRoot, "wrappers", string(cfg.Model.Language))

	if _, err := os.Stat(modelingFolder); err != nil {
		return nil, fmt.Errorf("wrapper directory not found: %q: %w", modelingFolder, err)
	}

	if err := os.RemoveAll(modelRoot); err != nil {
		return nil, fmt.Errorf("failed to remove directory %q: %w", modelRoot, err)
	}
	if err := os.MkdirAll(modelRoot, 0o755); err != nil {
		return nil, fmt.Errorf("failed to create model directory %q: %w", modelRoot, err)
	}

	if err := util.CopyDir(modelingFolder, modelRoot); err != nil {
		return nil, fmt.Errorf("failed to copy wrapper directory from %q to %q: %w", modelingFolder, modelRoot, err)
	}

	return &generators.WrapperInfo{
		Cfg:      cfg,
		RootDir:  cfg.TmpDirectory,
		ModelDir: modelRoot,
	}, nil
}
