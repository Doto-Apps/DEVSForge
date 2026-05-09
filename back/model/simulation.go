package model

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type SimulationStatus string

const (
	SimulationStatusPending   SimulationStatus = "pending"
	SimulationStatusRunning   SimulationStatus = "running"
	SimulationStatusCompleted SimulationStatus = "completed"
	SimulationStatusFailed    SimulationStatus = "failed"
)

func (SimulationStatus) GormDBDataType(db *gorm.DB, field *schema.Field) string {
	return "simulation_status"
}

type Simulation struct {
	ID           string           `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	UserID       string           `json:"userId"`
	ModelID      string           `json:"modelId"`
	Status       SimulationStatus `gorm:"type:simulation_status" json:"status"`
	Manifest     string           `gorm:"serializer:json" json:"manifest"`
	Results      *string          `gorm:"serializer:json" json:"results"`
	ErrorMessage *string          `json:"errorMessage"`
	StartedAt    *time.Time       `json:"startedAt"`
	CompletedAt  *time.Time       `json:"completedAt"`
	CreatedAt    time.Time        `json:"createdAt"`
	UpdatedAt    time.Time        `json:"updatedAt"`
}

// SimulationEvent represents a single DEVS message that transited during a simulation
type SimulationEvent struct {
	ID           string         `gorm:"primaryKey;default:uuid_generate_v4();<-:false" json:"id"`
	SimulationID string         `gorm:"index" json:"simulationId"`
	CreatedAt    time.Time      `json:"createdAt"`
	Message      datatypes.JSON `gorm:"column:payload;serializer:json" json:"message"`
}
