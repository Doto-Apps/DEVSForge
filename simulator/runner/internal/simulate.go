package internal

import (
	"context"
	"devsforge-runner/internal/generators"
	"devsforge-runner/internal/runner"
	"devsforge-shared/kafka"
	devspb "devsforge-wrapper/proto"
	"errors"
	"fmt"
	"log/slog"
)

// ErrSimulationDone signale la fin normale de la simulation
var ErrSimulationDone = errors.New("simulation completed normally")

func LaunchSim(wrapper *generators.WrapperInfo) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("LaunchSim: missing config")
	}
	if wrapper.GRPCConn == nil {
		return fmt.Errorf("LaunchSim: missing gRPC connection (wrapper not prepared?)")
	}

	modelClient := devspb.NewAtomicModelServiceClient(wrapper.GRPCConn)
	runnerInstance := runner.CreateRunner(cfg, context.Background(), modelClient)

	slog.Info("Simulation loop starting")
	if err := runnerInstance.StartReceiveLoop(func(msg *kafka.BaseKafkaMessage) error {
		if msg.Target != cfg.Model.ID || msg.Sender == cfg.Model.ID {
			return nil
		}

		tolog, err := msg.Marshal()
		if err == nil {
			slog.Debug("Input received", "data", tolog)
		}

		// ======================
		// InitSim : Initialize + NextTime
		// ======================
		if msg.DevsType == kafka.DevsTypeInitSim {
			return runnerInstance.RunInitSim(kafka.KafkaMessageInitSim{
				DevsType: msg.DevsType,
				Time:     msg.Time,
				Target:   msg.Target,
			})
		}

		// ======================
		// ExecuteTransition : internal / external / confluent
		// ======================
		if msg.DevsType == kafka.DevsTypeExecuteTransition {
			return runnerInstance.RunExecuteTransition(kafka.KafkaMessageExecuteTransition{
				DevsType:          msg.DevsType,
				Time:              *msg.Time,
				Target:            msg.Target,
				ModelInputsOption: *msg.ModelInputsOption,
			})
		}

		// ======================
		// SendOutput : lambda + ModelOutputMessage
		// ======================
		if msg.DevsType == kafka.DevsTypeSendOutput {
			return runnerInstance.RunSendOutput(kafka.KafkaMessageSendOutput{
				DevsType: msg.DevsType,
				Time:     *msg.Time,
			})
		}

		// ======================
		// SimulationDone : Finalize
		// ======================
		if msg.DevsType == kafka.DevsTypeSimulationDone {
			if err := runnerInstance.RunSimulationDone(); err != nil {
				return err
			}
			// Retourner l'erreur sentinelle pour sortir de la boucle
			return ErrSimulationDone
		}

		slog.Warn("Unhandled Kafka message type", "type", msg.DevsType)
		return nil
	}); err != nil && !errors.Is(err, ErrSimulationDone) {
		if reportErr := runnerInstance.SendErrorReport("RUNNER_LOOP_ERROR", "fatal", err); reportErr != nil {
			slog.Error("Failed to emit ErrorReport", "error", reportErr)
		}
		// Vraie erreur, pas une fin normale
		return err
	}

	slog.Info("Simulation loop ended")
	return nil
}
