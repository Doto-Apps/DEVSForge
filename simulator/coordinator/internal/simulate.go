package internal

import (
	shared "devsforge-shared"
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

	kafkaTopic, err := GetKafkaTopic(*kafka)
	if err != nil {
		return fmt.Errorf("cant initialise kafka topic : %w", err)
	}

	tmpDirForCreation := "../../../../tmp"
	if err := os.MkdirAll(tmpDirForCreation, 0755); err != nil {
		return fmt.Errorf("failed to create temp dir, error : %v", err)
	}

	prefix := "devsforge_" + manifest.SimulationID + "_"

	rootDir, err := os.MkdirTemp(tmpDirForCreation, prefix)
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir %s at %s location, error : %w", prefix, rootDir, err)
	}
	log.Printf("📁 Created simulation temp dir %s", rootDir)

	tmpFolderName := filepath.Base(rootDir)
	runnerTmpDir := filepath.Join("../../tmp", tmpFolderName)

	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: *kafka,
			Topic:   kafkaTopic,
		},
		TmpDirectory: runnerTmpDir,
	}

	configFile, err := GenerateRunnerYamlConfig(yamlConfig)
	if err != nil {
		return fmt.Errorf("failed to generate runner yaml config: %w", err)
	}

	cfg := InitConfig(yamlConfig)

	if *dockerProvider {
		log.Printf("Launching %d runners using docker...\n", len(manifest.Models))
	} else {
		if err := RunShellSimulation(manifest, configFile, cfg); err != nil {
			return err
		}
	}

	log.Println("======================================")
	log.Println("       🏗️ Simulation ended... ✨      ")
	log.Println("======================================")
	log.Printf("Cleaning environment... ")

	if err := Cleanup(*kafka, kafkaTopic); err != nil {
		return fmt.Errorf("error during cleanup : %w", err)
	}

	log.Printf("Done\n")
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
