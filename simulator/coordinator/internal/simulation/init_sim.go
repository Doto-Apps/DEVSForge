package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunInitSim() error {
	for _, runner := range c.RunnerStates {
		msg := c.GetBaseKafkaMessage(runner.ID).NewKafkaMessageSimulationInit(
			kafka.KafkaMessageSimulationInitParams{
				EventTime: float64(0),
			},
		)

		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending InitSim to %s: %w", runner.ID, err)
		}
	}
	return nil
}
