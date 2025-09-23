package internal

import (
	"devsforge/shared"
	"fmt"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type RunnerConfig struct {
	Model     *shared.RunnableModel
	ID        string
	Logger    *zerolog.Logger
	PeerCount int
}

var config *RunnerConfig

func InitConfig(manifest shared.RunnableManifest) *RunnerConfig {
	filePath := "/tmp/devs-sim-events.log"
	model := *manifest.Models[0]
	// A rendre dynamique avec les args
	logger := initFileLogger(filePath, model.ID)
	logger.Debug().Any("informations", map[string]string{
		"IPC Provider": "File based /tmp/simulation.log",
		"ID":           model.ID,
		"Name":         model.Name,
		"Language":     "Todo",
		"Ports":        fmt.Sprintf("%v", model.Ports),
		"Connections":  fmt.Sprintf("%v", model.Connections),
	}).Msg("Config Information")
	WatchAndStreamFile(filePath)

	config = &RunnerConfig{
		ID:        model.ID,
		Model:     &model,
		Logger:    logger,
		PeerCount: manifest.Count - 1,
	}

	return config
}

func initFileLogger(logFilePath string, id string) *zerolog.Logger {
	var output *os.File
	if logFilePath != "" {
		f, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0666)
		if err != nil {
			panic(err)
		}
		output = f
	} else {
		output = os.Stdout
	}

	l := zerolog.New(output).With().Timestamp().Str("ID", id).Logger()
	log.Logger = l // optionnel : mettre ce logger par défaut dans zerolog/log
	return &l
}

func GetConfig() *RunnerConfig {
	return config
}