package logstore

import (
	"bufio"
	"devsforge-shared/kafka"
	shared_sim "devsforge-shared/simulation"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

const (
	filePermissions = 0o777
)

type fileLogStore struct {
	logDir string
}

func (f *fileLogStore) GetLogger(simulationID string) (*slog.Logger, error) {
	dir := filepath.Join(f.logDir, simulationID)
	if err := os.MkdirAll(dir, filePermissions); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	logPath := filepath.Join(dir, "all.log")
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, filePermissions)
	if err != nil {
		return nil, fmt.Errorf("failed to create log file: %w", err)
	}

	handler := slog.NewJSONHandler(file, &slog.HandlerOptions{
		Level:     slog.LevelDebug,
		AddSource: false,
	})

	return slog.New(handler), nil
}

func (f *fileLogStore) GetAll(simulationID string) ([]shared_sim.LogMessage, error) {
	return f.GetAllSince(simulationID, 0)
}

func (f *fileLogStore) GetAllSince(simulationID string, since int64) ([]shared_sim.LogMessage, error) {
	dir := filepath.Join(f.logDir, simulationID)
	logPath := filepath.Join(dir, "all.log")

	// Check if all.log exists
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		// Fallback: read from simulation.json
		status, statusErr := f.GetStatus(simulationID)
		if statusErr != nil {
			return nil, fmt.Errorf("no log data found for simulation %s: %w", simulationID, statusErr)
		}
		if status.Messages == nil {
			return nil, fmt.Errorf("no log data found for simulation %s", simulationID)
		}
		// Filter messages by timestamp if since > 0
		if since == 0 {
			return status.Messages, nil
		}
		filtered := make([]shared_sim.LogMessage, 0)
		for _, msg := range status.Messages {
			if msg.Timestamp >= since {
				filtered = append(filtered, msg)
			}
		}
		return filtered, nil
	}

	file, err := os.Open(logPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}
	defer func() {
		if err = file.Close(); err != nil {
			return
		}
	}()

	status, _ := f.GetStatus(simulationID)
	createdAt := int64(0)
	if status != nil {
		createdAt = status.CreatedAt
	}

	messages := []shared_sim.LogMessage{}
	seen := make(map[string]bool)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var msg map[string]any
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		if msg["msg"] != "kafka_message" || msg["data"] == nil {
			continue
		}

		var timestamp int64

		if timeStr, ok := msg["time"].(string); ok {
			if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
				slog.Debug("Time", "str", timeStr)
				timestamp = t.UnixMicro() - createdAt
			} else {
				continue
			}
		} else {
			continue
		}

		if timestamp < since {
			continue
		}

		var kafkaMsg any
		kafkaMsg, err := kafka.UnmarshalKafkaMessage([]byte(msg["data"].(string)))

		if err != nil {
			slog.Warn("cannot unparse data kafka_message", "error", err, "data", msg["data"])
			continue
		}

		if typedKafkaMsg, ok := kafkaMsg.(kafka.CommonKafkaMessage); ok {
			// Create normalized deduplication key
			dedupKey := fmt.Sprintf("%d:%s:%s:%s:%s", timestamp, typedKafkaMsg.MessageType, typedKafkaMsg.ReceiverID, typedKafkaMsg.SenderID, msg["data"].(string))
			if seen[dedupKey] {
				continue
			}
			seen[dedupKey] = true

			messages = append(messages, shared_sim.LogMessage{
				Timestamp:   timestamp,
				SenderID:    typedKafkaMsg.SenderID,
				MessageType: string(typedKafkaMsg.MessageType),
				Data:        typedKafkaMsg,
			})
		}

	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read log file: %w", err)
	}

	return messages, nil
}

func (f *fileLogStore) Delete(simulationID string) error {
	dir := filepath.Join(f.logDir, simulationID)
	return os.RemoveAll(dir)
}

func (f *fileLogStore) DeleteAll() error {
	entries, err := os.ReadDir(f.logDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read log directory: %w", err)
	}

	deleted := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if err := os.RemoveAll(filepath.Join(f.logDir, entry.Name())); err != nil {
			return err
		}
		deleted++
	}

	return nil
}

func (f *fileLogStore) SetStatus(simulationID string, status SimulationStatus) error {
	dir := filepath.Join(f.logDir, simulationID)
	slog.Info("Prepare wrote in simulation.json", "status", status)
	if err := os.MkdirAll(dir, filePermissions); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	statusPath := filepath.Join(dir, "simulation.json")
	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal status: %w", err)
	}

	if err := os.WriteFile(statusPath, data, filePermissions); err != nil {
		return fmt.Errorf("failed to write status file: %w", err)
	}

	slog.Info("Wrote in simulation.json", "status", status)

	return nil
}

func (f *fileLogStore) GetStatus(simulationID string) (*SimulationStatus, error) {
	dir := filepath.Join(f.logDir, simulationID)
	statusPath := filepath.Join(dir, "simulation.json")

	data, err := os.ReadFile(statusPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read status file: %w", err)
	}

	var status SimulationStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, fmt.Errorf("failed to unmarshal status: %w", err)
	}

	return &status, nil
}

func (f *fileLogStore) DeleteAllLog(simulationID string) error {
	return nil
	//
	// WARN: Actually this can cause inifnite running state
	// dir := filepath.Join(f.logDir, simulationID)
	// logPath := filepath.Join(dir, "all.log")

	// if err := os.Remove(logPath); err != nil {
	// 	if !os.IsNotExist(err) {
	// 		return err
	// 	}
	// }

	// return nil
}

func (f *fileLogStore) GetPaginated(simulationID string, offset int, limit int) ([]shared_sim.LogMessage, int, error) {
	allMessages, err := f.GetAll(simulationID)
	if err != nil {
		return nil, 0, err
	}

	total := len(allMessages)

	if offset >= total {
		return []shared_sim.LogMessage{}, total, nil
	}

	end := min(offset+limit, total)

	return allMessages[offset:end], total, nil
}

func (f *fileLogStore) GetLogDir(simulationID string) string {
	return f.logDir
}
