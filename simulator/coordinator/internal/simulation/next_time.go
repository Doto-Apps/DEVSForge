package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"math"
	"time"
)

func (c *Coordinator) RunNextTime(nextTimeCh chan *kafka.BaseKafkaMessage) error {
	timeout := 10 * time.Second
	for range c.RunnerStates {
		select {
		case msg := <-nextTimeCh:
			id := msg.Sender
			st, ok := c.RunnerStates[id]
			if !ok {
				slog.Warn("NextTime from unknown runner", "runner_id", id)
				continue
			}
			if msg.NextTime == nil {
				st.NextTime = math.MaxFloat64
			} else {
				st.NextTime = msg.NextTime.T
			}
			st.HasInit = true
		case <-time.After(timeout):
			return fmt.Errorf("timeout waiting for runners to send their nextTime")
		}
	}
	return nil
}
