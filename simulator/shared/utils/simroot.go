package utils

import (
	"errors"
	"os"
	"path/filepath"
)

const EnvSimulatorRoot = "DEVSFORGE_SIM_ROOT"

// SimulatorRoot walks up from the current working directory to locate the simulator root.
// The simulator root is expected to contain: runner/, coordinator/, wrappers/, tests/.
func SimulatorRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	dir, err := filepath.Abs(wd)
	if err != nil {
		return "", err
	}

	for {
		if isSimulatorRoot(dir) {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", errors.New("simulator root not found (expected runner/, coordinator/, wrappers/, tests/ in a parent directory)")
}

func isSimulatorRoot(dir string) bool {
	return exists(filepath.Join(dir, "runner")) &&
		exists(filepath.Join(dir, "coordinator")) &&
		exists(filepath.Join(dir, "wrappers")) &&
		exists(filepath.Join(dir, "tests"))
}

func exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// CreateTempDir creates a unique temp directory under <simRoot>/tmp.
func CreateTempDir(simRoot string) (string, error) {
	base := filepath.Join(simRoot, "tmp")
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	return os.MkdirTemp(base, "devsforge_test_")
}

func RemoveRootTempDir(simRoot string) error {
	base := filepath.Join(simRoot, "tmp")
	return os.RemoveAll(base)
}
