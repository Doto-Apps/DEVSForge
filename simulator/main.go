package main

import (
	"devsforge/simulator/internal"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

func run(args []string) error {
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

	if len(manifest.Models) == 0 {
		return fmt.Errorf("no models provided in the manifest")
	}
	kafkaTopic, err := internal.GetKafkaTopic(*kafka)
	if err != nil {
		return fmt.Errorf("cant initialise kafka topic : %w", err)
	}
	yamlConfig := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: *kafka,
			Topic:   kafkaTopic,
		},
		GRPC: shared.YamlInputConfigGRPC{
			Host: "localhost",
			Port: 50051,
		},
	}
	configFile, err := internal.GenerateRunnerYamlConfig(yamlConfig)
	if err != nil {
		panic(err)
	}

	if *dockerProvider {
		log.Printf("Launching %d runners using docker...\n", len(manifest.Models))
	} else {
		log.Printf("Launching %d runners using shell...\n", len(manifest.Models))
		errCh := make(chan error, len(manifest.Models))
		// Pour dev je recupere le dossier parent et je fais direct un go run
		// Faudra modifier pour utiliser le binaire directement
		cwd, err := os.Getwd()
		if err != nil {
			panic(err)
		}
		parent := filepath.Dir(cwd)
		for _, model := range manifest.Models {
			go func(m *shared.RunnableModel) {
				tmpFile, err := internal.GenerateJSONRunnerManifest(m, manifest.Count, manifest.SimulationID)
				if err != nil {
					errCh <- err
					return
				}
				cmd := exec.Command("go", "run", "simulator/runner/main.go", "--file", tmpFile.Name(), "--config", configFile.Name())
				cmd.Dir = parent

				cmd.Stdout = os.Stdout
				cmd.Stderr = os.Stderr

				if err := cmd.Run(); err != nil {
					errCh <- fmt.Errorf("error launching runner %s via go run: %w", m.ID, err)
					return
				}

				errCh <- nil
			}(model)
		}
		for range manifest.Models {
			if err := <-errCh; err != nil {
				fmt.Println("❌ Runner failed:", err)
			}
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
		err := internal.DeleteTopic(kafkaConnStr, kafkaTopic)
		if err != nil {
			return err
		}
	}

	return nil
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
