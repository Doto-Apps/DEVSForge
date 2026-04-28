// Package logger utility to log into a file
package logger

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// Config holds the logger configuration
type Config struct {
	LogDir       string
	SimulationID string
	MaxSize      int
	MaxBackups   int
	Compress     bool
	Level        string
	DirMode      int
	LogMode      string
}

// DefaultConfig returns a Config with default values
func DefaultConfig(simulationID string) Config {
	cfg := Get()
	return Config{
		LogDir:       cfg.Log.Dir,
		SimulationID: simulationID,
		MaxSize:      10,
		MaxBackups:   10,
		Compress:     true,
		Level:        "DEBUG",
		DirMode:      0o777,
		LogMode:      cfg.Log.Mode,
	}
}

// InitLogger creates and configures a logger for a specific process
// processType: "coordinator" or "runner"
// processID: model ID for runners, empty for coordinator
func InitLogger(cfg Config, processType, processID string) (*slog.Logger, error) {
	logMode := strings.ToLower(cfg.LogMode)
	if logMode == "" {
		logMode = "all"
	}

	if cfg.SimulationID == "" {
		return nil, fmt.Errorf("simulationID is required")
	}

	if cfg.MaxSize <= 0 {
		cfg.MaxSize = 10
	}
	if cfg.MaxBackups < 0 {
		cfg.MaxBackups = 10
	}
	if cfg.Level == "" {
		cfg.Level = "DEBUG"
	}
	if cfg.DirMode == 0 {
		cfg.DirMode = 0o777
	}

	var fileWriter *os.File
	if logMode != "console" {
		logDir := filepath.Join(cfg.LogDir, cfg.SimulationID)
		if err := os.MkdirAll(logDir, os.FileMode(cfg.DirMode)); err != nil {
			return nil, fmt.Errorf("failed to create log directory: %w", err)
		}

		var logFilename string
		if processType == "runner" && processID != "" {
			logFilename = fmt.Sprintf("runner-%s.log", sanitizePathToken(processID))
		} else {
			logFilename = fmt.Sprintf("%s.log", processType)
		}

		logPath := filepath.Join(logDir, logFilename)
		// Just try to clean if exists but dont care if error happens
		_ = os.Remove(logPath)
		if f, err := os.Create(logPath); err != nil {
			return nil, fmt.Errorf("cannot create log file: %w", err)
		} else {
			if err = f.Chmod(os.FileMode(cfg.DirMode)); err != nil {
				return nil, fmt.Errorf("cannot set log file permissions: %w", err)
			}
			fileWriter = f
		}
	}

	level := parseLevel(cfg.Level)

	var outputWriter io.Writer = os.Stdout
	switch processType {
	case "coordinator":
		outputWriter = NewColorWriter(os.Stdout, "36", processType)
	case "runner":
		outputWriter = NewColorWriter(os.Stdout, "32", processID)
	}

	var handler slog.Handler
	switch logMode {
	case "json":
		handler = slog.NewJSONHandler(fileWriter, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
			ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
				return a
			},
		})
	case "console":
		// Console only (Text format)
		handler = slog.NewTextHandler(outputWriter, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
		})
	case "all":
		fallthrough
	default:
		handler = NewDualHandler(
			slog.NewJSONHandler(fileWriter, &slog.HandlerOptions{
				Level:     level,
				AddSource: true,
				ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
					return a
				},
			}),
			slog.NewTextHandler(outputWriter, &slog.HandlerOptions{
				Level:     level,
				AddSource: false,
			}),
		)
	}

	logger := slog.New(handler)

	return logger, nil
}

// parseLevel converts a string level to slog.Level
func parseLevel(level string) slog.Level {
	switch strings.ToUpper(level) {
	case "DEBUG":
		return slog.LevelDebug
	case "INFO":
		return slog.LevelInfo
	case "WARN", "WARNING":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelDebug
	}
}

// GetLogFilePath returns the full path to the log file for a given process
func GetLogFilePath(cfg Config, processType, processID string) string {
	logDir := filepath.Join(cfg.LogDir, cfg.SimulationID)

	var logFilename string
	if processType == "runner" && processID != "" {
		logFilename = fmt.Sprintf("runner-%s.log", sanitizePathToken(processID))
	} else {
		logFilename = fmt.Sprintf("%s.log", processType)
	}

	return filepath.Join(logDir, logFilename)
}

func sanitizePathToken(raw string) string {
	if raw == "" {
		return "runner"
	}

	var b strings.Builder
	lastUnderscore := false
	for _, r := range raw {
		isAlphaNum := r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9'
		if isAlphaNum || r == '-' || r == '_' {
			b.WriteRune(r)
			lastUnderscore = false
			continue
		}

		if !lastUnderscore {
			b.WriteRune('_')
			lastUnderscore = true
		}
	}

	sanitized := strings.Trim(b.String(), "_")
	if sanitized == "" {
		return "runner"
	}

	return sanitized
}

// SourceLocation captures the caller's source location
func SourceLocation(skip int) slog.Attr {
	_, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return slog.Attr{}
	}

	// Extract just the filename and line for brevity
	if idx := strings.LastIndex(file, "/"); idx >= 0 {
		file = file[idx+1:]
	}

	return slog.Group("caller",
		slog.String("file", file),
		slog.Int("line", line),
	)
}
