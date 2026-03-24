package model

import "time"

type ExperimentalFrame struct {
	ID            string     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	UserID        string     `gorm:"type:uuid;not null;index" json:"userId"`
	TargetModelID string     `gorm:"type:uuid;not null;index;uniqueIndex:idx_target_frame" json:"targetModelId"`
	FrameModelID  string     `gorm:"type:uuid;not null;index;uniqueIndex:idx_target_frame" json:"frameModelId"`
	CreatedAt     time.Time  `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"type:timestamp;default:now()" json:"updatedAt"`
	DeletedAt     *time.Time `gorm:"index" json:"deletedAt"`
}
