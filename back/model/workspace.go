package model

import (
	"time"
)

// Workspace struct
type Workspace struct {
	ID          string    `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	UserID      string    `gorm:"type:uuid" json:"userId"`
	Title       string    `gorm:"not null" json:"title"`
	Description string    `gorm:"not null" json:"description"`
	CreatedAt   time.Time `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"type:timestamp;default:now()" json:"updatedAt"`
	DeletedAt   time.Time `gorm:"index" json:"deletedAt"`
	Diagrams    []Diagram `gorm:"foreignKey:WorkspaceID;constraint:OnDelete:CASCADE;" json:"diagrams"`
}