package internal

import (
	"context"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/kafka"
	"log"
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
	log.Println("Envoi des InitSim à tous les runners...")
	err := c.RunInitSim()
	if err != nil {
		return err
	}
	// Attente d'un NextTime par runner
	c.RunNextTime(nextTimeCh)
	log.Println("Tous les runners ont répondu avec leur NextTime initial.")

	// --- Phase 2 : Boucle principale de simulation ---
	for {
		tmin := computeMinTime(c.RunnerStates)
		if tmin == math.MaxFloat64 {
			log.Println("Tous les nextTime sont +Inf, fin de simulation.")
			break
		}

		// Si tu as une borne de fin dans le manifest, tu peux faire :
		// if manifest.EndTime > 0 && tmin > manifest.EndTime { break }

		// 1) trouver les imminents
		imminents := []*RunnerState{}
		for _, st := range c.RunnerStates {
			if st.NextTime == tmin {
				imminents = append(imminents, st)
			}
			// vider l'Inbox pour le nouveau pas de temps
			st.Inbox = nil
		}

		log.Printf("t = %.6f, imminents = %d\n", tmin, len(imminents))

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
	err = c.RunSimulationDone()
	if err != nil {
		return err
	}

	log.Println("Coordination terminée.")
	return nil
}
