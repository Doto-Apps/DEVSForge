package internal

import (
	"devsforge/simulator/shared/kafka"
	"fmt"
	"math"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunInitSim(msg kafka.KafkaMessageInitSim) error {
	t := 0.0
	ctx := r.Context
	modelClient := r.ModelClient
	if msg.Time != nil {
		t = msg.Time.T
	}
	r.CurrentTime = t

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
	r.NextTime = r.CurrentTime + sigma

	if math.IsInf(r.NextTime, 1) {
		// On garde nextTime en mémoire, mais on NE l’envoie PAS dans le message JSON
		r.NextTime = math.MaxFloat64
	}

	var nextTimeField kafka.SimTime
	nextTimeField = kafka.SimTime{
		TimeType: kafka.DevsTypeNextTime.String(),
		T:        r.NextTime,
	}

	resp := &kafka.KafkaMessageNextTime{
		DevsType: kafka.DevsTypeNextTime,
		Time: &kafka.SimTime{
			TimeType: kafka.DevsDoubleSimTime.String(),
			T:        r.CurrentTime,
		},
		NextTime: nextTimeField,
		Sender:   r.Config.ID,
	}

	return r.SendMessage(resp)
}
