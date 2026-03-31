package simulation

import (
	"devsforge-coordinator/internal/types"
	"devsforge-shared/kafka"
	"fmt"
)

func (c *Coordinator) RunExecuteTransition(transitionTargets types.RunnerStates, tmin float64) error {
	for _, st := range transitionTargets {
		var inputs kafka.ModelInputsOption
		if len(st.Inbox) > 0 {
			inputs = kafka.ModelInputsOption{
				PortValueList: st.Inbox,
			}
		}

		msg := &kafka.KafkaMessageExecuteTransition{
			DevsType: kafka.DevsTypeExecuteTransition,
			Time: kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        tmin,
			},
			ModelInputsOption: inputs,
			Target:            st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending ExecuteTransition to %s: %w", st.ID, err)
		}
	}
	return nil
}
