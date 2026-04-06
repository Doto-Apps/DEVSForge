// Package handlers provides HTTP handlers for simulation endpoints.
package handlers

import (
	"log/slog"
	"net/http"
)

func SetupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/simulate", handleEncodeError(handleSimulate))
	mux.HandleFunc("/simulate-async", handleEncodeError(handleSimulateAsync))
	mux.HandleFunc("/simulation/{simulationID}/logs", handleEncodeError(handleGetSimulationLogs))
	mux.HandleFunc("/simulation/{simulationID}/clean", handleEncodeError(handleCleanSimulation))
	mux.HandleFunc("/clean-all", handleEncodeError(handleCleanAll))
}

func handleEncodeError(handler func(w http.ResponseWriter, r *http.Request) error) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := handler(w, r); err != nil {
			slog.Warn("Cannot write response", "error", err)
		}
	}
}

type SimulateRequest struct {
	JSON  string `json:"json,omitempty"`
	File  string `json:"file,omitempty"`
	Kafka string `json:"kafka,omitempty"`
	Topic string `json:"topic,omitempty"`
}

type SimulateResponse struct {
	SimulationID string `json:"simulationId"`
	Status       string `json:"status"`
	Error        string `json:"error,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
