package internal

import (
	"devsforge/shared"
	"fmt"
	"os"
	"sync"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type RunnerConfig struct {
	Model          shared.RunnableModel
	ID             string
	ProviderString string
	Logger         *zerolog.Logger
}

var (
	config *RunnerConfig
	once   sync.Once
)

func InitConfig(model shared.RunnableModel) *RunnerConfig {
	logger := initFileLogger("/tmp/devs-sim-events.log", model.ID)
	logger.Debug().Any("informations", map[string]string{
		"IPC Provider": "File based /tmp/simulation.log",
		"ID":           model.ID,
		"Name":         model.Name,
		"Language":     "Todo",
		"Ports":        fmt.Sprintf("%v", model.Ports),
		"Connections":  fmt.Sprintf("%v", model.Connections),
	}).Msg("Config Information")
	config = &RunnerConfig{
		ID:             model.ID,
		Model:          model,
		ProviderString: "file:/tmp/devs-sim-events.log",
		Logger:         logger,
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
