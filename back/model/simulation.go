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
	ID           string           `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	UserID       string           `gorm:"type:uuid;not null" json:"userId"`
	ModelID      string           `gorm:"type:uuid;not null" json:"modelId"`
	Status       SimulationStatus `gorm:"type:simulation_status;not null;default:'pending'" json:"status"`
	Manifest     string           `gorm:"type:json;not null" json:"manifest"`
	Results      *string          `gorm:"type:json" json:"results"`
	ErrorMessage *string          `gorm:"type:text" json:"errorMessage"`
	StartedAt    *time.Time       `gorm:"type:timestamp" json:"startedAt"`
	CompletedAt  *time.Time       `gorm:"type:timestamp" json:"completedAt"`
	CreatedAt    time.Time        `gorm:"type:timestamp;default:now()" json:"createdAt"`
	UpdatedAt    time.Time        `gorm:"type:timestamp;default:now()" json:"updatedAt"`
}

// SimulationEvent represents a single DEVS message that transited during a simulation
type SimulationEvent struct {
	ID                     string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey;<-:false" json:"id"`
	SimulationID           string         `gorm:"type:uuid;not null;index" json:"simulationId"`
	CreatedAt              time.Time      `gorm:"type:timestamp;default:now()" json:"createdAt"`
	SimulationTime         *float64       `gorm:"type:double precision" json:"simulationTime"`
	RelativeEventTimestamp int64          `gorm:"type:double precision" json:"relativeEventTimestamp"`
	MsgType                string         `gorm:"type:varchar(100);not null" json:"msgType"`
	Sender                 *string        `gorm:"type:varchar(100)" json:"sender,omitempty"`
	Target                 *string        `gorm:"type:varchar(100)" json:"target"`
	Payload                datatypes.JSON `gorm:"type:jsonb;not null" json:"payload"`
}
