package simulation

import "devsforge-shared/kafka"

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
	Timestamp int64                  `json:"timestamp"`
	SenderID  string                 `json:"senderId,omitempty"`
	MsgType   string                 `json:"msgType"`
	Data      kafka.BaseKafkaMessage `json:"data"`
}
