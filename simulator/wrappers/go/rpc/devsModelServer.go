// simulator/wrappers/go/rpc/devsModelServer.go
package rpc

import (
	"context"
	"encoding/json"
	"fmt"

	"devsforge-wrapper/modeling"
	devspb "devsforge-wrapper/proto"

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
	portType := "out"
	for _, port := range s.model.GetPorts(&portType) {
		portName := port.GetName()

		// Les ports sont stockés en []interface{} dans le runtime wrapper.
		values, ok := port.GetValues().([]interface{})
		if !ok {
			return nil, status.Errorf(
				codes.Internal,
				"port %s is not []interface{} (actual type: %T)",
				portName, port.GetValues(),
			)
		}

		parsedValues := make([]string, 0, len(values))
		for _, value := range values {
			parsedValue, err := marshalPortValueAsJSON(value)
			if err != nil {
				return nil, status.Errorf(
					codes.Internal,
					"cannot JSON-encode output value on port %s: %s",
					portName,
					err,
				)
			}
			parsedValues = append(parsedValues, parsedValue)

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
	valueJSON := req.GetValueJson()

	var value interface{}
	if err := json.Unmarshal([]byte(valueJSON), &value); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid JSON for value_json on port %s: %s", portName, err)
	}

	inPort, err := s.model.GetPortByName(portName)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "input port %s not found", portName)
	}

	inPort.AddValue(value)

	return &emptypb.Empty{}, nil
}

func marshalPortValueAsJSON(value interface{}) (string, error) {
	// Compat path: many existing Go models emit []byte(JSON).
	if raw, ok := value.([]byte); ok {
		var decoded interface{}
		if err := json.Unmarshal(raw, &decoded); err == nil {
			normalized, err := json.Marshal(decoded)
			if err != nil {
				return "", err
			}
			return string(normalized), nil
		}
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

// Helper pour log/debug si besoin
func (s *DEVSModelServer) String() string {
	return fmt.Sprintf("DEVSModelServer(model=%s)", s.model.GetName())
}
