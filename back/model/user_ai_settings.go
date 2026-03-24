package model

import "time"

// UserAISettings stores per-user AI provider configuration.
type UserAISettings struct {
	UserID    string    `gorm:"type:uuid;primaryKey" json:"userId"`
	APIURL    string    `gorm:"type:text;not null;default:''" json:"apiUrl"`
	APIKey    string    `gorm:"type:text;not null;default:''" json:"-"`
	APIModel  string    `gorm:"type:varchar(255);not null;default:''" json:"apiModel"`
	CreatedAt time.Time `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:now()" json:"updatedAt"`
}
