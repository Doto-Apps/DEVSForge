package utils

import (
	"devsforge/simulator/shared"
	"encoding/json"
)

func ParseManifest(manifestStr string, target *shared.RunnableManifest) error {
	err := json.Unmarshal([]byte(manifestStr), target)
	if err != nil {
		return err
	}

	return nil
}
