package model

import (
	"time"
)

// Library struct
type Library struct {
	ID          string    `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID      string    `json:"userId"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	DeletedAt   time.Time `gorm:"index" json:"deletedAt"`
	Models      []Model   `gorm:"foreignKey:LibID;constraint:OnDelete:CASCADE;" json:"models"`
}
