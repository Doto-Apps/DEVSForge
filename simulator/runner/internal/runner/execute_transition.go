package runner

import (
	"devsforge-shared/kafka"
	devspb "devsforge-wrapper/proto"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunExecuteTransition(msg kafka.KafkaMessageExecuteTransition) error {
	t := msg.Time.T
	ctx := r.Context
	modelClient := r.ModelClient

	// Temps écoulé depuis le dernier état
	e := t - r.CurrentTime
	if e < 0 {
		e = 0
	}
	r.CurrentTime = t

	hasInputs := len(msg.ModelInputsOption.PortValueList) > 0

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
	case !hasInputs && t == r.NextTime:
		// Transition interne
		if _, err := modelClient.InternalTransition(ctx, &emptypb.Empty{}); err != nil {
			return fmt.Errorf("InternalTransition error: %w", err)
		}

	case hasInputs && t == r.NextTime:
		// Confluent (entrée + échéance interne)
		if _, err := modelClient.ConfluentTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
			return fmt.Errorf("ConfluentTransition error: %w", err)
		}

	case hasInputs && t < r.NextTime:
		// Transition externe (interruption avant r.NextTime)
		if _, err := modelClient.ExternalTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
			return fmt.Errorf("ExternalTransition error: %w", err)
		}

	default:
		slog.Warn("Unexpected ExecuteTransition case", "hasInputs", hasInputs, "t", t, "nextTime", r.NextTime)
	}

	// 3) Nouveau r.NextTime après la transition (TA)
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

	nextTimeField := kafka.SimTime{
		TimeType: kafka.DevsDoubleSimTime.String(),
		T:        r.NextTime,
	}

	done := &kafka.KafkaMessageTransitionDone{
		DevsType: kafka.DevsTypeTransitionDone,
		Time: kafka.SimTime{
			TimeType: kafka.DevsDoubleSimTime.String(),
			T:        r.CurrentTime,
		},
		NextTime: nextTimeField,
		Sender:   r.Config.ID,
	}
	return r.SendMessage(done)
}
