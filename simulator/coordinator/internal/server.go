package internal

import (
	"context"
	"devsforge-shared/utils"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	shared "devsforge-shared"
)

type SimulateRequest struct {
	JSON  string `json:"json,omitempty"`
	File  string `json:"file,omitempty"`
	Kafka string `json:"kafka,omitempty"`
	Topic string `json:"topic,omitempty"`
}

type SimulateResponse struct {
	SimulationID string `json:"simulationId"`
	Status       string `json:"status"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func StartDaemonServer(port int) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/simulate", handleSimulate)

	addr := fmt.Sprintf(":%d", port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		slog.Info("Shutting down daemon server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("Server shutdown error", "error", err)
		}
	}()

	slog.Info("Starting daemon server", "address", addr)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func handleSimulate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "method not allowed, use POST"})
		return
	}

	var req SimulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid JSON body: " + err.Error()})
		return
	}

	if req.JSON == "" && req.File == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "either 'json' or 'file' must be provided"})
		return
	}

	var manifest shared.RunnableManifest
	if req.JSON != "" {
		if err := utils.ParseManifest(req.JSON, &manifest); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest JSON: " + err.Error()})
			return
		}
	} else if req.File != "" {
		data, err := os.ReadFile(req.File)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "cannot read file: " + err.Error()})
			return
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid manifest file: " + err.Error()})
			return
		}
	}

	simulationID := manifest.SimulationID
	if simulationID == "" {
		simulationID = "unknown"
	}

	go launchSimulationAsync(req, simulationID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(SimulateResponse{
		SimulationID: simulationID,
		Status:       "running",
	})
}

func launchSimulationAsync(req SimulateRequest, simulationID string) {
	params := SimulationParams{
		KafkaAddress: &req.Kafka,
		Json:         &req.JSON,
		File:         &req.File,
		KafkaTopic:   &req.Topic,
	}

	slog.Info("Launching simulation asynchronously", "simulationId", simulationID)
	if err := RunSimulation(params); err != nil {
		slog.Error("Async simulation error", "simulationId", simulationID, "error", err)
	} else {
		slog.Info("Async simulation completed", "simulationId", simulationID)
	}
}
