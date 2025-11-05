package internal

import (
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func InitFileLogger(logFilePath string, id string) *zerolog.Logger {
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