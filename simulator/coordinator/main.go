package main

import (
	"devsforge-coordinator/internal"
	"flag"
	"fmt"
	"os"
	"strconv"
)

func main() {
	fs := flag.NewFlagSet("coordinator", flag.ContinueOnError)
	daemon := fs.Bool("daemon", false, "Run in daemon mode (HTTP server)")
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	kafka := fs.String("kafka", "", "The kafka endpoint")
	topic := fs.String("topic", "", "The kafka topic (generated if not provided)")

	if err := fs.Parse(os.Args[1:]); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}

	if *daemon {
		port := 8080
		if portStr := os.Getenv("SIMULATOR_PORT"); portStr != "" {
			if parsed, err := strconv.Atoi(portStr); err == nil {
				port = parsed
			}
		}

		if err := internal.StartDaemonServer(port); err != nil {
			fmt.Println("❌", err)
			os.Exit(1)
		}
		return
	}

	params := internal.SimulationParams{
		File:         filePath,
		Json:         jsonStr,
		KafkaAddress: kafka,
		KafkaTopic:   topic,
	}

	if err := internal.RunSimulation(params); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
