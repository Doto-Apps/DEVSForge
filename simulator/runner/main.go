// Package main provides the runner entry point.
package main

import (
	"devsforge-runner/cmd"
	"flag"
	"fmt"
	"os"
)

func main() {
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("config", "", "Path to YAML config file")

	if err := fs.Parse(os.Args[1:]); err != nil {
		panic(fmt.Errorf("error parsing flags: %w", err))
	}

	if err := cmd.LaunchRunner(jsonStr, configFile, filePath); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
