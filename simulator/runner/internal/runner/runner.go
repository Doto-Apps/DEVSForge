package runner

import (
	"context"
	"devsforge-runner/internal/config"
	"devsforge-shared/kafka"
	devspb "devsforge-wrapper/proto"
	"fmt"
	"log"
	"math"

	"github.com/twmb/franz-go/pkg/kgo"
)

type Runner struct {
	CurrentTime float64
	NextTime    float64
	Config      *config.RunnerConfig
	Context     context.Context
	ModelClient devspb.AtomicModelServiceClient
}

func CreateRunner(cfg *config.RunnerConfig, ctx context.Context, modelClient devspb.AtomicModelServiceClient) Runner {
	return Runner{
		CurrentTime: 0.0,
		NextTime:    math.MaxFloat64,
		Config:      cfg,
		Context:     ctx,
		ModelClient: modelClient,
	}
}

func (r *Runner) SendMessage(msg kafka.KafkaMessageI) error {
	data, err := msg.Marshal()
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	log.Printf("[OUT]: %s", string(data))

	return r.Config.KafkaClient.ProduceSync(r.Context, &kgo.Record{Value: data}).FirstErr()
}

func (r *Runner) SendErrorReport(errorCode string, severity string, sourceErr error) error {
	if sourceErr == nil {
		return nil
	}
	if r.Config == nil || r.Config.Model == nil {
		return fmt.Errorf("runner config is missing; cannot emit ErrorReport")
	}
	if severity == "" {
		severity = "error"
	}
	if errorCode == "" {
		errorCode = "RUNNER_ERROR"
	}

	report := kafka.NewErrorReportMessage(
		r.Config.SimulationID,
		r.Config.ID,
		"Coordinator",
		"Runner",
		r.Config.Model.ID,
		severity,
		errorCode,
		sourceErr.Error(),
		nil,
		nil,
	)

	return r.SendMessage(report)
}

func (r *Runner) StartReceiveLoop(handler func(*kafka.BaseKafkaMessage) error) error {
	client := r.Config.KafkaClient
	for {
		fetches := client.PollFetches(r.Context)
		if errs := fetches.Errors(); len(errs) > 0 {
			// All errors are retried internally when fetching, but non-retriable errors are
			// returned from polls so that users can notice and take action.
			return fmt.Errorf("kafka poll error: %v", errs)
		}

		// We can iterate through a record iterator...
		iter := fetches.RecordIter()
		for !iter.Done() {
			record := iter.Next()

			msg, err := kafka.UnmarshalKafkaMessage(record.Value)
			if err != nil {
				return fmt.Errorf("cannot unmarshall kafka message : %w", err)
			}

			err = handler(msg)
			if err != nil {
				return err
			}
		}
	}
}
