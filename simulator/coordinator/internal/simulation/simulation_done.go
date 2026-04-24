package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunSimulationDone() error {
	for _, st := range c.RunnerStates {
		msg := &kafka.KafkaMessageSimulationDone{
			MsgType:    kafka.MsgTypeSimulationTerminate,
			ReceiverID: st.ID,
		}

		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending SimulationDone to %s: %v", st.ID, err)
		}
	}

	return nil
}
