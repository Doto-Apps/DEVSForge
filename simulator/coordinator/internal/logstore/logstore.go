package logstore

import "log/slog"

type LogMessage struct {
	Timestamp int64  `json:"timestamp"`
	Sender    string `json:"sender"`
	DevsType  string `json:"devsType"`
	Data      any    `json:"data"`
}

type SimulationStatus struct {
	Status       string       `json:"status"`
	CreatedAt    int64        `json:"createdAt"`
	EndedAt      int64        `json:"endedAt,omitempty"`
	ErrorMessage string       `json:"errorMessage,omitempty"`
	KafkaTopic   string       `json:"kafkaTopic"`
	Messages     []LogMessage `json:"messages,omitempty"`
}

type LogStore interface {
	GetLogger(simulationID string) (*slog.Logger, error)
	GetAll(simulationID string) ([]LogMessage, error)
	GetAllSince(simulationID string, since int64) ([]LogMessage, error)
	GetPaginated(simulationID string, offset int, limit int) ([]LogMessage, int, error)
	Delete(simulationID string) error
	DeleteAll() error
	SetStatus(simulationID string, status SimulationStatus) error
	GetStatus(simulationID string) (*SimulationStatus, error)
	DeleteAllLog(simulationID string) error
}

func NewFileLogStore(logDir string) LogStore {
	if logDir == "" {
		logDir = "logs"
	}
	return &fileLogStore{
		logDir: logDir,
	}
}
