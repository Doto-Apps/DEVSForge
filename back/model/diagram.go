package model

import (
	"time"
)

// Library struct
type Diagram struct {
	ID          string    `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	ModelID     string    `gorm:"type:uuid;not null" json:"modelId"`
	WorkspaceID string    `gorm:"type:uuid;not null" json:"workspaceId"`
	UserID      string    `gorm:"type:uuid;not null" json:"userId"`
	Name        string    `gorm:"not null;size:50;" validate:"required,min=3,max=50" json:"name"`
	Description string    `gorm:"not null" json:"description"`
	CreatedAt   time.Time `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"type:timestamp;default:now()" json:"updatedAt"`
	DeletedAt   time.Time `gorm:"index" json:"deletedAt"`
	//Model       Model     `gorm:"foreignKey:ID;constraint:OnDelete:CASCADE;" json:"model"`
}
