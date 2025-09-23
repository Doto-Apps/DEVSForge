// Package cmd : Run a go model
package cmd

import (
	"devsforge/runners/go/internal"
	"devsforge/shared"
	"devsforge/shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"time"
)

// LaunchRunner Launch a runner with args
func LaunchRunner(args []string) error {
	log.Println("======================================")
	log.Println("          ⚙️ DEVSForge Runner         ")
	log.Println("======================================")
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("configFile", "", "Path to YAML config file")

	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("error parsing flags: %w", err)
	}

	if *configFile == "" {
		log.Println("⚠️ No config provided use default config")
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

	LaunchSim(manifest)

	log.Println("======================================")
	log.Println("   ⚙️ Runner ended successfully ✅    ")
	log.Println("======================================")
	return nil
}

func LaunchSim(model shared.RunnableManifest) {
	log.Println("Init model")
	internal.InitConfig(model)
	time.Sleep(5 * time.Second)
	log.Println("Init done")
	internal.SendMessage("init_done")
	log.Println("Waiting for all models to be init")
	internal.WaitForAllReady(30 * time.Second)
	log.Println("All models are ready")
}
