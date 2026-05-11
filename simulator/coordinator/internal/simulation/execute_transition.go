package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunExecuteTransition(transitionTargets types.RunnerStates, eventTime float64) error {
	for _, transitionTarget := range transitionTargets {
		msg := c.GetBaseKafkaMessage(transitionTarget.ID).NewKafkaMessageExecuteTransition(kafka.KafkaMessageExecuteTransitionParams{
			EventTime: eventTime,
			Payload: kafka.KafkaMessageExecuteTransitionPayload{
				Inputs: transitionTarget.InPorts,
			},
		})

		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending KafkaMessageExecuteTransition to %s: %w", transitionTarget.ID, err)
		}
	}
	return nil
}
