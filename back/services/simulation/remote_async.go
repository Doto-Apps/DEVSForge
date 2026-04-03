package simulation

import (
	"bytes"
	"context"
	"devsforge/database"
	"devsforge/model"
	"encoding/json"
	"fmt"
	"gorm.io/datatypes"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

type SimulationLogsResponse struct {
	SimulationID  string       `json:"simulationId"`
	Status        string       `json:"status"`
	CreatedAt     int64        `json:"createdAt"`
	EndedAt       int64        `json:"endedAt,omitempty"`
	ErrorMessage  string       `json:"errorMessage,omitempty"`
	KafkaTopic    string       `json:"kafkaTopic"`
	Logs          []LogMessage `json:"logs"`
	TotalMessages *int         `json:"totalMessages,omitempty"`
}

type LogMessage struct {
	Timestamp int64       `json:"timestamp"`
	Sender    string      `json:"sender"`
	DevsType  string      `json:"devsType"`
	Data      interface{} `json:"data"`
}

// runRemoteCoordinatorAsync executes the coordinator asynchronously with polling
func (s *SimulationService) runRemoteCoordinatorAsync(simulatorAddr string, simulationID string, manifestFile string, kafkaAddr string, kafkaTopic string) {
	defer func() {
		if err := os.Remove(manifestFile); err != nil {
			slog.Warn("cannot delete temporary manifest file")
		}
	}()

	log := slog.With("simulationId", simulationID)
	log.Info("Starting remote coordinator (async mode)")

	manifestData, err := os.ReadFile(manifestFile)
	if err != nil {
		log.Error("Failed to read manifest file", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to read manifest: %v", err))
		return
	}

	body := map[string]interface{}{
		"json":  string(manifestData),
		"kafka": kafkaAddr,
		"topic": kafkaTopic,
	}
	jsonData, err := json.Marshal(body)
	if err != nil {
		log.Error("Failed to marshal request body", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to marshal request: %v", err))
		return
	}

	if !strings.HasPrefix(simulatorAddr, "http://") && !strings.HasPrefix(simulatorAddr, "https://") {
		simulatorAddr = "http://" + simulatorAddr
	}

	// POST /simulate-async
	url := simulatorAddr + "/simulate-async"

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

	// Start polling
	s.pollSimulationStatus(simulatorAddr, simulationID, log)
}

func (s *SimulationService) pollSimulationStatus(simulatorAddr string, simulationID string, log *slog.Logger) {
	if !strings.HasPrefix(simulatorAddr, "http://") && !strings.HasPrefix(simulatorAddr, "https://") {
		simulatorAddr = "http://" + simulatorAddr
	}

	pollURL := simulatorAddr + "/simulation/" + simulationID + "/logs"

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	pollInterval := 1 * time.Second
	timeout := 15 * time.Minute
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	lastOffset := 0
	db := database.DB

	for {
		select {
		case <-ctx.Done():
			log.Error("Polling timeout reached", "timeout", timeout)
			s.markSimulationFailedByID(simulationID, fmt.Sprintf("polling timeout after %v", timeout))
			return
		case <-ticker.C:
			// Fetch with pagination (100 messages per poll)
			req, err := http.NewRequest(http.MethodGet, pollURL, nil)
			if err != nil {
				log.Error("Failed to create poll request", "error", err)
				continue
			}

			q := req.URL.Query()
			q.Add("offset", fmt.Sprintf("%d", lastOffset))
			q.Add("limit", "100")
			req.URL.RawQuery = q.Encode()

			resp, err := client.Do(req)
			if err != nil {
				log.Error("Poll request failed", "error", err)
				continue
			}

			if resp.StatusCode != http.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				log.Warn("Poll returned non-OK status", "status", resp.StatusCode, "body", string(body))
				resp.Body.Close()
				continue
			}

			var logsResp SimulationLogsResponse
			if err := json.NewDecoder(resp.Body).Decode(&logsResp); err != nil {
				log.Error("Failed to decode poll response", "error", err)
				resp.Body.Close()
				continue
			}
			resp.Body.Close()

			// Save new messages
			if len(logsResp.Logs) > 0 {
				s.saveSimulationEvents(simulationID, logsResp.Logs, log)
				lastOffset += len(logsResp.Logs)
			}

			// Check if simulation is complete
			if logsResp.Status != "running" {
				log.Info("Simulation completed", "status", logsResp.Status, "totalMessages", logsResp.TotalMessages)

				now := time.Now()

				// Update simulation status in database
				if logsResp.Status == "completed" {
					result := db.Model(&model.Simulation{}).
						Where("id = ?", simulationID).
						Updates(map[string]interface{}{
							"status":       model.SimulationStatusCompleted,
							"completed_at": now,
						})
					if result.Error != nil {
						log.Error("Failed to update simulation status", "error", result.Error)
					}
				} else if logsResp.Status == "failed" || logsResp.Status == "error" {
					errMsg := "Simulation failed"
					if logsResp.ErrorMessage != "" {
						errMsg = logsResp.ErrorMessage
					}
					result := db.Model(&model.Simulation{}).
						Where("id = ?", simulationID).
						Updates(map[string]interface{}{
							"status":        model.SimulationStatusFailed,
							"error_message": errMsg,
							"completed_at":  now,
						})
					if result.Error != nil {
						log.Error("Failed to update simulation status", "error", result.Error)
					}
				}

				return
			}
		}
	}
}

func (s *SimulationService) saveSimulationEvents(simulationID string, logs []LogMessage, log *slog.Logger) {
	db := database.DB

	events := make([]model.SimulationEvent, 0, len(logs))
	for _, logMsg := range logs {
		// Skip non-DEVS messages
		if logMsg.DevsType == "" {
			continue
		}

		// Extract sender
		var sender *string
		if logMsg.Sender != "" {
			s := logMsg.Sender
			sender = &s
		}

		// Extract target and simulation time from Data
		var target *string
		var simulationTime *float64

		if dataMap, ok := logMsg.Data.(map[string]interface{}); ok {
			if targetVal, exists := dataMap["target"]; exists {
				if targetStr, ok := targetVal.(string); ok && targetStr != "" {
					target = &targetStr
				}
			}
			if timeVal, exists := dataMap["time"]; exists {
				if timeFloat, ok := timeVal.(float64); ok {
					simulationTime = &timeFloat
				}
			}
			// Also check for simulationTime
			if simTimeVal, exists := dataMap["simulationTime"]; exists {
				if simTimeFloat, ok := simTimeVal.(float64); ok {
					simulationTime = &simTimeFloat
				}
			}
		}

		// Serialize payload
		payloadJSON, err := json.Marshal(logMsg.Data)
		if err != nil {
			log.Warn("Failed to marshal log payload", "error", err)
			payloadJSON = []byte("{}")
		}

		event := model.SimulationEvent{
			SimulationID:   simulationID,
			SimulationTime: simulationTime,
			DevsType:       logMsg.DevsType,
			Sender:         sender,
			Target:         target,
			Payload:        datatypes.JSON(payloadJSON),
		}
		events = append(events, event)
	}

	if len(events) > 0 {
		if err := db.Create(&events).Error; err != nil {
			log.Error("Failed to save simulation events", "error", err, "count", len(events))
		} else {
			log.Info("Saved simulation events", "count", len(events))
		}
	}
}
