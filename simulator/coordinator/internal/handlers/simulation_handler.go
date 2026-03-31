package handlers

import (
	"devsforge-coordinator/internal/logstore"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strconv"
)

func getLogDir() string {
	logDir := os.Getenv("LOG_DIR")
	if logDir == "" {
		logDir = "logs"
	}
	return logDir
}

func getLogStore() logstore.LogStore {
	return logstore.NewFileLogStore(getLogDir())
}

type SimulationLogsResponse struct {
	SimulationID string                `json:"simulationId"`
	Status       string                `json:"status"`
	CreatedAt    int64                 `json:"createdAt"`
	EndedAt      int64                 `json:"endedAt,omitempty"`
	ErrorMessage string                `json:"errorMessage,omitempty"`
	KafkaTopic   string                `json:"kafkaTopic"`
	Logs         []logstore.LogMessage `json:"logs"`
}

type CleanResponse struct {
	Success bool `json:"success"`
	Deleted int  `json:"deleted,omitempty"`
}

func handleGetSimulationLogs(w http.ResponseWriter, r *http.Request) error {
	logStore := getLogStore()
	simulationID := r.PathValue("simulationID")
	if simulationID == "" {
		http.NotFound(w, r)
		return nil
	}

	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return (json.NewEncoder(w).Encode(ErrorResponse{Error: "method not allowed, use GET"}))
	}

	sinceParam := r.URL.Query().Get("since")
	var since int64 = 0
	if sinceParam != "" {
		var err error
		since, err = strconv.ParseInt(sinceParam, 10, 64)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return (json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid since parameter, must be Unix timestamp"}))
		}
	}

	status, statusErr := logStore.GetStatus(simulationID)
	var messages []logstore.LogMessage
	var loadErr error

	if statusErr != nil {
		loadErr = statusErr
	} else {
		if status.Status == "running" || len(status.Messages) == 0 {
			if since > 0 {
				messages, loadErr = logStore.GetAllSince(simulationID, since)
			} else {
				messages, loadErr = logStore.GetAll(simulationID)
			}
		} else {
			if since > 0 {
				for _, msg := range status.Messages {
					if msg.Timestamp >= since {
						messages = append(messages, msg)
					}
				}
			} else {
				messages = status.Messages
			}
		}
	}

	response := SimulationLogsResponse{
		SimulationID: simulationID,
		Logs:         []logstore.LogMessage{},
	}

	if loadErr != nil {
		response.ErrorMessage = loadErr.Error()
	} else if status != nil {
		response.Status = status.Status
		response.CreatedAt = status.CreatedAt
		response.EndedAt = status.EndedAt
		response.ErrorMessage = status.ErrorMessage
		response.KafkaTopic = status.KafkaTopic
		response.Logs = messages
	}

	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(response)
}

func handleCleanSimulation(w http.ResponseWriter, r *http.Request) error {
	logStore := getLogStore()
	simulationID := r.PathValue("simulationID")
	if simulationID == "" {
		http.NotFound(w, r)
		return nil
	}

	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return (json.NewEncoder(w).Encode(ErrorResponse{Error: "method not allowed, use DELETE"}))
	}

	if err := logStore.Delete(simulationID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: err.Error()})
	}

	slog.Info("Simulation logs cleaned", "simulationId", simulationID)
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(CleanResponse{Success: true})
}

func handleCleanAll(w http.ResponseWriter, r *http.Request) error {
	logDir := getLogDir()
	logStore := getLogStore()
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "method not allowed, use DELETE"})
	}

	entries, err := os.ReadDir(logDir)
	if err != nil {
		if os.IsNotExist(err) {
			w.WriteHeader(http.StatusOK)
			return json.NewEncoder(w).Encode(CleanResponse{Success: true, Deleted: 0})
		}
		w.WriteHeader(http.StatusInternalServerError)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: err.Error()})
	}

	deleted := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if err := logStore.Delete(entry.Name()); err != nil {
			slog.Warn("Failed to delete simulation logs", "simulationId", entry.Name(), "error", err)
			continue
		}
		deleted++
	}

	slog.Info("All simulation logs cleaned", "deleted", deleted)
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(CleanResponse{Success: true, Deleted: deleted})
}

