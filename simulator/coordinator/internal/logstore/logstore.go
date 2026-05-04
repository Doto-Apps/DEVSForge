// Package logstore handle log writes
package logstore

import (
	"devsforge-coordinator/internal/types"
	"devsforge-shared/simulation"
	"log/slog"
)

type LogStore interface {
	GetLogger(simulationID string) (*slog.Logger, error)
	GetAll(simulationID string) ([]simulation.LogMessage, error)
	GetAllSince(simulationID string, since int64) ([]simulation.LogMessage, error)
	GetPaginated(simulationID string, offset int, limit int) ([]simulation.LogMessage, int, error)
	Delete(simulationID string) error
	DeleteAll() error
	SetStatus(simulationID string, status types.SimulationStatus) error
	GetStatus(simulationID string) (*types.SimulationStatus, error)
	DeleteAllLog(simulationID string) error
	GetLogDir(simulationID string) string
}

func NewFileLogStore(logDir string) LogStore {
	if logDir == "" {
		logDir = "logs"
	}
	return &fileLogStore{
		logDir: logDir,
	}
}
