package simulation

type SimulateRequestBody struct {
	JSON       string `json:"json"`
	KafkaAddr  string `json:"kafka"`
	KafkaTopic string `json:"topic"`
}

type SimulationLogsResponse struct {
	SimulationID  string       `json:"simulationId"`
	Status        string       `json:"status"`
	CreatedAt     int64        `json:"createdAt"`
	EndedAt       int64        `json:"endedAt,omitempty"`
	ErrorMessage  string       `json:"errorMessage,omitempty"`
	Logs          []LogMessage `json:"logs"`
	TotalMessages *int         `json:"totalMessages,omitempty"`
}

type LogMessage struct {
	Timestamp int64  `json:"timestamp"`
	Sender    string `json:"sender"`
	DevsType  string `json:"devsType"`
	Data      any    `json:"data"`
}
