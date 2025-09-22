package model

import (
	"time"

	"devsforge/back/enum"
	"devsforge/back/json"
)

type Model struct {
	ID          string                 `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	UserID      string                 `gorm:"type:uuid" json:"userId"`
	LibID       *string                `gorm:"type:uuid" json:"libId"`
	Name        string                 `gorm:"type:varchar(255);not null" json:"name"`
	Type        enum.ModelType         `gorm:"type:model_type;not null" json:"type"`
	Description string                 `gorm:"type:text;not null" json:"description"`
	Code        string                 `gorm:"type:text;not null" json:"code"`
	Ports       []json.ModelPort       `gorm:"type:json;default:'[]';serializer:json" json:"ports"`
	Metadata    json.ModelMetadata     `gorm:"type:json;default:'{}';serializer:json" json:"metadata"`
	Connections []json.ModelConnection `gorm:"type:json;default:'[]';serializer:json" json:"connections"`
	CreatedAt   time.Time              `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt   time.Time              `gorm:"type:timestamp;default:now()" json:"updatedAt"`
	DeletedAt   *time.Time             `gorm:"index" json:"deletedAt"`
	Components  []json.ModelComponent  `gorm:"type:json;default:'[]';serializer:json" json:"components"`
}
