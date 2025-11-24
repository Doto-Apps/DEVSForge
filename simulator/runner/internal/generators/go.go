package generators

import (
	"context"
	"devsforge-runner/internal/config"
	shared "devsforge-shared"
	devspb "devsforge-wrapper/proto"

	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

var goMainFileName = "main.go"
var goModelFileName = "model.go"

// PrepareGoWraper : tout ce qui était avant le label "connected:" dans l'ancienne LaunchSim
func PrepareGoWraper(wrapper *WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("prepareGoWraper: missing config")
	}

	bootstrapPath := filepath.Join(wrapper.ModelDir, goMainFileName)
	modelPath := filepath.Join(wrapper.ModelDir, "model.go")

	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", goModelFileName, err)
	}

	bootstrapSrc := GenerateGoBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", goMainFileName, err)
	}

	// SOLUTION PROPRE : Compiler le binaire une fois
	binaryName := "model_wrapper"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}
	binaryPath := filepath.Join(wrapper.ModelDir, binaryName)

	log.Printf("Compiling model wrapper...")
	buildCmd := exec.Command("go", "build", "-o", binaryPath, ".")
	buildCmd.Dir = wrapper.ModelDir
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		return fmt.Errorf("failed to compile model wrapper: %w", err)
	}
	log.Printf("✅ Model wrapper compiled: %s", binaryPath)

	modelJSON, err := json.Marshal(cfg.Model)
	if err != nil {
		return fmt.Errorf("failed to marshal model config for runner: %w", err)
	}

	// Lancement du binaire compilé (pas de processus enfant !)
	cmd := exec.Command(binaryPath, "--json", string(modelJSON))
	cmd.Dir = wrapper.ModelDir
	portStr := strconv.Itoa(cfg.GRPC.Port)
	cmd.Env = append(os.Environ(), "GRPC_PORT="+portStr)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start model process: %w", err)
	}

	log.Printf("Started model process (id=%s, pid=%d)", cfg.ID, cmd.Process.Pid)
	wrapper.Cmd = cmd

	// On surveille le process pour détecter un crash avant que le gRPC soit prêt
	procErrCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		procErrCh <- err
	}()

	// Connexion gRPC avec surveillance du process et timeout
	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)
	log.Printf("Waiting for gRPC server at %s to be ready...", addr)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

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
			conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				continue
			}

			// Test si le serveur répond vraiment avec un ping rapide
			testCtx, testCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			modelClient := devspb.NewAtomicModelServiceClient(conn)
			_, testErr := modelClient.Initialize(testCtx, &emptypb.Empty{})
			testCancel()

			if testErr == nil {
				// Connexion réussie !
				log.Println("✅ gRPC server is ready and responding")
				wrapper.GRPCConn = conn
				return nil
			}

			// Si ça a échoué, on ferme cette connexion et on réessaie
			conn.Close()
		}
	}
}

func GenerateGoBootstrapSource(cfg *config.RunnerConfig) string {
	return fmt.Sprintf(`package main
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net"
	"os"

	"wrapper/modeling"
	devspb "wrapper/proto"
	rpcwrapper "wrapper/rpc"

	"google.golang.org/grpc"
)

func main() {
	log.SetPrefix("[WRAPPER] ")
	log.Printf("wrapper PID=%%d starting...", os.Getpid())
	log.Println("======================================")
	log.Println("   ⚙️ Wrapper RPC for model %s")
	log.Println("======================================")

	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse") // --json "<...>"

	var config modeling.RunnableModel

	// Parse les arguments de la ligne de commande
	if err := fs.Parse(os.Args[1:]); err != nil {
		log.Fatalf("error parsing flags: %%v", err)
	}

	// Récupération / parsing du JSON
	if *jsonStr == "" {
		log.Fatalf("please provide --json")
	}

	if err := json.Unmarshal([]byte(*jsonStr), &config); err != nil {
		log.Fatalf("error parsing JSON: %%v", err)
	}

	// Création du modèle utilisateur : TOUT est géré dans model.go
	model := NewModel(config)

	// Port gRPC défini dans la config du runner
	port := "%d"

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %%v", err)
	}

	s := grpc.NewServer()
	devspb.RegisterAtomicModelServiceServer(s, rpcwrapper.NewDEVSModelServer(model))

	log.Println("DEVS model", config.Name, "listening on :"+port)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %%v", err)
	}
}
`, cfg.Model.Name, cfg.GRPC.Port)
}
