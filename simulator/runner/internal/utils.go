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
	"encoding/json"
	"flag"
	"log"
	"net"
	"os"

	"devsforge/simulator/shared"
	modeling "devsforge/simulator/wrappers/go/modeling"
	rpcwrapper "devsforge/simulator/wrappers/go/rpc"
	devspb "devsforge/simulator/proto/go"
	"google.golang.org/grpc"
)

func main() {
	log.SetPrefix("[WRAPPER] ")
    log.Printf("wrapper PID=%%d starting...", os.Getpid())
	log.Println("======================================")
	log.Println("   ⚙️ Wraper RPC for model %s" )
	log.Println("======================================")
	
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse") // --json ""

	var config shared.RunnableModel

	// Parse les arguments de la ligne de commande
	if err := fs.Parse(os.Args[1:]); err != nil {
		log.Fatalf("error parsing flags: %%v", err)
	}

	// Récupération / parsing du JSON
	if *jsonStr != "" {
		if err := json.Unmarshal([]byte(*jsonStr), &config); err != nil {
			log.Fatalf("error parsing JSON: %%v", err)
		}
	} else {
		log.Fatalf("please provide --json")
	}

	// Extraction des valeurs de paramètres
	values := make([]any, len(config.Parameters))
	for i, p := range config.Parameters {
		values[i] = p.Value
	}

	// NewAtomic() est définie dans model.go (code utilisateur)
	// antoine, la il faut mettre les paramaetre
	model := modeling.NewAtomic(config.Name)

	// Création des ports à partir de la config
	for _, port := range config.Ports {
		if port.Type == "in" {
			model.AddInPort(modeling.NewPort(port.ID, ""))
		} else {
			model.AddOutPort(modeling.NewPort(port.ID, ""))
		}
	}

	// Port gRPC figé depuis la config du runner
	port := "%d"

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %%v", err)
	}

	s := grpc.NewServer()
	devspb.RegisterDevsModelServer(s, rpcwrapper.NewDevsModelServer(model))

	log.Printf("DEVS model %%s listening on :%%s", %q, port)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %%v", err)
	}
}
`, cfg.Model.Name, cfg.GRPC.Port, cfg.Model.Name)
}
