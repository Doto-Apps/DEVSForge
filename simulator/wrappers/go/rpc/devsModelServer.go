// simulator/wrappers/go/rpc/devsModelServer.go
package rpc

import (
	"context"
	"log"

	devspb "devsforge/simulator/proto/go"
	modeling "devsforge/simulator/wrappers/go/modeling"
)

// DevsModelServer est l'adaptateur entre ton modèle DEVS (modeling.Atomic)
// et l'API gRPC générée à partir de devs.proto.
type DevsModelServer struct {
	devspb.UnimplementedDevsModelServer
	model modeling.Atomic
}

// NewDevsModelServer construit un serveur gRPC pour un modèle donné.
func NewDevsModelServer(m modeling.Atomic) devspb.DevsModelServer {
	return &DevsModelServer{
		model: m,
	}
}

// Initialize est appelé par le runner via gRPC pour initialiser le modèle.
// Tu pourras plus tard utiliser req pour paramétrer ton modèle si besoin.
func (s *DevsModelServer) Initialize(
	ctx context.Context,
	req *devspb.InitializeRequest,
) (*devspb.InitializeResponse, error) {

	log.Printf("Initialize called for model %s", req.GetModelName())

	// Ici tu pourras appeler des méthodes sur s.model,
	// par ex. s.model.Passivate(), HoldIn(), etc.

	return &devspb.InitializeResponse{}, nil
}
