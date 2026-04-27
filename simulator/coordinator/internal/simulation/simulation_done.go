package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunSimulationDone(eventTime float64) error {
	for _, st := range c.RunnerStates {
		msg := c.GetBaseKafkaMessage(st.ID).NewKafkaMessageSimulationTerminate(kafka.KafkaMessageSimulationTerminateParams{
			EventTime: eventTime,
			Payload: &kafka.KafkaMessageSimulationTerminatePayload{
				Reason: "",
			},
		})

		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending SimulationDone to %s: %v", st.ID, err)
		}
	}

	return nil
}
