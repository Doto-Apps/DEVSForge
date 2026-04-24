package simulation

import (
	"context"
	"devsforge-coordinator/internal/types"
	"log/slog"
	"time"

	kafkaShared "devsforge-shared/kafka"

	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
)

func sendCoordinatorErrorReport(cfg *types.CoordConfig, simulationRunID string, errorCode string, err error) {
	if err == nil || cfg == nil || cfg.KafkaClient == nil {
		return
	}
	if errorCode == "" {
		errorCode = "COORDINATOR_ERROR"
	}

	msg := &kafkaShared.KafkaMessageErrorReport{
		BaseKafkaMessage: kafkaShared.BaseKafkaMessage{
			MsgType:         kafkaShared.MsgTypeErrorReport,
			SimulationRunID: simulationRunID,
			MessageID:       uuid.NewString(),
			SenderID:        "Coordinator",
			ReceiverID:      "Backend",
			EventTime:       nil,
		},
		Payload: kafkaShared.ErrorReportPayload{
			OriginRole: "Coordinator",
			OriginID:   "Coordinator",
			Severity:   "fatal",
			ErrorCode:  errorCode,
			Message:    err.Error(),
		},
	}

	payload, marshalErr := msg.Marshal()
	if marshalErr != nil {
		slog.Error("Failed to marshal coordinator ErrorReport", "error", marshalErr)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if produceErr := cfg.KafkaClient.ProduceSync(ctx, &kgo.Record{Value: payload}).FirstErr(); produceErr != nil {
		slog.Error("Failed to publish coordinator ErrorReport", "error", produceErr)
	}
}
