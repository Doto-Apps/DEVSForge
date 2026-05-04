package runner

import (
	"devsforge-shared/kafka"
	"fmt"
	"math"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunInitSim() error {

	if _, err := r.ModelClient.Initialize(r.Context, &emptypb.Empty{}); err != nil {
		return fmt.Errorf("initialize error: %w", err)
	}

	taResp, err := r.ModelClient.TimeAdvance(r.Context, &emptypb.Empty{})
	if err != nil {
		return fmt.Errorf("TimeAdvance error: %w", err)
	}
	sigma := taResp.GetSigma()
	r.NextInternalTime = r.CurrentTime + sigma

	if math.IsInf(r.NextInternalTime, 1) {
		r.NextInternalTime = math.MaxFloat64
	}

	resp := r.GetBaseKafkaMessage(kafka.CoordinatorId).NewKafkaMessageNextInternalTimeReport(
		kafka.KafkaMessageNextInternalTimeReportParams{
			NextInternalTime: r.NextInternalTime,
			EventTime:        r.CurrentTime,
		},
	)

	return r.SendMessage(resp)
}
