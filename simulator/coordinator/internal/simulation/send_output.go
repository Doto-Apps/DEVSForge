package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunSendOutput(imminents []*types.RunnerState, eventTime float64) error {
	for _, imminent := range imminents {
		msg := c.GetBaseKafkaMessage(imminent.ID).NewKafkaMessageRequestOutput(
			kafka.KafkaMessageRequestOutputParams{
				EventTime: eventTime,
			},
		)
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending KafkaMessageRequestOutput to %s: %w", imminent.ID, err)
		}
	}

	return nil
}
