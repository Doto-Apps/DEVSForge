package internal

import (
	"fmt"
	"log"
	"time"
)

type Message struct {
	ID      string `json:"id"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

var messageCh = make(chan string, 1)

func HandleMessage(message string) error {
	log.Println("Got a msg")
	// var parsedMessage Message
	// err := json.Unmarshal([]byte(message), &parsedMessage)
	// if err != nil {
	// 	return fmt.Errorf("error when parsing message: %w", err)
	// }
	//
	// //Message that need to be considered : info level and id different of the current config
	// if parsedMessage.Level == "info" && parsedMessage.ID != config.ID {
	// 	if parsedMessage.Message == "init_done" || parsedMessage.Message == "election_required" {
	// 		log.Println("Got a message here")
	// 		messageCh <- parsedMessage.Message
	// 	}
	// 	log.Printf("Got a message that I dont handle: %v\n", parsedMessage)
	// }
	if message == "init_done" || message == "election_required" {
		log.Printf("Got a message %s\n", message)
		messageCh <- message
	}
	log.Printf("Got a message that I dont handle: %v\n", message)

	return nil
}

func SendMessage(msg string) {
	// Logic to implement from config to choose the right place to send message/multiplex message
	// config.Logger.Info().Msg(msg)
	config.Producer.SendMessage(msg)
	log.Println("Message sent ", msg)
}

func WaitForElectionRequired(timeout time.Duration) {
	count := 0
	n := config.PeerCount
	for {
		msg := <-messageCh
		if msg == "election_required" {
			count++
			if count >= n {
				return
			}
		}
	}
}

func WaitForAllReady(timeout time.Duration) {
	count := 0
	n := config.PeerCount
	for {
		msg := <-messageCh
		if msg == "init_done" {
			count++
			if count >= n {
				return
			}
		}
	}
}

func GenerateBootstrapSource(cfg *RunnerConfig) string {
	return fmt.Sprintf(`package main

import (
	"context"
	"log"
	"net"

	devspb "bootstrap/proto"
	"google.golang.org/grpc"
)

// ---- Minimal glue to bind a modeling.Atomic to gRPC ----

type server struct {
	devspb.UnimplementedDevsModelServer
	m interface{ // minimal methods expected from user model
		TA() float64
		DeltInt()
		DeltExt(e float64)
		DeltCon(e float64)
		Lambda()
	}
}

func newServer(m interface{ TA() float64; DeltInt(); DeltExt(float64); DeltCon(float64); Lambda() }) *server { return &server{m: m} }

func (s *server) Initialize(_ context.Context, _ *devspb.InitializeRequest) (*devspb.InitializeResponse, error) {
	return &devspb.InitializeResponse{}, nil
}
func (s *server) TimeAdvance(_ context.Context, _ *devspb.TimeAdvanceRequest) (*devspb.TimeAdvanceResponse, error) {
	return &devspb.TimeAdvanceResponse{Sigma: s.m.TA()}, nil
}
func (s *server) InternalTransition(_ context.Context, _ *devspb.InternalTransitionRequest) (*devspb.InternalTransitionResponse, error) {
	s.m.Lambda()
	s.m.DeltInt()
	return &devspb.InternalTransitionResponse{}, nil
}
func (s *server) ExternalTransition(_ context.Context, in *devspb.ExternalTransitionRequest) (*devspb.ExternalTransitionResponse, error) {
	s.m.DeltExt(in.GetE())
	return &devspb.ExternalTransitionResponse{}, nil
}
func (s *server) ConfluentTransition(_ context.Context, in *devspb.ConfluentTransitionRequest) (*devspb.ConfluentTransitionResponse, error) {
	s.m.DeltCon(in.GetE())
	return &devspb.ConfluentTransitionResponse{}, nil
}
func (s *server) Output(_ context.Context, _ *devspb.OutputRequest) (*devspb.OutputResponse, error) {
	s.m.Lambda()
	return &devspb.OutputResponse{}, nil
}
func (s *server) GetState(_ context.Context, _ *devspb.GetStateRequest) (*devspb.GetStateResponse, error) {
	return &devspb.GetStateResponse{StateJson: "{}"}, nil
}

func main() {
	// Build user model from model.go
	model := NewModel()

	port := "%d"
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil { log.Fatalf("failed to listen: %v", err) }

	s := grpc.NewServer()
	devspb.RegisterDevsModelServer(s, newServer(model))
	log.Printf("DEVS model %s listening on :%s", %q, port)
	if err := s.Serve(lis); err != nil { log.Fatalf("failed to serve: %v", err) }
}
`, cfg.GRPC.Port, cfg.Model.Name)
}
