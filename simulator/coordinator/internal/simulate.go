package internal

import (
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

func RunSimulation(args []string) error {
	log.SetPrefix("[COORDI] ")
	log.Println("======================================")
	log.Println("        🏗️ DEVSForge Simulator        ")
	log.Println("======================================")

	fs := flag.NewFlagSet("simulator", flag.ContinueOnError)

	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	dockerProvider := fs.Bool("docker", false, "Whether to use docker to launch runner or use shell")
	kafka := fs.String("kafka", "", "The kafka endpoint")
	topic := fs.String("topic", "", "The kafka topic (generated if not provided)")

	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("error parsing flags: %w", err)
	}

	manifest, err := CreateManifest(jsonStr, filePath)
	if err != nil {
		return err
	}

	if len(manifest.Models) == 0 {
		return fmt.Errorf("no models provided in the manifest")
	}

	kafkaTopic, err := GetKafkaTopic(*kafka, *topic)
	if err != nil {
		return fmt.Errorf("failed to initialize Kafka topic: %w", err)
	}

	// Resolve simulator root in a deterministic way.
	simRoot := os.Getenv(utils.EnvSimulatorRoot)
	if simRoot == "" {
		simRoot, err = utils.SimulatorRoot()
		if err != nil {
			return fmt.Errorf("failed to resolve simulator root: %w", err)
		}
	}

	// Ensure tmp base directory exists under simulator/tmp.
	tmpBase := filepath.Join(simRoot, "tmp")
	if err := os.MkdirAll(tmpBase, 0o755); err != nil {
		return fmt.Errorf("failed to create tmp base directory %q: %w", tmpBase, err)
	}

	prefix := "devsforge_" + manifest.SimulationID + "_"
	rootDir, err := os.MkdirTemp(tmpBase, prefix)
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir with prefix %q under %q: %w", prefix, tmpBase, err)
	}
	log.Printf("📁 Created simulation temp dir %s", rootDir)

	// Pass an absolute tmp directory to runners (stable, no relative paths).
	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: *kafka,
			Topic:   kafkaTopic,
		},
		TmpDirectory: rootDir,
	}

	configFile, err := GenerateRunnerYamlConfig(yamlConfig)
	if err != nil {
		return fmt.Errorf("failed to generate runner YAML config: %w", err)
	}

	cfg := InitConfig(yamlConfig)

	if *dockerProvider {
		log.Printf("Launching %d runners using docker...", len(manifest.Models))
		// TODO: Docker path should also rely on simRoot / rootDir if needed.
	} else {
		if err := RunShellSimulation(manifest, configFile, cfg); err != nil {
			return err
		}
	}

	log.Println("======================================")
	log.Println("       🏗️ Simulation ended... ✨      ")
	log.Println("======================================")
	log.Println("Cleaning environment...")

	if err := Cleanup(*kafka, kafkaTopic); err != nil {
		return fmt.Errorf("error during cleanup: %w", err)
	}

	log.Println("Done")
	return nil
}

func Cleanup(kafkaConnStr string, kafkaTopic string) error {
	if kafkaConnStr != "" && kafkaTopic != "" {
		if err := DeleteTopic(kafkaConnStr, kafkaTopic); err != nil {
			return err
		}
	}
	return nil
}
