// Package enum provides enumeration types for the simulator.
package enum

type ModelType string

const (
	Atomic  ModelType = "atomic"
	Coupled ModelType = "coupled"
)
