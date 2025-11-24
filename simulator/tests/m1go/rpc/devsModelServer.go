// simulator/wrappers/go/rpc/devsModelServer.go
package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"wrapper/modeling"
	devspb "wrapper/proto"

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
	log.Printf("\n[DEBUG] %+v \n", s.model.GetPorts(nil))
	s.model.Lambda()
	log.Printf("\n[DEBUG] %+v \n", s.model.GetPorts(nil))

	var resp devspb.OutputResponse

	// Récupération des ports de sortie via Component.GetOutPorts()
	portType := "out"
	parsedValues := make([]string, 0)
	for _, port := range s.model.GetPorts(&portType) {
		portName := port.GetName()

		// On suppose que les ports sont typés []string
		values, ok := port.GetValues().([]interface{})
		if !ok {
			// Si ce n'est pas []string, on fallback en stringifiant
			// (à toi d'ajuster si tu veux utiliser du JSON ou autre)
			return nil, status.Errorf(
				codes.Internal,
				"port %s n'est pas de type []string (type réel: %T)",
				portName, port.GetValues(),
			)
		}
		for _, value := range values {
			parsedValue, err := json.Marshal(value)
			if err != nil {
				return nil, status.Errorf(
					codes.Internal,
					"Cannot marshal values : %s",
					err,
				)
			}
			parsedValues = append(parsedValues, string(parsedValue))

		}

		out := &devspb.PortOutput{
			PortName:   portName,
			ValuesJson: parsedValues,
		}

		resp.Outputs = append(resp.Outputs, out)

		// Si tu veux vider le port après lecture :
		port.Clear()
	}

	return &resp, nil
}

// AddInput permet d'ajouter une valeur dans un port d'entrée du modèle.
func (s *DEVSModelServer) AddInput(ctx context.Context, req *devspb.InputMessage) (*emptypb.Empty, error) {
	portName := req.GetPortName()
	value := req.GetValueJson() // ici on traite la valeur comme un string

	inPort, err := s.model.GetPortByName(portName)
	if err != nil {
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
