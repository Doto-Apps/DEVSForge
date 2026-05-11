// Package runner provides simulation runner logic and state management.
package runner

import (
	"context"
	"devsforge-runner/internal/config"
	"devsforge-shared/kafka"
	"devsforge-shared/simulation"
	devspb "devsforge-wrapper/proto"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"

	"github.com/twmb/franz-go/pkg/kgo"
	"google.golang.org/grpc"
)

var ErrorRunnerLoopError int64 = 5000

type Runner struct {
	CurrentTime      float64
	NextInternalTime float64
	Config           *config.RunnerConfig
	Context          context.Context
	ModelClient      devspb.AtomicModelServiceClient
}

func CreateRunner(cfg *config.RunnerConfig, ctx context.Context) Runner {
	return Runner{
		CurrentTime:      0.0,
		NextInternalTime: math.MaxFloat64,
		Config:           cfg,
		Context:          ctx,
		ModelClient:      devspb.NewAtomicModelServiceClient(&grpc.ClientConn{}),
	}
}

func (r *Runner) GetBaseKafkaMessage(receiverID string) *kafka.BaseKafkaMessage {
	return &kafka.BaseKafkaMessage{
		SimulationRunID: r.Config.SimulationID,
		SenderID:        r.Config.Model.ID,
		ReceiverID:      receiverID,
	}
}

func (r *Runner) SendMessage(msg kafka.KafkaMessageInterface) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	slog.Debug("Output", "data", string(data))

	return r.Config.KafkaClient.ProduceSync(r.Context, &kgo.Record{Value: data}).FirstErr()
}

func (r *Runner) StartReceiveLoop(handler func(any) error) error {
	client := r.Config.KafkaClient
	for {
		fetches := client.PollFetches(r.Context)
		if errs := fetches.Errors(); len(errs) > 0 {
			return fmt.Errorf("kafka poll error: %v", errs)
		}
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

func (r *Runner) Run() error {
	slog.Info("Simulation loop starting")
	if err := r.StartReceiveLoop(func(msg any) error {
		if m, ok := msg.(kafka.KafkaMessageInterface); ok {
			if m.GetReceiverID() != r.Config.Model.ID || m.GetSenderID() == r.Config.Model.ID {
				return nil
			}
		} else {
			slog.Warn("cannot parse to kafka message interface")
		}
		switch m := msg.(type) {
		case *kafka.KafkaMessageSimulationInit:
			r.CurrentTime = m.EventTime
			return r.RunInitSim()
		case *kafka.KafkaMessageExecuteTransition:
			return r.RunExecuteTransition(kafka.KafkaMessageExecuteTransition{
				EventTime: m.EventTime,
				Payload:   m.Payload,
			})
		case *kafka.KafkaMessageRequestOutput:
			return r.RunSendOutput()
		case *kafka.KafkaMessageSimulationTerminate:
			slog.Debug("receive terminate send msg")
			if err := r.RunSimulationDone(); err != nil {
				return err
			}
			return simulation.ErrSimulationDone
		case *kafka.CommonKafkaMessage:
			slog.Warn("Unrecognized message type", "type", m.MessageType)
			return nil
		default:
			slog.Warn("Unrecognized message", "message", m)
			return nil
		}
	}); err != nil && !errors.Is(err, simulation.ErrSimulationDone) {
		if reportErr := r.SendErrorReport(ErrorRunnerLoopError, err); reportErr != nil {
			slog.Error("Failed to emit ErrorReport", "error", reportErr)
		}
		return err
	}

	slog.Info("Simulation loop ended")
	return nil
}
