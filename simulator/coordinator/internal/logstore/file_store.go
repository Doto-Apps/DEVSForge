package logstore

import (
	"bufio"
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

func (f *fileLogStore) GetAll(simulationID string) ([]LogMessage, error) {
	return f.GetAllSince(simulationID, 0)
}

func (f *fileLogStore) GetAllSince(simulationID string, since int64) ([]LogMessage, error) {
	dir := filepath.Join(f.logDir, simulationID)
	logPath := filepath.Join(dir, "all.log")

	file, err := os.Open(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []LogMessage{}, nil
		}
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

	messages := []LogMessage{}
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

		if msg["msg"] != "kafka_message" {
			continue
		}

		var timestamp int64
		if timeStr, ok := msg["time"].(string); ok {
			if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
				timestamp = t.Unix() - createdAt
			} else {
				continue
			}
		} else {
			continue
		}

		if timestamp < since {
			continue
		}

		sender, _ := msg["sender"].(string)
		devsType, _ := msg["devsType"].(string)
		data := msg["data"]

		messages = append(messages, LogMessage{
			Timestamp: timestamp,
			Sender:    sender,
			DevsType:  devsType,
			Data:      data,
		})
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
	dir := filepath.Join(f.logDir, simulationID)
	logPath := filepath.Join(dir, "all.log")
	return os.Remove(logPath)
}

func (f *fileLogStore) GetPaginated(simulationID string, offset int, limit int) ([]LogMessage, int, error) {
	allMessages, err := f.GetAll(simulationID)
	if err != nil {
		return nil, 0, err
	}

	total := len(allMessages)

	if offset >= total {
		return []LogMessage{}, total, nil
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return allMessages[offset:end], total, nil
}
