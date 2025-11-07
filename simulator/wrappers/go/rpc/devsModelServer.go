// simulator/wrappers/go/rpc/devsModelServer.go
package rpc

import (
	"context"
	"fmt"

	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/wrappers/go/modeling"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

// DEVSModelServer implémente le service gRPC pour un modèle Atomic.
type DEVSModelServer struct {
	devspb.UnimplementedAtomicModelServiceServer

	model modeling.Atomic
}

// NewDEVSModelServer crée un nouveau serveur gRPC pour un modèle donné.
func NewDEVSModelServer(m modeling.Atomic) *DEVSModelServer {
	return &DEVSModelServer{
		model: m,
	}
}

// Initialize correspond à Component.Initialize()
func (s *DEVSModelServer) Initialize(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	s.model.Initialize()
	return &emptypb.Empty{}, nil
}

// Finalize correspond à Component.Exit()
func (s *DEVSModelServer) Finalize(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	s.model.Exit()
	return &emptypb.Empty{}, nil
}

// TimeAdvance correspond à TA()
func (s *DEVSModelServer) TimeAdvance(ctx context.Context, _ *emptypb.Empty) (*devspb.TimeAdvanceResponse, error) {
	sigma := s.model.TA()
	return &devspb.TimeAdvanceResponse{Sigma: sigma}, nil
}

// InternalTransition correspond à DeltInt()
func (s *DEVSModelServer) InternalTransition(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	s.model.DeltInt()
	return &emptypb.Empty{}, nil
}

// ExternalTransition correspond à DeltExt(e)
func (s *DEVSModelServer) ExternalTransition(ctx context.Context, req *devspb.ElapsedTime) (*emptypb.Empty, error) {
	s.model.DeltExt(req.GetValue())
	return &emptypb.Empty{}, nil
}

// ConfluentTransition correspond à DeltCon(e)
func (s *DEVSModelServer) ConfluentTransition(ctx context.Context, req *devspb.ElapsedTime) (*emptypb.Empty, error) {
	s.model.DeltCon(req.GetValue())
	return &emptypb.Empty{}, nil
}

// Output correspond à Lambda()
// On lit les ports de sortie et on renvoie les valeurs au runner.
func (s *DEVSModelServer) Output(ctx context.Context, _ *emptypb.Empty) (*devspb.OutputResponse, error) {
	// On laisse le modèle calculer ses sorties
	s.model.Lambda()

	var resp devspb.OutputResponse

	// Récupération des ports de sortie via Component.GetOutPorts()
	for _, port := range s.model.GetOutPorts() {
		portName := port.GetName()

		// On suppose que les ports sont typés []string
		values, ok := port.GetValues().([]string)
		if !ok {
			// Si ce n'est pas []string, on fallback en stringifiant
			// (à toi d'ajuster si tu veux utiliser du JSON ou autre)
			return nil, status.Errorf(
				codes.Internal,
				"port %s n'est pas de type []string (type réel: %T)",
				portName, port.GetValues(),
			)
		}

		out := &devspb.PortOutput{
			PortName:   portName,
			ValuesJson: values,
		}

		resp.Outputs = append(resp.Outputs, out)

		// Si tu veux vider le port après lecture :
		// port.Clear()
	}

	return &resp, nil
}

// AddInput permet d'ajouter une valeur dans un port d'entrée du modèle.
func (s *DEVSModelServer) AddInput(ctx context.Context, req *devspb.InputMessage) (*emptypb.Empty, error) {
	portName := req.GetPortName()
	value := req.GetValueJson() // ici on traite la valeur comme un string

	inPort := s.model.GetInPort(portName)
	if inPort == nil {
		return nil, status.Errorf(codes.NotFound, "input port %s not found", portName)
	}

	// Le port est supposé être créé avec un type []string côté modèle,
	// donc AddValue(string) est cohérent.
	inPort.AddValue(value)

	return &emptypb.Empty{}, nil
}

// Helper pour log/debug si besoin
func (s *DEVSModelServer) String() string {
	return fmt.Sprintf("DEVSModelServer(model=%s)", s.model.GetName())
}
