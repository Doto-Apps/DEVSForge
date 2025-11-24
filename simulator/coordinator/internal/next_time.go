package internal

import (
	"devsforge-shared/kafka"
	"log"
	"math"
)

func (c *Coordinator) RunNextTime(nextTimeCh chan *kafka.BaseKafkaMessage) {
	for range c.RunnerStates {
		msg := <-nextTimeCh
		id := msg.Sender
		st, ok := c.RunnerStates[id]
		if !ok {
			log.Printf("⚠️ NextTime from unknown runner %s", id)
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
