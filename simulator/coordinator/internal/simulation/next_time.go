package simulation

import (
	"devsforge-shared/kafka"
	"fmt"
	"log/slog"
	"time"
)

func (c *Coordinator) RunNextInternalTime(nextTimeCh chan *kafka.KafkaMessageNextInternalTimeReport) error {
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

			st.NextInternalTime = msg.NextInternalTime

			st.HasInit = true
		case <-time.After(timeout):
			return fmt.Errorf("timeout waiting for runners to send their nextTime")
		}
	}
	return nil
}
