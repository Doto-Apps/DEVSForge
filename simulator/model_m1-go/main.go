package main

import (
	"encoding/json"
	"flag"
	"log"
	"net"
	"os"

	"devsforge-wrapper/modeling"
	devspb "devsforge-wrapper/proto"
	rpcwrapper "devsforge-wrapper/rpc"

	"google.golang.org/grpc"
)

func main() {
	log.SetPrefix("[WRAPPER] ")
	log.Printf("wrapper PID=%d starting...", os.Getpid())
	log.Println("======================================")
	log.Println("   ⚙️ Wrapper RPC for model GeneratorIncremental")
	log.Println("======================================")

	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse") // --json "<...>"

	var config modeling.RunnableModel

	// Parse les arguments de la ligne de commande
	if err := fs.Parse(os.Args[1:]); err != nil {
		log.Fatalf("error parsing flags: %v", err)
	}

	// Récupération / parsing du JSON
	if *jsonStr == "" {
		log.Fatalf("please provide --json")
	}

	if err := json.Unmarshal([]byte(*jsonStr), &config); err != nil {
		log.Fatalf("error parsing JSON: %v", err)
	}

	// Création du modèle utilisateur : TOUT est géré dans model.go
	model := NewModel(config)

	// Port gRPC défini dans la config du runner
	port := "58765"

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	devspb.RegisterAtomicModelServiceServer(s, rpcwrapper.NewDEVSModelServer(model))

	log.Println("DEVS model", config.Name, "listening on :"+port)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
