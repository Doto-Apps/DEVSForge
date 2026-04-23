package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunSendOutput(imminents []*types.RunnerState, tmin float64) error {
	for _, st := range imminents {
		msg := &kafka.KafkaMessageSendOutput{
			MsgType: kafka.MsgTypeRequestOutput,
			EventTime: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        tmin,
			},
			ReceiverID: st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending SendOutput to %s: %w", st.ID, err)
		}
	}

	return nil
}
