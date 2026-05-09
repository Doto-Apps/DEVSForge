package response

import (
	shared_kafka "devsforge-shared/kafka"
	"devsforge/model"
	"log/slog"
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
	ID           string                             `json:"id"`
	SimulationID string                             `json:"simulationId"`
	CreatedAt    time.Time                          `json:"createdAt"`
	Message      shared_kafka.KafkaMessageInterface `json:"message"`
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
	var message shared_kafka.KafkaMessageInterface
	if len(e.Message) > 0 {
		rawMessage, err := shared_kafka.UnmarshalKafkaMessage(e.Message)
		if err != nil {
			slog.Warn("cannot unmarshal simulation event message", "error", err)
		} else if typedMessage, ok := rawMessage.(shared_kafka.KafkaMessageInterface); ok {
			message = typedMessage
		} else {
			slog.Warn("unexpected simulation event message type", "type", rawMessage)
		}
	}

	return SimulationEventResponse{
		ID:           e.ID,
		SimulationID: e.SimulationID,
		CreatedAt:    e.CreatedAt,
		Message:      message,
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
