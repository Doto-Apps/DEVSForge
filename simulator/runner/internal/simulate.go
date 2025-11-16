package internal

import (
	"context"
	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/shared/kafka"
	"encoding/json"
	"fmt"
	"log"
	"math"

	"google.golang.org/protobuf/types/known/emptypb"
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
	SetModelClient(modelClient)

	// État local de la simulation DEVS côté runner
	var currentTime float64 = 0
	var nextTime float64 = math.Inf(1)

	// Boucle Kafka typée DEVS-SF

	log.Println("======================================")
	log.Println("   Debut de la boucle de simulation    ")
	log.Println("======================================")
	if err := cfg.Collector.StartDevsLoop(func(msg *kafka.KafkaMessage) error {
		ctx := context.Background()
		// TODO: ready message and wait for all ready in coord
		if msg.Target != "all" && msg.Target != cfg.ID {
			// le message n’est pas pour ce runner → on ignore silencieusement
			return nil
		}

		switch msg.DevsType {

		// ======================
		// InitSim : Initialize + NextTime
		// ======================
		case kafka.DevsTypeInitSim:
			t := 0.0
			if msg.Time != nil {
				t = msg.Time.T
			}
			currentTime = t

			// Initialisation du modèle
			if _, err := modelClient.Initialize(ctx, &emptypb.Empty{}); err != nil {
				return fmt.Errorf("initialize error: %w", err)
			}

			// Calcul du sigma initial (TA)
			taResp, err := modelClient.TimeAdvance(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("TimeAdvance error: %w", err)
			}
			sigma := taResp.GetSigma()
			nextTime = currentTime + sigma

			var nextTimeField *kafka.SimTime
			if math.IsInf(nextTime, 1) {
				// On garde nextTime en mémoire, mais on NE l’envoie PAS dans le message JSON
				nextTimeField = nil
			} else {
				nextTimeField = &kafka.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        nextTime,
				}
			}

			resp := &kafka.KafkaMessage{
				DevsType: kafka.DevsTypeNextTime,
				Time: &kafka.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				NextTime: nextTimeField,
				Sender:   cfg.ID,
			}
			return cfg.Producer.SendDevsMessage(resp)

		// ======================
		// ExecuteTransition : internal / external / confluent
		// ======================
		case kafka.DevsTypeExecuteTransition:
			if msg.Time == nil {
				return fmt.Errorf("ExecuteTransition without time")
			}
			t := msg.Time.T

			// Temps écoulé depuis le dernier état
			e := t - currentTime
			if e < 0 {
				e = 0
			}
			currentTime = t

			hasInputs := msg.ModelInputsOption != nil && len(msg.ModelInputsOption.PortValueList) > 0

			// 1) Injection des inputs dans les ports du modèle (AddInput gRPC)
			if hasInputs {
				for _, pv := range msg.ModelInputsOption.PortValueList {
					valueJSONBytes, err := json.Marshal(pv.Value)
					if err != nil {
						return fmt.Errorf("failed to marshal PortValue for port %s: %w", pv.PortIdentifier, err)
					}
					_, err = modelClient.AddInput(ctx, &devspb.InputMessage{
						PortName:  pv.PortIdentifier,
						ValueJson: string(valueJSONBytes),
					})
					if err != nil {
						return fmt.Errorf("AddInput error on port %s: %w", pv.PortIdentifier, err)
					}
				}
			}

			// 2) Choix du type de transition DEVS
			switch {
			case !hasInputs && t == nextTime:
				// Transition interne
				if _, err := modelClient.InternalTransition(ctx, &emptypb.Empty{}); err != nil {
					return fmt.Errorf("InternalTransition error: %w", err)
				}

			case hasInputs && t == nextTime:
				// Confluent (entrée + échéance interne)
				if _, err := modelClient.ConfluentTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
					return fmt.Errorf("ConfluentTransition error: %w", err)
				}

			case hasInputs && t < nextTime:
				// Transition externe (interruption avant nextTime)
				if _, err := modelClient.ExternalTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
					return fmt.Errorf("ExternalTransition error: %w", err)
				}

			default:
				log.Printf("⚠️ unexpected ExecuteTransition case: hasInputs=%v, t=%v, nextTime=%v", hasInputs, t, nextTime)
			}

			// 3) Nouveau nextTime après la transition (TA)
			taResp, err := modelClient.TimeAdvance(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("TimeAdvance error: %w", err)
			}
			sigma := taResp.GetSigma()
			nextTime = currentTime + sigma

			var nextTimeField *kafka.SimTime
			if math.IsInf(nextTime, 1) {
				nextTimeField = nil
			} else {
				nextTimeField = &kafka.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        nextTime,
				}
			}

			done := &kafka.KafkaMessage{
				DevsType: kafka.DevsTypeTransitionDone,
				Time: &kafka.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				NextTime: nextTimeField,
				Sender:   cfg.ID,
			}
			return cfg.Producer.SendDevsMessage(done)

		// ======================
		// SendOutput : lambda + ModelOutputMessage
		// ======================
		case kafka.DevsTypeSendOutput:
			if msg.Time != nil {
				currentTime = msg.Time.T
			}

			outResp, err := modelClient.Output(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("output error: %w", err)
			}

			var pvs []kafka.PortValue
			for _, po := range outResp.Outputs {
				for _, v := range po.ValuesJson {
					pvs = append(pvs, kafka.PortValue{
						PortIdentifier: po.PortName,
						PortType:       "", // tu pourras mettre un type plus tard
						Value:          v,  // c'est déjà une string JSON
					})
				}
			}

			outMsg := &kafka.KafkaMessage{
				DevsType: kafka.DevsTypeModelOutput,
				Time: &kafka.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				Sender: cfg.ID,
				ModelOutput: &kafka.ModelOutput{
					PortValueList: pvs,
				},
			}
			return cfg.Producer.SendDevsMessage(outMsg)

		// ======================
		// SimulationDone : Finalize
		// ======================
		case kafka.DevsTypeSimulationDone:
			if _, err := modelClient.Finalize(ctx, &emptypb.Empty{}); err != nil {
				return fmt.Errorf("finalize error: %w", err)
			}
			log.Println("SimulationDone received, model finalized.")
			return nil

		default:
			log.Printf("⚠️ Unhandled DevsType Message receive on kafka: %s", msg.DevsType)
			return nil
		}
	}); err != nil {
		return err
	}

	log.Println("======================================")
	log.Println("   Fin de la boucle de simulation    ")
	log.Println("======================================")

	return nil
}
