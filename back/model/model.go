// Package model provides database models and entity definitions.
package model

import (
	"devsforge-shared/integrations"
	"gorm.io/gorm"
	"time"

	"devsforge/enum"
	"devsforge/json"
)

type Model struct {
	ID                 string                 `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID             string                 `json:"userId"`
	LibID              *string                `json:"libId"`
	Name               string                 `json:"name"`
	Type               enum.ModelType         `gorm:"type:model_type" json:"type"`
	Language           string                 `gorm:"-" json:"language,omitempty"`
	IntegrationID      *string                `json:"integrationId"`
	IntegrationVersion *string                `json:"integrationVersion"`
	Description        string                 `json:"description"`
	Code               string                 `json:"code"`
	Ports              []json.ModelPort       `gorm:"serializer:json" json:"ports"`
	Metadata           json.ModelMetadata     `gorm:"serializer:json" json:"metadata"`
	Connections        []json.ModelConnection `gorm:"serializer:json" json:"connections"`
	CreatedAt          time.Time              `json:"createdAt"`
	UpdatedAt          time.Time              `json:"updatedAt"`
	DeletedAt          *time.Time             `gorm:"index" json:"deletedAt"`
	Components         []json.ModelComponent  `gorm:"serializer:json" json:"components"`
}

// AfterFind derives language; it is no longer persisted independently of the profile.
func (m *Model) AfterFind(tx *gorm.DB) error {
	m.Language = ""
	if m.IntegrationID != nil && m.IntegrationVersion != nil {
		var profile struct{ Language string }
		if err := tx.Session(&gorm.Session{NewDB: true}).Table("integrations").Select("language").Where("id=? AND version=?", *m.IntegrationID, *m.IntegrationVersion).Take(&profile).Error; err != nil {
			return err
		}
		m.Language = profile.Language
	}
	return nil
}

func (m *Model) BeforeCreate(_ *gorm.DB) error {
	if m.Type == enum.Coupled {
		m.Language = ""
		m.IntegrationID = nil
		m.IntegrationVersion = nil
		return nil
	}
	id, version := "", ""
	if m.IntegrationID != nil {
		id = *m.IntegrationID
	}
	if m.IntegrationVersion != nil {
		version = *m.IntegrationVersion
	}
	d, err := integrations.Resolve(id, version, m.Language)
	if err != nil {
		return err
	}
	m.Language = d.Language
	m.IntegrationID = &d.ID
	m.IntegrationVersion = &d.Version
	return nil
}
