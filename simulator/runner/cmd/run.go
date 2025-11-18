// Package cmd : Run a go model
package cmd

import (
	"devsforge/simulator/runner/internal"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// prepareGeneralWrapper : partie commune à tous les langages
// - InitConfig
// - création (ou réutilisation) du dossier de simulation devsforge_<SimulationID>_*
func prepareGeneralWrapper(manifest shared.RunnableManifest, yamlConfigFilePath string) (*internal.WrapperInfo, error) {
	log.Println("Init model")

	cfg := internal.InitConfig(manifest, yamlConfigFilePath)

	// TODO: BEGIN -> a tout momeent ca degagre dans coord
	prefix := "devsforge_" + manifest.SimulationID + "_"
	pattern := filepath.Join("./tmp", prefix+"*")
	// Si un dossier existe déjà avec ce préfixe, on le réutilise
	candidates, err := filepath.Glob(pattern)
	var rootDir string
	if err == nil && len(candidates) > 0 {
		rootDir = candidates[0]
		log.Printf("♻️ Reusing existing simulation temp dir %s", rootDir)
	} else {
		rootDir, err = os.MkdirTemp("./tmp", prefix)
		if err != nil {
			return nil, fmt.Errorf("failed to create simulation temp dir %s at %s location, error : %w", prefix, err)
		}
		log.Printf("📁 Created simulation temp dir %s", rootDir)
	}
	// END
	return &internal.WrapperInfo{
		Cfg:     cfg,
		RootDir: rootDir,
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
		} else {
			log.Println("Cleanup done")
		}
	}()

	// 2) Préparation spécifique au langage (Go / Python / ...)
	switch manifest.Models[0].Language {
	case "go":
		if err := internal.PrepareGoWraper(wrapper, manifest); err != nil {
			return err
		}
	case "python":
		if err := internal.PreparePythonWraper(wrapper, manifest); err != nil {
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
