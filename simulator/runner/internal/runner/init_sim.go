package runner

import (
	"devsforge-shared/kafka"
	"fmt"
	"math"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunInitSim(msg kafka.KafkaMessageInitSim) error {
	t := 0.0
	ctx := r.Context
	modelClient := r.ModelClient
	if msg.EventTime != nil {
		t = msg.EventTime.T
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
	r.NextInternalTime = r.CurrentTime + sigma

	if math.IsInf(r.NextInternalTime, 1) {
		// On garde nextTime en mémoire, mais on NE l’envoie PAS dans le message JSON
		r.NextInternalTime = math.MaxFloat64
	}

	nextTimeField := kafka.SimTime{
		TimeType: string(kafka.MsgTypeNextInternalTimeReport),
		T:        r.NextInternalTime,
	}

	resp := &kafka.KafkaMessageNextInternalTime{
		MsgType: kafka.MsgTypeNextInternalTimeReport,
		EventTime: &kafka.SimTime{
			TimeType: kafka.DevsDoubleSimTime.String(),
			T:        r.CurrentTime,
		},
		NextInternalTime: nextTimeField,
		SenderID:         r.Config.ID,
	}

	return r.SendMessage(resp)
}
