// Package types coordinator types
package types

import (
	"devsforge-shared/kafka"
	"devsforge-shared/simulation"

	"github.com/twmb/franz-go/pkg/kgo"
)

type RunnerState struct {
	ID               string
	NextInternalTime float64
	HasInit          bool
	InPorts          []*kafka.KafkaMessagePortPayload
	OutPorts         []*kafka.KafkaMessagePortPayload
}

type SimulationParams struct {
	Json         *string
	File         *string
	KafkaAddress *string
	KafkaTopic   *string
}

type RunnerStates = map[string]*RunnerState

type CoordinatorConfig struct {
	KafkaConfig  kafka.KafkaConfig
	KafkaClient  *kgo.Client
	SimulationID string
}

type SimulationStatus struct {
	Status       string                  `json:"status"`
	CreatedAt    int64                   `json:"createdAt"`
	EndedAt      int64                   `json:"endedAt,omitempty"`
	ErrorMessage string                  `json:"errorMessage,omitempty"`
	KafkaTopic   string                  `json:"kafkaTopic"`
	Messages     []simulation.LogMessage `json:"messages,omitempty"`
}
