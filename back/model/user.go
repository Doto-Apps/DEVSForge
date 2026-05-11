package model

import (
	"time"
)

// User struct
type User struct {
	ID           string    `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	Username     string    `gorm:"uniqueIndex" validate:"required,min=3,max=50" json:"username"`
	Email        string    `gorm:"uniqueIndex" validate:"required,email" json:"email"`
	Password     string    `validate:"required,min=6,max=50" json:"password"`
	Fullname     string    `json:"fullname"`
	RefreshToken string    `json:"refresh_token"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	DeletedAt    time.Time `gorm:"index" json:"deletedAt"`
	ModelTypes   []Model   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"modelTypes"`
	Libraries    []Library `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"libraries"`
}
