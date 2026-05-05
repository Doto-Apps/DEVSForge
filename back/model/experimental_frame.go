package model

import "time"

type ExperimentalFrame struct {
	ID            string     `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID        string     `gorm:"index" json:"userId"`
	TargetModelID string     `gorm:"index" json:"targetModelId"`
	FrameModelID  string     `gorm:"index" json:"frameModelId"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	DeletedAt     *time.Time `gorm:"index" json:"deletedAt"`
}
