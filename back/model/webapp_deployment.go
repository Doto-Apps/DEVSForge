package model

import (
	jsonModel "devsforge/json"
	"time"
)

type WebAppDeployment struct {
	ID          string                   `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID      string                   `gorm:"index" json:"userId"`
	ModelID     string                   `gorm:"index" json:"modelId"`
	Name        string                   `json:"name"`
	Slug        string                   `gorm:"uniqueIndex" json:"slug"`
	Description string                   `json:"description"`
	Prompt      string                   `json:"prompt"`
	IsPublic    bool                     `json:"isPublic"`
	Contract    jsonModel.WebAppContract `gorm:"serializer:json" json:"contract"`
	UISchema    jsonModel.WebAppUISchema `gorm:"serializer:json" json:"uiSchema"`
	CreatedAt   time.Time                `json:"createdAt"`
	UpdatedAt   time.Time                `json:"updatedAt"`
}
