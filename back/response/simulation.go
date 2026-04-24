package response

import (
	"devsforge/model"
	"encoding/json"
	"time"
)

type SimulationResponse struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"userId"`
	ModelID      string                 `json:"modelId"`
	Status       model.SimulationStatus `json:"status"`
	ErrorMessage *string                `json:"errorMessage,omitempty"`
	StartedAt    *time.Time             `json:"startedAt,omitempty"`
	CompletedAt  *time.Time             `json:"completedAt,omitempty"`
	CreatedAt    time.Time              `json:"createdAt"`
}

type SimulationResultResponse struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"userId"`
	ModelID      string                 `json:"modelId"`
	Status       model.SimulationStatus `json:"status"`
	Results      any                    `json:"results,omitempty"`
	ErrorMessage *string                `json:"errorMessage,omitempty"`
	StartedAt    *time.Time             `json:"startedAt,omitempty"`
	CompletedAt  *time.Time             `json:"completedAt,omitempty"`
	CreatedAt    time.Time              `json:"createdAt"`
}

// SimulationEventResponse represents a single DEVS event
type SimulationEventResponse struct {
	ID             string    `json:"id"`
	SimulationID   string    `json:"simulationId"`
	CreatedAt      time.Time `json:"createdAt"`
	SimulationTime *float64  `json:"simulationTime"`
	MsgType        string    `json:"msgType"`
	Sender         *string   `json:"sender"`
	Target         *string   `json:"target"`
	Payload        any       `json:"payload"`
}

// SimulationEventsResponse is the paginated response for events
type SimulationEventsResponse struct {
	Events     []SimulationEventResponse `json:"events"`
	Total      int64                     `json:"total"`
	Limit      int                       `json:"limit"`
	Offset     int                       `json:"offset"`
	Simulation SimulationResponse        `json:"simulation"`
}

func CreateSimulationResponse(s model.Simulation) SimulationResponse {
	return SimulationResponse{
		ID:           s.ID,
		UserID:       s.UserID,
		ModelID:      s.ModelID,
		Status:       s.Status,
		ErrorMessage: s.ErrorMessage,
		StartedAt:    s.StartedAt,
		CompletedAt:  s.CompletedAt,
		CreatedAt:    s.CreatedAt,
	}
}

// CreateSimulationEventResponse creates a response from a SimulationEvent model
func CreateSimulationEventResponse(e model.SimulationEvent) SimulationEventResponse {
	var payload any
	if len(e.Payload) > 0 {
		_ = json.Unmarshal(e.Payload, &payload)
	}

	return SimulationEventResponse{
		ID:             e.ID,
		SimulationID:   e.SimulationID,
		CreatedAt:      e.CreatedAt,
		SimulationTime: e.SimulationTime,
		MsgType:        e.MsgType,
		Sender:         e.Sender,
		Target:         e.Target,
		Payload:        payload,
	}
}

// CreateSimulationEventsResponse creates a paginated response for events
func CreateSimulationEventsResponse(events []model.SimulationEvent, total int64, limit, offset int, simulation model.Simulation) SimulationEventsResponse {
	responses := make([]SimulationEventResponse, 0, len(events))
	for _, e := range events {
		responses = append(responses, CreateSimulationEventResponse(e))
	}
	return SimulationEventsResponse{
		Events:     responses,
		Total:      total,
		Limit:      limit,
		Offset:     offset,
		Simulation: CreateSimulationResponse(simulation),
	}
}
