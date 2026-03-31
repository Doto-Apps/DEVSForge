package simulation

import (
	"context"
	"devsforge-coordinator/internal/types"
	"log/slog"
	"time"

	kafkaShared "devsforge-shared/kafka"

	"github.com/twmb/franz-go/pkg/kgo"
)

func sendCoordinatorErrorReport(cfg *types.CoordConfig, simulationRunID string, errorCode string, err error) {
	if err == nil || cfg == nil || cfg.KafkaClient == nil {
		return
	}
	if errorCode == "" {
		errorCode = "COORDINATOR_ERROR"
	}

	msg := kafkaShared.NewErrorReportMessage(
		simulationRunID,
		"Coordinator",
		"Backend",
		"Coordinator",
		"Coordinator",
		"fatal",
		errorCode,
		err.Error(),
		nil,
		nil,
	)

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
