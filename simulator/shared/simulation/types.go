package simulation

import (
	"devsforge-shared/kafka"
	"encoding/json"
	"errors"
	"fmt"
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

func (m *LogMessage) UnmarshalJSON(data []byte) error {
	var raw struct {
		Sequence    int64           `json:"sequence"`
		SenderID    string          `json:"senderId,omitempty"`
		MessageType string          `json:"messageType"`
		Data        json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	m.Sequence = raw.Sequence
	m.SenderID = raw.SenderID
	m.MessageType = raw.MessageType

	kafkaMsg, err := kafka.UnmarshalKafkaMessage(raw.Data)
	if err != nil {
		return fmt.Errorf("failed to unmarshal kafka message: %w", err)
	}

	if typedMsg, ok := kafkaMsg.(kafka.KafkaMessageInterface); ok {
		m.Data = typedMsg
		return nil
	}

	return fmt.Errorf("unexpected message type: %T", kafkaMsg)
}

func (m *LogMessage) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{
		"sequence":    m.Sequence,
		"senderId":    m.SenderID,
		"messageType": m.MessageType,
		"data":        m.Data,
	})
}
