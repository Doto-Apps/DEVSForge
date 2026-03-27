package internal

import (
	"context"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"log/slog"
	"math"
)

type Coordinator struct {
	Config       *CoordConfig
	Context      context.Context
	RunnerStates RunnerStates
}

func CreateCoordinnator(cfg *CoordConfig, ctx context.Context, runnerStates RunnerStates) Coordinator {
	return Coordinator{
		Config:       cfg,
		Context:      ctx,
		RunnerStates: runnerStates,
	}
}

// RunCoordinator lance la boucle de coordination DEVS
func (c *Coordinator) RunCoordinator(manifest *shared.RunnableManifest) error {
	// Channels pour recevoir les messages importants
	nextTimeCh := make(chan *kafka.BaseKafkaMessage)
	transitionDoneCh := make(chan *kafka.BaseKafkaMessage)
	outputCh := make(chan *kafka.BaseKafkaMessage)
	// Logger prefix removed - using structured logging

	// Goroutine qui écoute Kafka côté coordi
	go func() {
		err := c.StartReceiveLoop(func(msg *kafka.BaseKafkaMessage) error {
			if msg.Sender == "" {
				return nil
			}

			switch msg.DevsType {
			case kafka.DevsTypeNextTime:
				nextTimeCh <- msg
			case kafka.DevsTypeTransitionDone:
				transitionDoneCh <- msg
			case kafka.DevsTypeModelOutput:
				outputCh <- msg
			default:
				slog.Warn("Unrecognized message", "type", msg.DevsType.String())
			}
			return nil
		})
		if err != nil {
			slog.Error("Collector error", "error", err)
		}
	}()

	// --- Phase 1 : InitSim pour tous les modèles ---
	slog.Info("Sending InitSim to all runners")
	err := c.RunInitSim()
	if err != nil {
		return err
	}
	// Attente d'un NextTime par runner
	c.RunNextTime(nextTimeCh)
	slog.Info("All runners responded with initial NextTime")

	// --- Phase 2 : Boucle principale de simulation ---
	for {
		tmin := computeMinTime(c.RunnerStates)
		if tmin == math.MaxFloat64 {
			slog.Info("Simulation ended: all nextTimes are +Inf")
			break
		}

		// Check if we've reached the maximum simulation time
		if manifest.MaxTime > 0 && tmin >= manifest.MaxTime {
			slog.Info("Simulation ended: max time reached", "tmin", tmin, "maxTime", manifest.MaxTime)
			break
		}

		// 1) trouver les imminents
		imminents := []*RunnerState{}
		for _, st := range c.RunnerStates {
			if st.NextTime == tmin {
				imminents = append(imminents, st)
			}
			// vider l'Inbox pour le nouveau pas de temps
			st.Inbox = nil
		}

		slog.Debug("Coordination step", "tmin", tmin, "imminents", len(imminents))

		// 2) demander les outputs aux imminents
		err := c.RunSendOutput(imminents, tmin)
		if err != nil {
			return err
		}

		// 3) récupérer les ModelOutput des imminents
		outputsBySender := map[string]*kafka.ModelOutput{}
		for range imminents {
			msg := <-outputCh
			outputsBySender[msg.Sender] = msg.ModelOutput
		}

		// 4) router les outputs vers les Inbox des destinataires
		routeOutputs(manifest, c.RunnerStates, outputsBySender)

		// 5) déterminer qui transitionne
		transitionTargets := map[string]*RunnerState{}
		for _, st := range imminents {
			transitionTargets[st.ID] = st
		}
		for _, st := range c.RunnerStates {
			if len(st.Inbox) > 0 {
				transitionTargets[st.ID] = st
			}
		}

		// 6) envoyer ExecuteTransition
		err = c.RunExecuteTransition(transitionTargets, tmin)
		if err != nil {
			return err
		}

		// 7) attendre les TransitionDone
		for range transitionTargets {
			msg := <-transitionDoneCh
			st, ok := c.RunnerStates[msg.Sender]
			if !ok {
				slog.Warn("TransitionDone from unknown runner", "sender", msg.Sender)
				continue
			}
			if msg.NextTime == nil {
				st.NextTime = math.MaxFloat64
			} else {
				st.NextTime = msg.NextTime.T
			}
		}
	}

	// --- Phase 3 : SimulationDone ---

	slog.Info("Sending SimulationDone to all runners")
	err = c.RunSimulationDone()
	if err != nil {
		return err
	}

	slog.Info("Coordination completed")
	return nil
}
