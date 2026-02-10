package internal

import (
	"context"
	"log"
	"time"

	kafkaShared "devsforge-shared/kafka"

	"github.com/twmb/franz-go/pkg/kgo"
)

func sendCoordinatorErrorReport(cfg *CoordConfig, simulationRunID string, errorCode string, err error) {
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
		log.Printf("failed to marshal coordinator ErrorReport: %v", marshalErr)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if produceErr := cfg.KafkaClient.ProduceSync(ctx, &kgo.Record{Value: payload}).FirstErr(); produceErr != nil {
		log.Printf("failed to publish coordinator ErrorReport: %v", produceErr)
	}
}
