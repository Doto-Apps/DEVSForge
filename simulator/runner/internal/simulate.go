package internal

import (
	"context"
	"devsforge-runner/internal/generators"
	"devsforge-runner/internal/runner"
	"devsforge-shared/kafka"
	devspb "devsforge-wrapper/proto"
	"errors"
	"fmt"
	"log"
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

	log.Println("======================================")
	log.Println("   Debut de la boucle de simulation    ")
	log.Println("======================================")

	if err := runnerInstance.StartReceiveLoop(func(msg *kafka.BaseKafkaMessage) error {
		if msg.Target != cfg.Model.ID || msg.Sender == cfg.Model.ID {
			return nil
		}

		tolog, err := msg.Marshal()
		if err == nil {
			log.Printf("[IN]: %s", tolog)
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

		log.Printf("⚠️ Unhandled DevsType Message receive on kafka: %s", msg.DevsType)
		return nil
	}); err != nil && !errors.Is(err, ErrSimulationDone) {
		if reportErr := runnerInstance.SendErrorReport("RUNNER_LOOP_ERROR", "fatal", err); reportErr != nil {
			log.Printf("failed to emit ErrorReport: %v", reportErr)
		}
		// Vraie erreur, pas une fin normale
		return err
	}

	log.Println("======================================")
	log.Println("   Fin de la boucle de simulation    ")
	log.Println("======================================")
	return nil
}
