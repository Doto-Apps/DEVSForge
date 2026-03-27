package internal

import "devsforge-shared/kafka"

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
