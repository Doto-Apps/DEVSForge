// Package logstore handle log writes
package logstore

import (
	"devsforge-shared/simulation"
	"log/slog"
)

type SimulationStatus struct {
	Status       string                  `json:"status"`
	CreatedAt    int64                   `json:"createdAt"`
	EndedAt      int64                   `json:"endedAt,omitempty"`
	ErrorMessage string                  `json:"errorMessage,omitempty"`
	KafkaTopic   string                  `json:"kafkaTopic"`
	Messages     []simulation.LogMessage `json:"messages,omitempty"`
}

type LogStore interface {
	GetLogger(simulationID string) (*slog.Logger, error)
	GetAll(simulationID string) ([]simulation.LogMessage, error)
	GetAllSince(simulationID string, since int64) ([]simulation.LogMessage, error)
	GetPaginated(simulationID string, offset int, limit int) ([]simulation.LogMessage, int, error)
	Delete(simulationID string) error
	DeleteAll() error
	SetStatus(simulationID string, status SimulationStatus) error
	GetStatus(simulationID string) (*SimulationStatus, error)
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
