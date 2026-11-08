package model

import "time"

// UserAISettings stores per-user AI provider configuration.
type UserAISettings struct {
	UserID                string    `gorm:"primaryKey;default:uuid_generate_v4()" json:"userId"`
	APIURL                string    `gorm:"type:text" json:"apiUrl"`
	APIKey                string    `gorm:"type:text" json:"-"`
	APIModel              string    `json:"apiModel"`
	TranscriptionAPIURL   string    `gorm:"type:text" json:"transcriptionApiUrl"`
	TranscriptionAPIKey   string    `gorm:"type:text" json:"-"`
	TranscriptionAPIModel string    `gorm:"type:text" json:"transcriptionApiModel"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}
