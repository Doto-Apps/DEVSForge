package model

import (
	jsonModel "devsforge/json"
	"time"
)

type WebAppDeployment struct {
	ID          string                   `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	UserID      string                   `gorm:"type:uuid;not null;index" json:"userId"`
	ModelID     string                   `gorm:"type:uuid;not null;index" json:"modelId"`
	Name        string                   `gorm:"type:varchar(255);not null" json:"name"`
	Slug        string                   `gorm:"type:varchar(255);not null;uniqueIndex" json:"slug"`
	Description string                   `gorm:"type:text;not null;default:''" json:"description"`
	Prompt      string                   `gorm:"type:text;not null;default:''" json:"prompt"`
	IsPublic    bool                     `gorm:"not null;default:false" json:"isPublic"`
	Contract    jsonModel.WebAppContract `gorm:"type:json;not null;serializer:json" json:"contract"`
	UISchema    jsonModel.WebAppUISchema `gorm:"type:json;not null;serializer:json" json:"uiSchema"`
	CreatedAt   time.Time                `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt   time.Time                `gorm:"type:timestamp;default:now()" json:"updatedAt"`
}
