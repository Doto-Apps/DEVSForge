package types

import "devsforge-coordinator/internal/logstore"

type SimulationLogsResponse struct {
	SimulationID string                `json:"simulationId"`
	Status       string                `json:"status"`
	CreatedAt    int64                 `json:"createdAt"`
	EndedAt      int64                 `json:"endedAt,omitempty"`
	ErrorMessage string                `json:"errorMessage,omitempty"`
	KafkaTopic   string                `json:"kafkaTopic"`
	Logs         []logstore.LogMessage `json:"logs"`
}

type CleanResponse struct {
	Success bool `json:"success"`
	Deleted int  `json:"deleted,omitempty"`
}
