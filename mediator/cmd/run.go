// Package cmd : Run a go model
package cmd

import (
	"context"
	"devsforge/mediator/internal"
	devspb "devsforge/proto"
	"devsforge/shared"
	"devsforge/shared/utils"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// LaunchRunner Launch a runner with args
func LaunchRunner(args []string) error {
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

	rootDir, err := os.MkdirTemp("", "devsforge_"+manifest.SimulationID+"_")
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir: %w", err)
	}

	modelDir := filepath.Join(rootDir, cfg.ID)
	if err := os.MkdirAll(modelDir, 0o755); err != nil {
		return fmt.Errorf("failed to create model dir: %w", err)
	}

	// Create minimal module to resolve imports
	goModPath := filepath.Join(modelDir, "go.mod")
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)
	goMod := `module bootstrap

go 1.21

require (
	google.golang.org/grpc v1.64.0
	google.golang.org/protobuf v1.34.0
)
`
	if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
		return fmt.Errorf("failed to write go.mod: %w", err)
	}

	// Vendor proto stubs locally so imports resolve without replace
	protoSrc := filepath.Join(repoRoot, "proto")
	protoDst := filepath.Join(modelDir, "proto")
	if err := os.MkdirAll(protoDst, 0o755); err != nil {
		return fmt.Errorf("failed to create proto dir: %w", err)
	}
	for _, fn := range []string{"devs.pb.go", "devs_grpc.pb.go"} {
		src := filepath.Join(protoSrc, fn)
		dst := filepath.Join(protoDst, fn)
		b, err := os.ReadFile(src)
		if err != nil { return fmt.Errorf("read %s: %w", src, err) }
		if err := os.WriteFile(dst, b, 0o644); err != nil { return fmt.Errorf("write %s: %w", dst, err) }
	}

	// Provide minimal modeling package expected by user code
	modelingDir := filepath.Join(modelDir, "modeling")
	if err := os.MkdirAll(modelingDir, 0o755); err != nil {
		return fmt.Errorf("failed to create modeling dir: %w", err)
	}
	atomicSrc := `package modeling

import (
	"fmt"
	"math"
)

type Atomic interface {
	TA() float64
	DeltInt()
	DeltExt(e float64)
	DeltCon(e float64)
	Lambda()
	HoldIn(phase string, sigma float64)
	Passivate()
	Continue(e float64)
	GetPhase() string
}

type atomic struct {
	phase string
	sigma float64
}

func NewAtomic(_ string) Atomic { return &atomic{phase: "passive", sigma: math.Inf(1)} }

func (a *atomic) TA() float64 { return a.sigma }
func (a *atomic) DeltInt()    { panic("implement in user model") }
func (a *atomic) DeltExt(e float64)  { _ = e; panic("implement in user model") }
func (a *atomic) DeltCon(e float64)  { _ = e; panic("implement in user model") }
func (a *atomic) Lambda()     { fmt.Print("") }
func (a *atomic) HoldIn(phase string, sigma float64) { a.phase, a.sigma = phase, math.Max(0, sigma) }
func (a *atomic) Passivate()  { a.phase, a.sigma = "passive", math.Inf(1) }
func (a *atomic) Continue(e float64) { a.sigma = a.sigma - e }
func (a *atomic) GetPhase() string { return a.phase }
`
	if err := os.WriteFile(filepath.Join(modelingDir, "atomic.go"), []byte(atomicSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write modeling/atomic.go: %w", err)
	}

	bootstrapPath := filepath.Join(modelDir, "main.go")
	modelPath := filepath.Join(modelDir, "model.go")

	// Rewrite local import path for modeling package to be module-qualified
	code := cfg.Model.Code
	code = strings.ReplaceAll(code, "\"modeling\"", "\"bootstrap/modeling\"")
	if err := os.WriteFile(modelPath, []byte(code), 0o644); err != nil {
		return fmt.Errorf("failed to write model.go: %w", err)
	}

	bootstrapSrc := internal.GenerateBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write main.go: %w", err)
	}

	// Pre-fetch deps and write go.sum
	modCmd := exec.Command("go", "mod", "tidy")
	modCmd.Dir = modelDir
	modCmd.Stdout = os.Stdout
	modCmd.Stderr = os.Stderr
	if err := modCmd.Run(); err != nil {
		return fmt.Errorf("go mod tidy failed: %w", err)
	}

	cmd := exec.Command("go", "run", ".")
	cmd.Dir = modelDir

	portStr := strconv.Itoa(cfg.GRPC.Port)
	cmd.Env = append(os.Environ(), "GRPC_PORT="+portStr)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start model process: %w", err)
	}

	log.Println("Starting model with cmd")

	go func() {
		if err := cmd.Wait(); err != nil {
			log.Printf("⚠️ model process %s exited with error: %v", cfg.ID, err)
		} else {
			log.Printf("ℹ️ model process %s exited cleanly", cfg.ID)
		}
	}()

	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)

	var conn *grpc.ClientConn
	for i := 0; i < 10; i++ {
		conn, err = grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err == nil {
			break
		}
		log.Printf("gRPC not ready yet (%v), retrying...", err)
		time.Sleep(500 * time.Millisecond)
	}
	if err != nil {
		return fmt.Errorf("failed to connect gRPC model server after retries: %w", err)
	}
	defer conn.Close()

	modelClient := devspb.NewDevsModelClient(conn)
	internal.SetModelClient(modelClient)

	_, err = modelClient.Initialize(context.Background(), &devspb.InitializeRequest{
		ModelName: cfg.Model.Name,
	})
	if err != nil {
		return fmt.Errorf("initialize rpc failed: %w", err)
	}

	time.Sleep(5 * time.Second)
	log.Println("Waiting for all models to be init")
	internal.SendMessage("init_done")
	internal.WaitForAllReady(30 * time.Second)
	log.Println("All models are ready, time election")

	// TODO: internal.RunMainLoop()

	return nil
}
