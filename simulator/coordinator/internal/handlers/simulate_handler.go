package handlers

import (
	"devsforge-coordinator/internal/simulation"
	"devsforge-coordinator/internal/types"
	shared "devsforge-shared"
	"devsforge-shared/utils"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
)

func handleSimulateAsync(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return nil
	}

	var req SimulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid JSON body: " + err.Error()})
	}

	if req.JSON == "" && req.File == "" {
		w.WriteHeader(http.StatusBadRequest)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "either 'json' or 'file' must be provided"})
	}

	var manifest shared.RunnableManifest
	if req.JSON != "" {
		if err := utils.ParseManifest(req.JSON, &manifest); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest JSON: " + err.Error()})
		}
	} else if req.File != "" {
		data, err := os.ReadFile(req.File)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "cannot read file: " + err.Error()})
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest file: " + err.Error()})
		}
	}

	simulationID := manifest.SimulationID
	if simulationID == "" {
		w.WriteHeader(http.StatusBadRequest)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest: simulationId is empty"})
	}

	jsonVal := req.JSON
	fileVal := req.File
	kafkaVal := req.Kafka
	topicVal := req.Topic

	params := types.SimulationParams{
		Json:         &jsonVal,
		File:         &fileVal,
		KafkaAddress: &kafkaVal,
		KafkaTopic:   &topicVal,
	}

	slog.Info("Launching simulation synchronously", "simulationId", simulationID)
	go func() {
		if err := simulation.RunSimulation(params); err != nil {
			slog.Error("Async simulation error", "simulationId", simulationID, "error", err)
		} else {
			slog.Info("Async simulation finished", "simulationId", simulationID)
		}
	}()

	slog.Info("Async simulation launched", "simulationId", simulationID)
	w.WriteHeader(http.StatusCreated)
	return json.NewEncoder(w).Encode(SimulateResponse{
		SimulationID: simulationID,
		Status:       "running",
	})
}

func handleSimulate(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return nil
	}

	var req SimulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid JSON body: " + err.Error()})
	}

	if req.JSON == "" && req.File == "" {
		w.WriteHeader(http.StatusBadRequest)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "either 'json' or 'file' must be provided"})
	}

	var manifest shared.RunnableManifest
	if req.JSON != "" {
		if err := utils.ParseManifest(req.JSON, &manifest); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest JSON: " + err.Error()})
		}
	} else if req.File != "" {
		data, err := os.ReadFile(req.File)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "cannot read file: " + err.Error()})
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest file: " + err.Error()})
		}
	}

	simulationID := manifest.SimulationID
	if simulationID == "" {
		simulationID = "unknown"
	}

	jsonVal := req.JSON
	fileVal := req.File
	kafkaVal := req.Kafka
	topicVal := req.Topic

	params := types.SimulationParams{
		Json:         &jsonVal,
		File:         &fileVal,
		KafkaAddress: &kafkaVal,
		KafkaTopic:   &topicVal,
	}

	slog.Info("Launching simulation synchronously", "simulationId", simulationID)
	if err := simulation.RunSimulation(params); err != nil {
		slog.Error("Sync simulation error", "simulationId", simulationID, "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return json.NewEncoder(w).Encode(SimulateResponse{
			SimulationID: simulationID,
			Status:       "launch_error",
			Error:        err.Error(),
		})

	}

	slog.Info("Sync simulation completed", "simulationId", simulationID)
	w.WriteHeader(http.StatusCreated)
	return json.NewEncoder(w).Encode(SimulateResponse{
		SimulationID: simulationID,
		Status:       "completed",
	})
}
