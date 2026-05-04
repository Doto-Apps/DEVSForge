package simulation

import (
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"log/slog"
	"math"
)

func computeGlobalMinTime(runners map[string]*types.RunnerState) float64 {
	tmin := math.MaxFloat64
	for _, st := range runners {
		if st.NextInternalTime < tmin {
			tmin = st.NextInternalTime
		}
	}
	return tmin
}

func routeOutputs(
	manifest *shared.RunnableManifest,
	runners types.RunnerStates,
	outputsBySender map[string]*kafka.KafkaMessageOutputReportPayload,
) {
	for senderID, outputReportPayload := range outputsBySender {
		if outputReportPayload == nil {
			continue
		}

		for _, portPayload := range outputReportPayload.Outputs {
			conns := findConnectionsFrom(manifest, senderID, portPayload.PortName)

			for _, c := range conns {
				destState, ok := runners[c.To.ID]
				if !ok {
					slog.Warn("No runner for destination model", "destination_id", c.To.ID)
					continue
				}

				destState.InPorts = append(destState.InPorts, &kafka.KafkaMessagePortPayload{
					PortName: c.To.Port,
					Value:    portPayload.Value,
				})
			}
		}
	}
}

func findConnectionsFrom(
	manifest *shared.RunnableManifest,
	fromModelID string,
	fromPort string,
) []shared.RunnableModelConnection {
	var res []shared.RunnableModelConnection

	for _, m := range manifest.Models {
		for _, c := range m.Connections {
			if c.From.ID == fromModelID && c.From.Port == fromPort {
				res = append(res, c)
			}
		}
	}

	return res
}
