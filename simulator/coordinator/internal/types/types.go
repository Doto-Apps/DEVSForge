// Package types coordinator types
package types

import (
	"devsforge-shared/kafka"

	"github.com/twmb/franz-go/pkg/kgo"
)

type RunnerState struct {
	ID       string
	NextTime float64
	HasInit  bool
	Inbox    []kafka.PortValue // messages reçus avant un ExecuteTransition
}

type SimulationParams struct {
	Json         *string
	File         *string
	KafkaAddress *string
	KafkaTopic   *string
}

type RunnerStates = map[string]*RunnerState

type CoordConfig struct {
	KafkaConfig kafka.KafkaConfig
	KafkaClient *kgo.Client
}
