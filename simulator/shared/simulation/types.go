package simulation

import (
	"devsforge-shared/kafka"
	"errors"
)

var ErrSimulationDone = errors.New("simulation completed normally")

type SimulationLogsResponse struct {
	SimulationID  string       `json:"simulationId"`
	Status        string       `json:"status"`
	CreatedAt     int64        `json:"createdAt"`
	EndedAt       int64        `json:"endedAt,omitempty"`
	ErrorMessage  string       `json:"errorMessage,omitempty"`
	KafkaTopic    string       `json:"kafkaTopic"`
	Logs          []LogMessage `json:"logs"`
	TotalMessages *int         `json:"totalMessages,omitempty"`
}

type LogMessage struct {
	Sequence    int64                       `json:"sequence"`
	SenderID    string                      `json:"senderId,omitempty"`
	MessageType string                      `json:"messageType"`
	Data        kafka.KafkaMessageInterface `json:"data"`
}
