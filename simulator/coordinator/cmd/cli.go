package cmd

import (
	"devsforge-coordinator/internal/simulation"
	"devsforge-coordinator/internal/types"
)

func RunOneSimulation(params types.SimulationParams) error {
	return simulation.RunSimulation(params)
}
