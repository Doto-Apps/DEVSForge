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
	// on créer des runner states, ca nous permet de garder l'etat des modèle

	kafkaTopic, err := GetKafkaTopic(*kafka)
	if err != nil {
		return fmt.Errorf("cant initialise kafka topic : %w", err)
	}
	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: *kafka,
			Topic:   kafkaTopic,
		},
	}

	//permet de verifier si le dossier tmp, si il existe pas besoin de créer, sinon on le créer
	// création du dossier temporaire de la simualtion
	tmpDir := "./tmp"
	tmpDirMatches, err := filepath.Glob(tmpDir)
	if err == nil && len(tmpDirMatches) <= 0 {
		tmpDir, err = os.MkdirTemp("./", "tmp")
		if err != nil {
			return fmt.Errorf("failed to create temp dir, error : %v", err)
		}
	}

	prefix := "devsforge_" + manifest.SimulationID + "_"

	pattern := filepath.Join(tmpDir, prefix+"*")
	// Si un dossier existe déjà avec ce préfixe, on le réutilise
	candidates, err := filepath.Glob(pattern)
	var rootDir string
	if err == nil && len(candidates) > 0 {
		rootDir = candidates[0]
		log.Printf("♻️ Reusing existing simulation temp dir %s", rootDir)
	} else {
		rootDir, err = os.MkdirTemp(tmpDir, prefix)
		if err != nil {
			return fmt.Errorf("failed to create simulation temp dir %s at %s location, error : %w", prefix, pattern, err)
		}
		log.Printf("📁 Created simulation temp dir %s", rootDir)
	}

	configFile, err := GenerateRunnerYamlConfig(yamlConfig)

	cfg := InitConfig(yamlConfig)

	if err != nil {
		panic(err)
	}

	if *dockerProvider {
		log.Printf("Launching %d runners using docker...\n", len(manifest.Models))
	} else {
		err := RunShellSimulation(manifest, configFile, cfg)
		if err != nil {
			return err
		}
	}

	log.Println("======================================")
	log.Println("       🏗️ Simulation ended... ✨      ")
	log.Println("======================================")
	log.Printf("Cleaning environment... ")
	err = Cleanup(*kafka, kafkaTopic)
	if err != nil {
		return fmt.Errorf("error during cleanup : %w", err)
	}
	log.Printf("Done\n")

	return nil
}

func Cleanup(kafkaConnStr string, kafkaTopic string) error {
	if kafkaConnStr != "" && kafkaTopic != "" {
		err := DeleteTopic(kafkaConnStr, kafkaTopic)
		if err != nil {
			return err
		}
	}

	return nil
}
