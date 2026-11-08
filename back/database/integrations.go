package database

import (
	"devsforge-shared/integrations"
	"fmt"
	"gorm.io/gorm"
	"log/slog"
	"os"
)

// SyncIntegrations never removes historical versions referenced by models.
func SyncIntegrations() error {
	defs, err := integrations.List()
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, d := range defs {
			var old struct{ Digest string }
			if err := tx.Raw("SELECT digest FROM integrations WHERE id=? AND version=?", d.ID, d.Version).Scan(&old).Error; err != nil {
				return err
			}
			if old.Digest != "" && old.Digest != d.Digest && os.Getenv("INTEGRATIONS_ALLOW_CHANGES") != "true" {
				return fmt.Errorf("integration %s@%s changed: bump its version", d.ID, d.Version)
			}
			if old.Digest != "" && old.Digest != d.Digest {
				slog.Info("Refreshing development integration resources", "integration", d.ID)
			}
			if err := tx.Exec("INSERT INTO integrations(id,version,name,language,framework,digest) VALUES(?,?,?,?,?,?) ON CONFLICT(id,version) DO UPDATE SET name=EXCLUDED.name,language=EXCLUDED.language,framework=EXCLUDED.framework,digest=EXCLUDED.digest", d.ID, d.Version, d.Name, d.Language, d.Framework, d.Digest).Error; err != nil {
				return err
			}
		}

		var referenced []struct{ IntegrationID, IntegrationVersion string }
		if err := tx.Raw("SELECT DISTINCT integration_id,integration_version FROM models WHERE integration_id IS NOT NULL").Scan(&referenced).Error; err != nil {
			return err
		}
		installed := map[string]bool{}
		for _, d := range defs {
			installed[d.ID+"@"+d.Version] = true
		}
		for _, ref := range referenced {
			if !installed[ref.IntegrationID+"@"+ref.IntegrationVersion] {
				return fmt.Errorf("referenced integration %s@%s is missing from installed resources", ref.IntegrationID, ref.IntegrationVersion)
			}
		}
		return nil
	})
}
