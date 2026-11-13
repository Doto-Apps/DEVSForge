// simulator/internal/py.go
package xdevspython

import (
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	shared "devsforge-shared"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

var (
	pythonMainFileName  = "main.py"
	pythonModelFileName = "model.py"
)

// PreparePythonWrapper : version Python de PrepareGoWraper.
// Elle génère model.py + main.py, lance le process Python, puis attend que le gRPC soit prêt.
func PreparePythonWraper(wrapper *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	if err := PrepareSources(wrapper, manifest); err != nil {
		return err
	}
	modelJSON, err := json.Marshal(wrapper.Cfg.Model)
	if err != nil {
		return err
	}
	cmd := exec.Command(generators.PythonCommand(), pythonMainFileName, "--json", string(modelJSON))
	return generators.LaunchModelProcess(wrapper, cmd, "xDEVS Python")
}

// GeneratePythonBootstrapSource génère le main.py qui:
// - parse --json,
// - instancie NewModel(config),
// - lance le serveur gRPC Python (DevsModelServer).
func GeneratePythonBootstrapSource(cfg *config.RunnerConfig) string {
	return fmt.Sprintf(`import argparse
import json
import logging
import os

from rpc.devsModelServer import serve  # ton serveur gRPC Python
from model import NewModel  # fonction NewModel(cfg) dans model.py


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[PY-WRAPPER] %%(message)s")

    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True, help="JSON string to parse")
    args = parser.parse_args()

    # Parse le JSON en dict. À toi de mapper ça vers ta structure dans NewModel.
    config = json.loads(args.json)
    logging.info("wrapper starting for model %%s (PID=%%s)", config.get("name"), os.getpid())

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
`, cfg.GRPC.Port)
}

func PrepareSources(wrapper *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil || cfg.Model == nil {
		return fmt.Errorf("PreparePythonWrapper: missing config")
	}

	// Fichiers Python à générer
	modelPath := filepath.Join(wrapper.ModelDir, pythonModelFileName)
	bootstrapPath := filepath.Join(wrapper.ModelDir, pythonMainFileName)

	// Écrit le code du modèle Python fourni dans cfg.Model.Code
	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", pythonModelFileName, err)
	}

	// Bootstrap Python (gRPC + NewModel(...))
	bootstrapSrc := GeneratePythonBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", pythonMainFileName, err)
	}

	return nil
}
