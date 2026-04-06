// Package utils provides utility functions for manifest parsing and simulator root detection.
package utils

import (
	shared "devsforge-shared"
	"encoding/json"
)

func ParseManifest(manifestStr string, target *shared.RunnableManifest) error {
	err := json.Unmarshal([]byte(manifestStr), target)
	if err != nil {
		return err
	}

	return nil
}
