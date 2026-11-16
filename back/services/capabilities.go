package services

import (
	"devsforge-shared/integrations"
	"devsforge/model"
	"fmt"
)

// CheckSimulation follows reusable definitions, including unsupported nested atomics.
func CheckSimulation(models []model.Model) error {
	defs, err := integrations.List()
	if err != nil {
		return err
	}
	profiles, legacy := map[string]integrations.Definition{}, map[string]integrations.Definition{}
	for _, d := range defs {
		profiles[d.ID+"@"+d.Version] = d
		if d.LegacyLanguage != "" {
			legacy[d.LegacyLanguage] = d
		}
	}
	for _, m := range models {
		if m.ImportSource != nil && m.ImportSource.Reason != "" {
			return fmt.Errorf("%s: %s", m.Name, m.ImportSource.Reason)
		}
		if m.Type != "atomic" {
			continue
		}
		if m.ImportSource != nil && (m.IntegrationID == nil || m.IntegrationVersion == nil) {
			return fmt.Errorf("%s: imported framework is unavailable; simulation and experimental frames are disabled", m.Name)
		}
		id, version := "", ""
		if m.IntegrationID != nil {
			id = *m.IntegrationID
		}
		if m.IntegrationVersion != nil {
			version = *m.IntegrationVersion
		}
		if m.ImportSource != nil {
			if reason := ImportedSourceIssue(id, m.Code); reason != "" {
				return fmt.Errorf("%s: %s", m.Name, reason)
			}
		}
		d, ok := profiles[id+"@"+version]
		if id == "" {
			d, ok = legacy[m.Language]
		}
		if !ok || (m.Language != "" && d.Language != m.Language) || !d.Capabilities.Simulation {
			return fmt.Errorf("%s: simulation integration unavailable", m.Name)
		}
	}
	return nil
}

func CheckModelSimulation(modelID, userID string) error {
	models, err := GetModelRecursice(modelID, userID)
	if err != nil {
		return err
	}
	return CheckSimulation(models)
}
