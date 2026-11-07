// Package main provides the runner entry point.
package main

import (
	"context"
	"devsforge-runner/cmd"
	"devsforge-runner/integrations"
	"devsforge-runner/internal/lsp"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	lspDaemon := fs.Bool("lsp-daemon", false, "Run isolated language server service")
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("config", "", "Path to YAML config file")

	if err := fs.Parse(os.Args[1:]); err != nil {
		panic(fmt.Errorf("error parsing flags: %w", err))
	}

	if err := integrations.Validate(); err != nil {
		panic(err)
	}
	if *lspDaemon {
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if err := lsp.Run(ctx); err != nil {
			panic(err)
		}
		return
	}
	if err := cmd.LaunchRunner(jsonStr, configFile, filePath); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
