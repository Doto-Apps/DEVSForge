package internal

import (
	"context"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/kafka"
	"fmt"
	"log"
	"math"

	"github.com/twmb/franz-go/pkg/kgo"
)

type Coordinator struct {
	Config  *CoordConfig
	Context context.Context
}

func CreateCoordinnator(cfg *CoordConfig, ctx context.Context) Coordinator {
	return Coordinator{
		Config:  cfg,
		Context: ctx,
	}
}

// RunCoordinator lance la boucle de coordination DEVS
func (c *Coordinator) RunCoordinator(manifest *shared.RunnableManifest, runnerStates map[string]*RunnerState) error {
	// Channels pour recevoir les messages importants
	nextTimeCh := make(chan *kafka.BaseKafkaMessage)
	transitionDoneCh := make(chan *kafka.BaseKafkaMessage)
	outputCh := make(chan *kafka.BaseKafkaMessage)
	log.SetPrefix("[COORDI] ")

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
				log.Printf("Unreconized message : %s\n", msg.DevsType.String())
			}
			return nil
		})
		if err != nil {
			log.Printf("❌ collector error in coordinator: %v", err)
		}
	}()

	// --- Phase 1 : InitSim pour tous les modèles ---

	startTime := 0.0 // si tu as un manifest.StartTime tu peux l’utiliser ici

	log.Println("Envoi des InitSim à tous les runners...")
	for _, st := range runnerStates {
		msg := &kafka.KafkaMessageInitSim{
			DevsType: kafka.DevsTypeInitSim,
			Time: &kafka.SimTime{
				TimeType: kafka.DevsDoubleSimTime.String(),
				T:        startTime,
			},
			Target: st.ID,
		}
		if err := c.SendMessage(msg); err != nil {
			return fmt.Errorf("error sending InitSim to %s: %w", st.ID, err)
		}
	}

	// Attente d'un NextTime par runner
	for range runnerStates {
		msg := <-nextTimeCh
		id := msg.Sender
		st, ok := runnerStates[id]
		if !ok {
			log.Printf("⚠️ NextTime from unknown runner %s", id)
			continue
		}
		if msg.NextTime == nil {
			st.NextTime = math.MaxFloat64
		} else {
			st.NextTime = msg.NextTime.T
		}
		st.HasInit = true
	}

	log.Println("Tous les runners ont répondu avec leur NextTime initial.")

	// --- Phase 2 : Boucle principale de simulation ---

	for {
		tmin := computeMinTime(runnerStates)
		if tmin == math.MaxFloat64 {
			log.Println("Tous les nextTime sont +Inf, fin de simulation.")
			break
		}

		// Si tu as une borne de fin dans le manifest, tu peux faire :
		// if manifest.EndTime > 0 && tmin > manifest.EndTime { break }

		// 1) trouver les imminents
		imminents := []*RunnerState{}
		for _, st := range runnerStates {
			if st.NextTime == tmin {
				imminents = append(imminents, st)
			}
			// vider l'Inbox pour le nouveau pas de temps
			st.Inbox = nil
		}

		log.Printf("t = %.6f, imminents = %d\n", tmin, len(imminents))

		// 2) demander les outputs aux imminents
		for _, st := range imminents {
			msg := &kafka.KafkaMessageSendOutput{
				DevsType: kafka.DevsTypeSendOutput,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        tmin,
				},
				Target: st.ID,
			}
			if err := c.SendMessage(msg); err != nil {
				return fmt.Errorf("error sending SendOutput to %s: %w", st.ID, err)
			}
		}

		// 3) récupérer les ModelOutput des imminents
		outputsBySender := map[string]*kafka.ModelOutput{}
		for range imminents {
			msg := <-outputCh
			outputsBySender[msg.Sender] = msg.ModelOutput
		}

		// 4) router les outputs vers les Inbox des destinataires
		routeOutputs(manifest, runnerStates, outputsBySender)

		// 5) déterminer qui transitionne
		transitionTargets := map[string]*RunnerState{}
		for _, st := range imminents {
			transitionTargets[st.ID] = st
		}
		for _, st := range runnerStates {
			if len(st.Inbox) > 0 {
				transitionTargets[st.ID] = st
			}
		}

		// 6) envoyer ExecuteTransition
		for _, st := range transitionTargets {
			var inputs kafka.ModelInputsOption
			if len(st.Inbox) > 0 {
				inputs = kafka.ModelInputsOption{
					PortValueList: st.Inbox,
				}
			}

			msg := &kafka.KafkaMessageExecuteTransition{
				DevsType: kafka.DevsTypeExecuteTransition,
				Time: kafka.SimTime{
					TimeType: kafka.DevsDoubleSimTime.String(),
					T:        tmin,
				},
				ModelInputsOption: inputs,
				Target:            st.ID,
			}
			if err := c.SendMessage(msg); err != nil {
				return fmt.Errorf("error sending ExecuteTransition to %s: %w", st.ID, err)
			}
		}

		// 7) attendre les TransitionDone
		for range transitionTargets {
			msg := <-transitionDoneCh
			st, ok := runnerStates[msg.Sender]
			if !ok {
				log.Printf("⚠️ TransitionDone from unknown runner %s", msg.Sender)
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

	log.Println("Envoi des SimulationDone à tous les runners...")
	for _, st := range runnerStates {
		msg := &kafka.KafkaMessageSimulationDone{
			DevsType: kafka.DevsTypeSimulationDone,
			Target:   st.ID,
		}

		if err := c.SendMessage(msg); err != nil {
			log.Printf("error sending SimulationDone to %s: %v", st.ID, err)
		}
	}

	log.Println("Coordination terminée.")
	return nil
}

// t_min global
func computeMinTime(runners map[string]*RunnerState) float64 {
	tmin := math.Inf(1)
	for _, st := range runners {
		if st.NextTime < tmin {
			tmin = st.NextTime
		}
	}
	return tmin
}

//
// ROUTAGE DES SORTIES → INBOX DES DESTINATAIRES
//

// routeOutputs distribue les outputs des modèles imminents vers les Inbox
// des modèles destinataires, en utilisant les connections du RunnableManifest.
func routeOutputs(
	manifest *shared.RunnableManifest,
	runners map[string]*RunnerState,
	outputsBySender map[string]*kafka.ModelOutput,
) {
	for senderID, out := range outputsBySender {
		if out == nil {
			continue
		}

		for _, pv := range out.PortValueList {
			// pv.PortIdentifier = nom du port de sortie du modèle senderID
			conns := findConnectionsFrom(manifest, senderID, pv.PortIdentifier)

			for _, c := range conns {
				// c.To.ID = ID du modèle destinataire
				// c.To.Port = nom du port d'entrée
				destState, ok := runners[c.To.ID]
				if !ok {
					log.Printf("⚠️ routeOutputs: aucun runner pour le modèle destination %s", c.To.ID)
					continue
				}

				destState.Inbox = append(destState.Inbox, kafka.PortValue{
					PortIdentifier: c.To.Port, // port d'entrée du modèle destinataire
					PortType:       pv.PortType,
					Value:          pv.Value, // déjà en interface{} / JSON-compatible
				})
			}
		}
	}
}

// findConnectionsFrom renvoie toutes les connections dont la source
// est (fromModelID, fromPort).
func findConnectionsFrom(
	manifest *shared.RunnableManifest,
	fromModelID string,
	fromPort string,
) []shared.RunnableModelConnection {
	var res []shared.RunnableModelConnection

	// On parcourt tous les modèles du manifest et on agrège leurs connections.
	// Ça marche que les connections soient stockées sur un modèle "root" couplé
	// ou réparties, on prend tout.
	for _, m := range manifest.Models {
		for _, c := range m.Connections {
			if c.From.ID == fromModelID && c.From.Port == fromPort {
				res = append(res, c)
			}
		}
	}

	return res
}

func (c *Coordinator) SendMessage(msg kafka.KafkaMessageI) error {
	data, err := msg.Marshal()
	if err != nil {
		return fmt.Errorf("cannot marshal kafka message : %w", err)
	}

	return c.Config.KafkaClient.ProduceSync(c.Context, &kgo.Record{Value: data}).FirstErr()
}

func (c *Coordinator) StartReceiveLoop(handler func(*kafka.BaseKafkaMessage) error) error {
	client := c.Config.KafkaClient
	for {
		fetches := client.PollFetches(c.Context)
		if errs := fetches.Errors(); len(errs) > 0 {
			// All errors are retried internally when fetching, but non-retriable errors are
			// returned from polls so that users can notice and take action.
			panic(fmt.Sprint(errs))
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
