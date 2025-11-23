package internal

import (
	"devsforge/simulator/shared/kafka"
	"fmt"
)

func (c *Coordinator) RunInitSim() error {
	for _, st := range c.RunnerStates {
		msg := &kafka.KafkaMessageInitSim{
			DevsType: kafka.DevsTypeInitSim,
			Time: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        0,
			},
			Target: st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending InitSim to %s: %w", st.ID, err)
		}
	}
	return nil
}
