package simulation

import (
	"devsforge-shared/kafka"
	"log/slog"
	"math"
)

func (c *Coordinator) RunNextTime(nextTimeCh chan *kafka.BaseKafkaMessage) {
	for range c.RunnerStates {
		msg := <-nextTimeCh
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
	}
}