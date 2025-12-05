// Package cmd : Run a go model
package cmd

import (
	"devsforge-runner/internal"
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"path"
)

// prepareGeneralWrapper : partie commune à tous les langages
// - InitConfig
// - création (ou réutilisation) du dossier de simulation devsforge_<SimulationID>_*
func prepareGeneralWrapper(manifest shared.RunnableManifest, yamlConfigFilePath string) (*generators.WrapperInfo, error) {
	log.Println("Init model")
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	cfg := config.InitConfig(manifest, yamlConfigFilePath)

	// on doit créer le dossier pour le modèle courant du style model_id

	modelRoot := path.Join(cfg.TmpDirectory, "model_"+cfg.Model.ID)
	modelingFolder := path.Join("../wrappers", string(cfg.Model.Language))

	// Delete firstly
	if err := os.RemoveAll(modelRoot); err != nil {
		return nil, fmt.Errorf("failed to remove dir %s: %w", modelRoot, err)
	}

	if err := os.Mkdir(modelRoot, 0777); err != nil {
		return nil, fmt.Errorf("failed to create model %s from : %s with root dir %s - error : %w", cfg.Model.ID, modelRoot, cwd, err)
	}

	err = util.CopyDir(modelingFolder, modelRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to copy directory from %s to : %s with root dir %s : %w", modelingFolder, modelRoot, cwd, err)
	}

	return &generators.WrapperInfo{
		Cfg:      cfg,
		RootDir:  cfg.TmpDirectory,
		ModelDir: modelRoot,
	}, nil
}

// LaunchRunner Launch a runner with args
func LaunchRunner(args []string) error {
	log.SetPrefix("[RUNNER] ")
	log.Println("======================================")
	log.Println("          ⚙️ DEVSForge Runner         ")
	log.Println("======================================")
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("config", "", "Path to YAML config file")

	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("error parsing flags: %w", err)
	}

	if *configFile == "" {
		return fmt.Errorf("⚠️ No config file provided ")
	}

	var manifest shared.RunnableManifest
	if *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if *filePath != "" {
		data, err := os.ReadFile(*filePath)
		if err != nil {
			return fmt.Errorf("error reading file: %w", err)
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			return fmt.Errorf("error parsing JSON file: %w", err)
		}
	} else {
		return fmt.Errorf("please provide --json or --file")
	}
	log.SetPrefix("[RUNNER: " + manifest.Models[0].ID + " ]\t")

	if len(manifest.Models) != 1 {
		return fmt.Errorf("❌ Manifest has no models or more than 1. Runner can only run 1 model at the same time")
	}
	log.Println("✅ Manifest validated")

	// 1) Préparation générale (indépendante du langage)
	wrapper, err := prepareGeneralWrapper(manifest, *configFile)
	if err != nil {
		return err
	}

	defer func() {
		log.Println("Trying to cleanup")

		if err := wrapper.Cleanup(); err != nil {
			log.Printf("⚠️ Cleanup error: %v", err)
		}
	}()

	log.Printf("Launch using language: %s", manifest.Models[0].Language)
	// 2) Préparation spécifique au langage (Go / Python / ...)
	switch manifest.Models[0].Language {
	case "go":
		if err := generators.PrepareGoWraper(wrapper, manifest); err != nil {
			return err
		}
	case "python":
		if err := generators.PreparePythonWraper(wrapper, manifest); err != nil {
			return err
		}
	default:
		return fmt.Errorf("❌ Simulator can't handle %s language. It need to be implemented", manifest.Models[0].Language)
	}

	// 3) Lancement de la sim
	if err := internal.LaunchSim(wrapper); err != nil {
		return err
	}

	log.Println("======================================")
	log.Println("   ⚙️ Runner ended successfully ✅    ")
	log.Println("======================================")
	return nil
}
