package simulation

import (
	"context"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"log/slog"
	"math"
)

type Coordinator struct {
	Config       *types.CoordinatorConfig
	Context      context.Context
	RunnerStates types.RunnerStates
	Logger       *slog.Logger
}

func CreateCoordinnator(cfg *types.CoordinatorConfig, ctx context.Context, runnerStates types.RunnerStates) Coordinator {
	return Coordinator{
		Config:       cfg,
		Context:      ctx,
		RunnerStates: runnerStates,
	}
}

func (c *Coordinator) GetBaseKafkaMessage(receiverId string) *kafka.BaseKafkaMessage {
	return &kafka.BaseKafkaMessage{
		SimulationRunID: c.Config.SimulationID,
		SenderID:        kafka.CoordinatorId,
		ReceiverID:      receiverId,
	}
}

func (c *Coordinator) RunCoordinator(manifest *shared.RunnableManifest) error {
	nextTimeCh := make(chan *kafka.KafkaMessageNextInternalTimeReport)
	transitionDoneCh := make(chan *kafka.KafkaMessageTransitionComplete)
	outputCh := make(chan *kafka.KafkaMessageOutputReport)

	go func() {
		err := c.StartReceiveLoop(func(msg any) error {
			if m, ok := msg.(kafka.CommonKafkaMessage); ok && m.SenderID == "" {
				return nil
			}
			switch m := msg.(type) {
			case kafka.KafkaMessageNextInternalTimeReport:
				nextTimeCh <- &m
			case kafka.KafkaMessageTransitionComplete:
				transitionDoneCh <- &m
			case kafka.KafkaMessageOutputReport:
				outputCh <- &m
			case kafka.CommonKafkaMessage:
				slog.Warn("Unrecognized message type", "type", m.MessageType)
				return nil
			default:
				slog.Warn("Unrecognized message", "message", m)
				return nil
			}
			return nil
		})
		if err != nil {
			slog.Error("Collector error", "error", err)
		}
	}()

	slog.Info("Sending InitSim to all runners")
	err := c.RunInitSim()
	if err != nil {
		return err
	}

	slog.Info("Waiting runners answers with initial NextInternalTime")
	if err = c.RunNextInternalTime(nextTimeCh); err != nil {
		return err
	}

	slog.Info("All runners responded with initial NextInternalTime")
	currentTime := 0.0
	for {
		currentTime = computeGlobalMinTime(c.RunnerStates)
		if currentTime == math.MaxFloat64 {
			slog.Info("Simulation ended: all nextTimes are +Inf")
			break
		}

		if manifest.MaxTime > 0 && currentTime >= manifest.MaxTime {
			slog.Info("Simulation ended: max time reached", "tmin", currentTime, "maxTime", manifest.MaxTime)
			break
		}

		imminents := []*types.RunnerState{}
		for _, st := range c.RunnerStates {
			if st.NextInternalTime == currentTime {
				imminents = append(imminents, st)
			}
			st.InPorts = nil
		}

		slog.Debug("Coordination step", "currentTime", currentTime, "imminents", len(imminents))

		err := c.RunSendOutput(imminents, currentTime)
		if err != nil {
			return err
		}

		outputsBySender := map[string]*kafka.KafkaMessageOutputReportPayload{}
		for range imminents {
			msg := <-outputCh
			outputsBySender[msg.SenderID] = &msg.Payload
		}

		routeOutputs(manifest, c.RunnerStates, outputsBySender)

		transitionTargets := map[string]*types.RunnerState{}
		// TODO: Bizarre ce truc
		for _, st := range imminents {
			transitionTargets[st.ID] = st
		}
		for _, st := range c.RunnerStates {
			if len(st.InPorts) > 0 {
				transitionTargets[st.ID] = st
			}
		}

		err = c.RunExecuteTransition(transitionTargets, currentTime)
		if err != nil {
			return err
		}

		for range transitionTargets {
			msg := <-transitionDoneCh
			st, ok := c.RunnerStates[msg.SenderID]
			if !ok {
				slog.Warn("TransitionDone from unknown runner", "sender", msg.SenderID)
				continue
			}

			st.NextInternalTime = msg.NextInternalTime
		}
	}

	slog.Info("Sending SimulationDone to all runners")
	err = c.RunSimulationDone(currentTime)
	if err != nil {
		return err
	}

	slog.Info("Coordination completed")
	return nil
}
