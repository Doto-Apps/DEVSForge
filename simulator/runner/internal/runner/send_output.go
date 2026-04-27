package runner

import (
	"devsforge-shared/kafka"
	"encoding/json"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunSendOutput() error {
	outResp, err := r.ModelClient.Output(r.Context, &emptypb.Empty{})
	if err != nil {
		return fmt.Errorf("output error: %w", err)
	}

	var portsPayload []*kafka.KafkaMessagePortPayload

	for _, portOutput := range outResp.Outputs {
		for _, v := range portOutput.ValuesJson {
			var decodedValue interface{}
			if err := json.Unmarshal([]byte(v), &decodedValue); err != nil {
				return fmt.Errorf("invalid JSON output value on port %s: %w", portOutput.PortName, err)
			}
			portsPayload = append(portsPayload, &kafka.KafkaMessagePortPayload{
				PortName: portOutput.PortName,
				Value:    portOutput.ValuesJson,
			})
		}
	}

	msg := r.GetBaseKafkaMessage(kafka.CoordinatorId).NewKafkaMessageOutputReport(kafka.KafkaMessageOutputReportParams{
		EventTime:        r.CurrentTime,
		NextInternalTime: r.NextInternalTime,
		Payload: kafka.KafkaMessageOutputReportPayload{
			Outputs:          portsPayload,
			AdditionalFields: &map[string]any{},
		},
	})

	return r.SendMessage(msg)
}
