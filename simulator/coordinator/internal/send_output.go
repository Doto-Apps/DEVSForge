package internal

import (
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunSendOutput(imminents []*RunnerState, tmin float64) error {
	for _, st := range imminents {
		msg := &kafka.KafkaMessageSendOutput{
			DevsType: kafka.DevsTypeSendOutput,
			Time: kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        tmin,
			},
			Target: st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending SendOutput to %s: %w", st.ID, err)
		}
	}

	return nil
}
