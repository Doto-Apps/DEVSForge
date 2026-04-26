package utils

import (
	"os"
	"path/filepath"
)

// CreateTempDir creates a unique temp directory under <path>.
func CreateTempDir(path string) (string, error) {
	base := filepath.Join(path)
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	return os.MkdirTemp(base, "devsforge_test_*")
}

func RemoveRootTempDir(path string) error {
	base := filepath.Join(path)
	return os.RemoveAll(base)
}
