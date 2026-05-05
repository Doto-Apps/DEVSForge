// Package model provides database models and entity definitions.
package model

import (
	"time"

	"devsforge/enum"
	"devsforge/json"
)

type Model struct {
	ID          string                 `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID      string                 `json:"userId"`
	LibID       *string                `json:"libId"`
	Name        string                 `json:"name"`
	Type        enum.ModelType         `gorm:"type:model_type" json:"type"`
	Language    enum.ModelLanguage     `gorm:"type:model_language" json:"language"`
	Description string                 `json:"description"`
	Code        string                 `json:"code"`
	Ports       []json.ModelPort       `gorm:"serializer:json" json:"ports"`
	Metadata    json.ModelMetadata     `gorm:"serializer:json" json:"metadata"`
	Connections []json.ModelConnection `gorm:"serializer:json" json:"connections"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	DeletedAt   *time.Time             `gorm:"index" json:"deletedAt"`
	Components  []json.ModelComponent  `gorm:"serializer:json" json:"components"`
}
