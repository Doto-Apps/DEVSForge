package simulation

import (
	"bytes"
	"devsforge/config"
	"devsforge/database"
	"devsforge/model"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"
)

func (s *SimulationService) runRemoteCoordinatorSync(simulationID string, manifestFile string) {
	defer func() {
		if err := os.Remove(manifestFile); err != nil {
			slog.Warn("cannot delete temporary manifest file")
		}
	}()

	log := slog.With("simulationId", simulationID)
	log.Info("Starting remote coordinator (sync mode)")

	manifestData, err := os.ReadFile(manifestFile)
	if err != nil {
		log.Error("Failed to read manifest file", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to read manifest: %v", err))
		return
	}

	cfg := config.Get()
	kafkaAddr := cfg.Kafka.Address
	kafkaTopic := generateTopicName(simulationID)

	body := SimulateRequestBody{
		JSON:       string(manifestData),
		KafkaTopic: kafkaTopic,
		KafkaAddr:  kafkaAddr,
	}
	jsonData, err := json.Marshal(body)
	if err != nil {
		log.Error("Failed to marshal request body", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to marshal request: %v", err))
		return
	}

	url := config.Get().Simulator.Addr + "/simulate"

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Error("Failed to create HTTP request", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to create request: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Error("HTTP request failed", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("request failed: %v", err))
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Warn("cannot close response body")
		}
	}()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		log.Error("Simulator returned error", "status", resp.StatusCode, "body", string(body))
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("simulator error %d: %s", resp.StatusCode, string(body)))
		return
	}

	respBody, _ := io.ReadAll(resp.Body)
	log.Info("Remote coordinator launched successfully", "response", string(respBody))

	db := database.DB
	now := time.Now()

	result := db.Model(&model.Simulation{}).
		Where("id = ? AND status <> ?", simulationID, model.SimulationStatusFailed).
		Updates(map[string]any{
			"status":       model.SimulationStatusCompleted,
			"completed_at": now,
		})
	if result.Error != nil {
		log.Error("Failed to mark simulation as completed", "error", result.Error)
	}
}
