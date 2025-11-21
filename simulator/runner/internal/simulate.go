package internal

import (
	"context"
	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/shared/kafka"
	"fmt"
	"log"
)

// LaunchSim : ne contient plus que la logique de simulation DEVS (tout ce qui était après "connected:")
func LaunchSim(wrapper *WrapperInfo) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("LaunchSim: missing config")
	}
	if wrapper.GRPCConn == nil {
		return fmt.Errorf("LaunchSim: missing gRPC connection (wrapper not prepared?)")
	}

	modelClient := devspb.NewAtomicModelServiceClient(wrapper.GRPCConn)
	runner := createRunner(cfg, context.Background(), modelClient)

	// Boucle Kafka typée DEVS-SF

	log.Println("======================================")
	log.Println("   Debut de la boucle de simulation    ")
	log.Println("======================================")
	if err := runner.StartReceiveLoop(func(msg *kafka.BaseKafkaMessage) error {
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
			return runner.RunInitSim(kafka.KafkaMessageInitSim{
				DevsType: msg.DevsType,
				Time:     msg.Time,
				Target:   msg.Target,
			})
		}
		// ======================
		// ExecuteTransition : internal / external / confluent
		// ======================
		if msg.DevsType == kafka.DevsTypeExecuteTransition {
			return runner.RunExecuteTransition(kafka.KafkaMessageExecuteTransition{
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
			return runner.RunSendOutput(kafka.KafkaMessageSendOutput{
				DevsType: msg.DevsType,
				Time:     *msg.Time,
			})
		}

		// ======================
		// SimulationDone : Finalize
		// ======================
		if msg.DevsType == kafka.DevsTypeSimulationDone {
			return runner.RunSimulationDone()
		}

		log.Printf("⚠️ Unhandled DevsType Message receive on kafka: %s", msg.DevsType)
		return nil
	}); err != nil {
		return err
	}

	log.Println("======================================")
	log.Println("   Fin de la boucle de simulation    ")
	log.Println("======================================")

	return nil
}
