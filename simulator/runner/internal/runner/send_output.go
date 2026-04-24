package runner

import (
	"devsforge-shared/kafka"
	"encoding/json"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunSendOutput(msg kafka.KafkaMessageSendOutput) error {
	r.CurrentTime = msg.EventTime.T

	outResp, err := r.ModelClient.Output(r.Context, &emptypb.Empty{})
	if err != nil {
		return fmt.Errorf("output error: %w", err)
	}

	var pvs []kafka.PortValue
	for _, po := range outResp.Outputs {
		for _, v := range po.ValuesJson {
			var decodedValue interface{}
			if err := json.Unmarshal([]byte(v), &decodedValue); err != nil {
				return fmt.Errorf("invalid JSON output value on port %s: %w", po.PortName, err)
			}
			pvs = append(pvs, kafka.PortValue{
				PortIdentifier: po.PortName,
				PortType:       "TODO", // TODO: Implement me
				Value:          decodedValue,
			})
		}
	}

	outMsg := &kafka.KafkaMessageModelOutput{
		MsgType: kafka.MsgTypeOutputReport,
		EventTime: kafka.SimTime{
			TimeType: kafka.DevsDoubleSimTime.String(),
			T:        r.CurrentTime,
		},
		SenderID: r.Config.ID,
		ModelOutput: kafka.ModelOutput{
			PortValueList: pvs,
		},
	}
	return r.SendMessage(outMsg)
}
