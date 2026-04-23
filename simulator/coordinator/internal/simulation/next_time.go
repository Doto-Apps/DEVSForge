package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"math"
	"time"
)

func (c *Coordinator) RunNextInternalTime(nextTimeCh chan *kafka.BaseKafkaMessage) error {
	timeout := 10 * time.Second
	for range c.RunnerStates {
		select {
		case msg := <-nextTimeCh:
			id := msg.SenderID
			st, ok := c.RunnerStates[id]
			if !ok {
				slog.Warn("NextInternalTime from unknown runner", "runner_id", id)
				continue
			}
			if msg.NextInternalTime == nil {
				st.NextInternalTime = math.MaxFloat64
			} else {
				st.NextInternalTime = msg.NextInternalTime.T
			}
			st.HasInit = true
		case <-time.After(timeout):
			return fmt.Errorf("timeout waiting for runners to send their nextTime")
		}
	}
	return nil
}
