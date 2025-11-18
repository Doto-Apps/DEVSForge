// simulator/internal/py.go
package internal

import (
	"context"
	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/shared"
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

// PreparePythonWrapper : version Python de PrepareGoWraper.
// Elle génère model.py + main.py, lance le process Python, puis attend que le gRPC soit prêt.
func PreparePythonWraper(wrapper *WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("PreparePythonWrapper: missing config")
	}

	// Répertoire racine pour le langage
	langRoot := filepath.Join(wrapper.RootDir, "python")
	if _, err := os.Stat(langRoot); os.IsNotExist(err) {
		if err := os.MkdirAll(langRoot, 0o755); err != nil {
			return fmt.Errorf("failed to create python root dir: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to stat python root dir: %w", err)
	}
	wrapper.LangRoot = langRoot

	// Répertoire du modèle
	modelDir := filepath.Join(langRoot, cfg.ID)
	if _, err := os.Stat(modelDir); os.IsNotExist(err) {
		if err := os.MkdirAll(modelDir, 0o755); err != nil {
			return fmt.Errorf("failed to create model dir: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to stat model dir: %w", err)
	}
	wrapper.ModelDir = modelDir

	// Fichiers Python à générer
	modelPath := filepath.Join(modelDir, "model.py")
	bootstrapPath := filepath.Join(modelDir, "main.py")

	// Écrit le code du modèle Python fourni dans cfg.Model.Code
	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write model.py: %w", err)
	}

	// Bootstrap Python (gRPC + NewModel(...))
	bootstrapSrc := GeneratePythonBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write main.py: %w", err)
	}

	// On sérialise le RunnableModel pour le passer en --json
	modelJSON, err := json.Marshal(cfg.Model)
	if err != nil {
		return fmt.Errorf("failed to marshal model config for python wrapper: %w", err)
	}

	// Commande Python (python sur Windows, python3 sur Unix)
	pyCmd := pythonCommand()
	cmd := exec.Command(pyCmd, "main.py", "--json", string(modelJSON))
	cmd.Dir = modelDir

	// On récupère la racine du projet (là où il y a wrappers/, proto/, etc.)
	projectRoot, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory for PYTHONPATH: %w", err)
	}

	// On passe le port gRPC via l'environnement + le PYTHONPATH
	portStr := strconv.Itoa(cfg.GRPC.Port)
	env := append(os.Environ(),
		"GRPC_PORT="+portStr,
		"PYTHONPATH="+projectRoot, // 👈 clé pour pouvoir faire from wrappers.python.rcp.devsModelServer import serve
	)
	cmd.Env = env

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start python model process: %w", err)
	}

	log.Printf("Started PY model process (id=%s, pid=%d)", cfg.ID, cmd.Process.Pid)
	wrapper.Cmd = cmd

	// On surveille le process pour détecter un crash avant que le gRPC soit prêt
	procErrCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		procErrCh <- err
	}()

	// Connexion gRPC avec surveillance du process et timeout (même logique que Go)
	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)
	log.Printf("Waiting for PY gRPC server at %s to be ready...", addr)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for PY gRPC server to be ready")

		case perr := <-procErrCh:
			if perr != nil {
				return fmt.Errorf("python model process exited before gRPC was ready: %w", perr)
			}
			return fmt.Errorf("python model process exited before gRPC was ready (no error from Wait)")

		case <-ticker.C:
			// Tentative de connexion
			conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				continue
			}

			// Test rapide : Initialize()
			testCtx, testCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			modelClient := devspb.NewAtomicModelServiceClient(conn)
			_, testErr := modelClient.Initialize(testCtx, &emptypb.Empty{})
			testCancel()

			if testErr == nil {
				log.Println("✅ PY gRPC server is ready and responding")
				wrapper.GRPCConn = conn
				return nil
			}

			conn.Close()
		}
	}
}

// pythonCommand renvoie le nom de l'interpréteur Python à utiliser.
func pythonCommand() string {
	if runtime.GOOS == "windows" {
		return "python" // ou "py" selon ta config
	}
	return "python3"
}

// GeneratePythonBootstrapSource génère le main.py qui:
// - parse --json,
// - instancie NewModel(config),
// - lance le serveur gRPC Python (DevsModelServer).
func GeneratePythonBootstrapSource(cfg *RunnerConfig) string {
	return fmt.Sprintf(`import argparse
import json
import logging
import os

from simulator.wrappers.python.rpc.devsModelServer import serve  # ton serveur gRPC Python
from model import NewModel  # fonction NewModel(cfg) dans model.py


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[PY-WRAPPER] %%(message)s")
    logging.info("wrapper starting (PID=%%s)", os.getpid())
    logging.info("======================================")
    logging.info("   ⚙️ Wrapper RPC for model %s")
    logging.info("======================================")

    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True, help="JSON string to parse")
    args = parser.parse_args()

    # Parse le JSON en dict. À toi de mapper ça vers ta structure dans NewModel.
    config = json.loads(args.json)

    # Création du modèle utilisateur (implémenté dans model.py)
    model = NewModel(config)

    # Récupération du port gRPC : priorité à l'env, sinon valeur par défaut compilée
    port_str = os.environ.get("GRPC_PORT", "%d")
    try:
        port = int(port_str)
    except ValueError:
        raise SystemExit(f"Invalid GRPC_PORT value: {port_str!r}")

    host = "127.0.0.1"

    logging.info("Starting gRPC server on %%s:%%d", host, port)
    serve(model, host=host, port=port)


if __name__ == "__main__":
    main()
`, cfg.Model.Name, cfg.GRPC.Port)
}
