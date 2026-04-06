// Package handlers Simulation http hanlders
package handlers

import (
	"devsforge-coordinator/internal/logstore"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
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
	SimulationID  string                `json:"simulationId"`
	Status        string                `json:"status"`
	CreatedAt     int64                 `json:"createdAt"`
	EndedAt       int64                 `json:"endedAt,omitempty"`
	ErrorMessage  string                `json:"errorMessage,omitempty"`
	KafkaTopic    string                `json:"kafkaTopic"`
	Logs          []logstore.LogMessage `json:"logs"`
	TotalMessages *int                  `json:"totalMessages,omitempty"`
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
	dir := filepath.Join(logStore.GetLogDir(simulationID), simulationID)
	if _, err := os.Stat(dir); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "cannot retrieve logDir"})
	}

	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "method not allowed, use GET"})
	}

	offsetParam := r.URL.Query().Get("offset")
	limitParam := r.URL.Query().Get("limit")

	offset := 0
	if offsetParam != "" {
		if parsed, err := strconv.Atoi(offsetParam); err == nil {
			offset = parsed
		}
	}

	var limit *int
	if limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil {
			limit = &parsed
		}
	}

	status, statusErr := logStore.GetStatus(simulationID)
	var messages []logstore.LogMessage
	var totalMessages *int
	var loadErr error

	if statusErr != nil {
		loadErr = statusErr
	} else {
		if limit != nil {
			pagedMessages, total, err := logStore.GetPaginated(simulationID, offset, *limit)
			if err != nil {
				loadErr = err
			} else {
				messages = pagedMessages
				if status.Status != "running" {
					totalMessages = &total
				}
			}
		} else {
			messages, loadErr = logStore.GetAll(simulationID)
			if loadErr == nil && status.Status != "running" {
				t := len(messages)
				totalMessages = &t
			}
		}
	}

	response := SimulationLogsResponse{
		SimulationID:  simulationID,
		Logs:          []logstore.LogMessage{},
		TotalMessages: totalMessages,
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
