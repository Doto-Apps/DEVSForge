// Package main provides the coordinator entry point and CLI management.
package main

import (
	"devsforge-coordinator/cmd"
	"devsforge-coordinator/internal/types"
	"flag"
	"fmt"
	"os"
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
		if err := cmd.StartDaemonServer(); err != nil {
			fmt.Println("❌", err)
			os.Exit(1)
		}
		return
	} else {
		params := types.SimulationParams{
			File:         filePath,
			Json:         jsonStr,
			KafkaAddress: kafka,
			KafkaTopic:   topic,
		}

		if err := cmd.RunOneSimulation(params); err != nil {
			fmt.Println("❌", err)
			os.Exit(1)
		}

	}
}
