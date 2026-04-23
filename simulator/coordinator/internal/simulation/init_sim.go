package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunInitSim() error {
	for _, st := range c.RunnerStates {
		msg := &kafka.KafkaMessageInitSim{
			MsgType: kafka.MsgTypeSimulationInit,
			EventTime: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        0,
			},
			ReceiverID: st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending InitSim to %s: %w", st.ID, err)
		}
	}
	return nil
}
