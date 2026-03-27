package internal

import (
	shared "devsforge-shared"
	"devsforge-shared/kafka"
	"log/slog"
	"math"
)

// t_min global
func computeMinTime(runners map[string]*RunnerState) float64 {
	tmin := math.MaxFloat64
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
	runners RunnerStates,
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
					slog.Warn("No runner for destination model", "destination_id", c.To.ID)
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
