// Package cmd : Run a go model
package cmd

import (
	"context"
	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/runner/internal"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

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
	// a remettre plutard
	/*
		switch manifest.Models[0].Language {
		case "go":

		case "java":
			panic("Python langage for runner is not implemented")
		case "python":
			panic("Python langage for runner is not implemented")
		default:
			panic("Model language not implemented")
		}*/

	LaunchSim(manifest, *configFile)

	log.Println("======================================")
	log.Println("   ⚙️ Runner ended successfully ✅    ")
	log.Println("======================================")
	return nil
}

func LaunchSim(manifest shared.RunnableManifest, yamlConfigFilePath string) error {
	log.Println("Init model")
	cfg := internal.InitConfig(manifest, yamlConfigFilePath)

	rootDir, err := os.MkdirTemp(".", "devsforge_"+manifest.SimulationID+"_")
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir: %w", err)
	}

	defer func() {
		if err := os.RemoveAll(rootDir); err != nil {
			log.Printf("⚠️ failed to remove temp dir %s: %v", rootDir, err)
		} else {
			log.Printf("🧹 temp dir %s removed", rootDir)
		}
	}()

	// Coucou antoine, c'est antoine ici tu peux changer ajouter le cas ou c'est un autre langage

	langageRoot := filepath.Join(rootDir, "go")
	if err := os.MkdirAll(langageRoot, 0o755); err != nil {
		return fmt.Errorf("failed to create go root dir: %w", err)
	}

	modelDir := filepath.Join(langageRoot, cfg.ID)
	if err := os.MkdirAll(modelDir, 0o755); err != nil {
		return fmt.Errorf("failed to create model dir: %w", err)
	}

	bootstrapPath := filepath.Join(modelDir, "main.go")
	modelPath := filepath.Join(modelDir, "model.go")

	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write model.go: %w", err)
	}

	bootstrapSrc := internal.GenerateBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write main.go: %w", err)
	}

	modelJSON, err := json.Marshal(cfg.Model)
	if err != nil {
		return fmt.Errorf("failed to marshal model config for runner: %w", err)
	}

	// Lancement du wrapper
	cmd := exec.Command("go", "run", "main.go", "--json", string(modelJSON))
	cmd.Dir = modelDir
	portStr := strconv.Itoa(cfg.GRPC.Port)
	cmd.Env = append(os.Environ(), "GRPC_PORT="+portStr)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start model process: %w", err)
	}

	log.Printf("Started model process (id=%s, pid=%d)", cfg.ID, cmd.Process.Pid)

	// On surveille le process dans une goroutine
	procErrCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		procErrCh <- err
	}()

	// Cleanup du process à la fin de LaunchSim
	defer func() {
		if cmd.Process == nil {
			return
		}
		log.Printf("Stopping model process id=%s pid=%d", cfg.ID, cmd.Process.Pid)

		// S'il est déjà mort, Kill renverra une erreur, on log juste.
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("⚠️ failed to kill model process (maybe already exited): %v", err)
		}
	}()

	// Connexion gRPC avec surveillance du process et timeout
	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)
	log.Printf("Waiting for gRPC server at %s to be ready...", addr)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var conn *grpc.ClientConn
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for gRPC server to be ready")

		case perr := <-procErrCh:
			if perr != nil {
				return fmt.Errorf("model process exited before gRPC was ready: %w", perr)
			}
			return fmt.Errorf("model process exited before gRPC was ready (no error from Wait)")

		case <-ticker.C:
			// Tentative de connexion
			conn, err = grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				continue
			}

			// Test si le serveur répond vraiment avec un ping rapide
			testCtx, testCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			modelClient := devspb.NewDevsModelClient(conn)
			_, testErr := modelClient.Initialize(testCtx, &devspb.InitializeRequest{
				ModelName: cfg.Model.Name,
			})
			testCancel()

			if testErr == nil {
				// Connexion réussie !
				log.Println("✅ gRPC server is ready and responding")
				goto connected
			}

			// Si ça a échoué, on ferme cette connexion et on réessaie
			conn.Close()
			conn = nil
		}
	}

connected:
	defer conn.Close()

	modelClient := devspb.NewDevsModelClient(conn)
	internal.SetModelClient(modelClient)
	modelClient.Initialize(ctx, &devspb.InitializeRequest{
		ModelName: cfg.Model.Name,
	})
	log.Println("Waiting for all models to be init")
	internal.SendMessage("init_done")
	internal.WaitForAllReady(30 * time.Second)
	log.Println("All models are ready, time election")

	// TODO: internal.RunMainLoop()

	return nil
}
