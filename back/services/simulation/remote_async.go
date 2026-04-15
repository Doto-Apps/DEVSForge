package simulation

import (
	"bytes"
	"context"
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

	"gorm.io/datatypes"
)

func (s *SimulationService) runRemoteCoordinatorAsync(simulationID string, manifestFile string) {
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

	cfg := config.Get()
	kafkaAddr := cfg.Kafka.Address
	kafkaTopic := generateTopicName(simulationID)

	body := SimulateRequestBody{
		JSON:       string(manifestData),
		KafkaAddr:  kafkaAddr,
		KafkaTopic: kafkaTopic,
	}
	jsonData, err := json.Marshal(body)
	if err != nil {
		log.Error("Failed to marshal request body", "error", err)
		s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to marshal request: %v", err))
		return
	}

	url := config.Get().Simulator.Addr + "/simulate-async"

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

	s.pollSimulationStatus(simulationID, log)
}

func (s *SimulationService) pollSimulationStatus(simulationID string, log *slog.Logger) {
	pollURL := fmt.Sprintf("%s/simulation/%s/logs", config.Get().Simulator.Addr, simulationID)

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
	emptyPollsCount := 0
	maxEmptyPolls := 3
	simulationEnded := false
	finalStatus := ""
	var finalErrorMessage string
	consecutiveErrors := 0
	maxConsecutiveErrors := 5
	db := database.DB

	for {
		select {
		case <-ctx.Done():
			log.Error("Polling timeout reached", "timeout", timeout)
			s.markSimulationFailedByID(simulationID, fmt.Sprintf("polling timeout after %v", timeout))
			return
		case <-ticker.C:
			req, err := http.NewRequest(http.MethodGet, pollURL, nil)
			if err != nil {
				log.Error("Failed to create poll request", "error", err)
				consecutiveErrors++
				if consecutiveErrors >= maxConsecutiveErrors {
					s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to create poll request: %v", err))
					return
				}
				continue
			}

			q := req.URL.Query()
			q.Add("offset", fmt.Sprintf("%d", lastOffset))
			q.Add("limit", "100")
			req.URL.RawQuery = q.Encode()

			resp, err := client.Do(req)
			if err != nil {
				log.Error("Poll request failed", "error", err)
				consecutiveErrors++
				if consecutiveErrors >= maxConsecutiveErrors {
					s.markSimulationFailedByID(simulationID, fmt.Sprintf("poll request failed: %v", err))
					return
				}
				continue
			}

			if resp.StatusCode != http.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				log.Warn("Poll returned non-OK status", "status", resp.StatusCode, "body", string(body))
				_ = resp.Body.Close()
				consecutiveErrors++
				if consecutiveErrors >= maxConsecutiveErrors {
					errMsg := fmt.Sprintf("simulator returned status %d", resp.StatusCode)
					if len(body) > 0 {
						errMsg = fmt.Sprintf("%s: %s", errMsg, string(body))
					}
					s.markSimulationFailedByID(simulationID, errMsg)
					return
				}
				continue
			}

			var logsResp SimulationLogsResponse
			if err := json.NewDecoder(resp.Body).Decode(&logsResp); err != nil {
				log.Error("Failed to decode poll response", "error", err)
				_ = resp.Body.Close()
				consecutiveErrors++
				if consecutiveErrors >= maxConsecutiveErrors {
					s.markSimulationFailedByID(simulationID, fmt.Sprintf("failed to decode poll response: %v", err))
					return
				}
				continue
			}
			_ = resp.Body.Close()

			consecutiveErrors = 0

			if len(logsResp.Logs) > 0 {
				s.saveSimulationEvents(simulationID, logsResp.Logs, log)
				lastOffset += len(logsResp.Logs)
				emptyPollsCount = 0
			} else {
				emptyPollsCount++
			}

			if !simulationEnded && logsResp.Status != "running" {
				simulationEnded = true
				finalStatus = logsResp.Status
				finalErrorMessage = logsResp.ErrorMessage
				log.Info("Simulation ended, draining remaining messages", "status", finalStatus)
			}

			if simulationEnded && emptyPollsCount >= maxEmptyPolls {
				log.Info("All messages collected", "totalMessages", lastOffset)

				now := time.Now()

				switch finalStatus {
				case "completed":
					result := db.Model(&model.Simulation{}).
						Where("id = ?", simulationID).
						Updates(map[string]any{
							"status":       model.SimulationStatusCompleted,
							"completed_at": now,
						})
					if result.Error != nil {
						log.Error("Failed to update simulation status", "error", result.Error)
					}
				case "failed", "error":
					errMsg := "Simulation failed"
					if finalErrorMessage != "" {
						errMsg = finalErrorMessage
					}
					result := db.Model(&model.Simulation{}).
						Where("id = ?", simulationID).
						Updates(map[string]any{
							"status":        model.SimulationStatusFailed,
							"error_message": errMsg,
							"completed_at":  now,
						})
					if result.Error != nil {
						log.Error("Failed to update simulation status", "error", result.Error)
					}
				}

				s.cleanSimulationLogs(simulationID, log)

				return
			}
		}
	}
}

func (s *SimulationService) saveSimulationEvents(simulationID string, logs []LogMessage, log *slog.Logger) {
	db := database.DB

	seen := make(map[string]bool)
	events := make([]model.SimulationEvent, 0, len(logs))
	for _, logMsg := range logs {
		if logMsg.DevsType == "" {
			continue
		}

		target := ""
		if dataMap, ok := logMsg.Data.(map[string]any); ok {
			if targetVal, exists := dataMap["target"]; exists {
				if targetStr, ok := targetVal.(string); ok {
					target = targetStr
				}
			}
		}
		dedupKey := fmt.Sprintf("%s:%s:%s:%d:%s", logMsg.DevsType, target, logMsg.Sender, logMsg.Timestamp, logMsg.Data)
		if seen[dedupKey] {
			log.Debug("Skipping duplicate message", "devsType", logMsg.DevsType, "target", target, "sender", logMsg.Sender, "timestamp", logMsg.Timestamp, "data", logMsg.Data)
			continue
		}
		seen[dedupKey] = true

		var sender *string
		if logMsg.Sender != "" {
			s := logMsg.Sender
			sender = &s
		}

		var targetPtr *string
		var simulationTime *float64

		if dataMap, ok := logMsg.Data.(map[string]any); ok {
			if targetVal, exists := dataMap["target"]; exists {
				if targetStr, ok := targetVal.(string); ok && targetStr != "" {
					targetPtr = &targetStr
				}
			}
			if timeVal, exists := dataMap["time"]; exists {
				if timeFloat, ok := timeVal.(float64); ok {
					simulationTime = &timeFloat
				}
			}
			if simTimeVal, exists := dataMap["simulationTime"]; exists {
				if simTimeFloat, ok := simTimeVal.(float64); ok {
					simulationTime = &simTimeFloat
				}
			}
		}

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
			Target:         targetPtr,
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

func (s *SimulationService) cleanSimulationLogs(simulationID string, log *slog.Logger) {
	cleanURL := fmt.Sprintf("%s/simulation/%s/clean", config.Get().Simulator.Addr, simulationID)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest(http.MethodDelete, cleanURL, nil)
	if err != nil {
		log.Warn("Failed to create clean request", "error", err)
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Warn("Failed to clean simulation logs", "error", err)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Warn("cannot close response body")
		}
	}()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Warn("Clean returned non-OK status", "status", resp.StatusCode, "body", string(body))
	} else {
		log.Info("Simulation logs cleaned successfully")
	}
}
