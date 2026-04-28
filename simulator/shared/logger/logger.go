// Package logger utility to log into a file
package logger

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"gopkg.in/natefinch/lumberjack.v2"
)

// Config holds the logger configuration
type Config struct {
	LogDir       string // Base directory for logs (env LOG_DIR or default "logs")
	SimulationID string // Unique simulation identifier
	MaxSize      int    // Maximum size in MB before rotation (default: 10)
	MaxBackups   int    // Number of backup files to retain (default: 10)
	Compress     bool   // Enable gzip compression for rotated files (default: true)
	Level        string // Minimum log level: DEBUG, INFO, WARN, ERROR (default: DEBUG)
	DirMode      int    // Directory permissions in octal (default: 0777 for Docker compatibility)
	LogMode      string // Log output mode: "json", "console", or "all" (default: "all")
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
	// Parse log mode
	logMode := strings.ToLower(cfg.LogMode)
	if logMode == "" {
		logMode = "all"
	}

	if cfg.SimulationID == "" {
		return nil, fmt.Errorf("simulationID is required")
	}

	// Set defaults
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

	var fileWriter *lumberjack.Logger
	if logMode != "console" {
		// Create log directory with proper permissions
		logDir := filepath.Join(cfg.LogDir, cfg.SimulationID)
		if err := os.MkdirAll(logDir, os.FileMode(cfg.DirMode)); err != nil {
			return nil, fmt.Errorf("failed to create log directory: %w", err)
		}

		// Determine log filename
		var logFilename string
		if processType == "runner" && processID != "" {
			logFilename = fmt.Sprintf("runner-%s.log", sanitizePathToken(processID))
		} else {
			logFilename = fmt.Sprintf("%s.log", processType)
		}

		logPath := filepath.Join(logDir, logFilename)
		if f, err := os.Create(logPath); err != nil {
			return nil, fmt.Errorf("cannot create log file: %w", err)
		} else {
			if err = f.Chmod(os.FileMode(cfg.DirMode)); err != nil {
				return nil, fmt.Errorf("cannot set log file permissions: %w", err)
			}
		}

		// Create lumberjack writer for file logging
		fileWriter = &lumberjack.Logger{
			Filename:   logPath,
			MaxSize:    cfg.MaxSize,
			MaxBackups: cfg.MaxBackups,
			Compress:   cfg.Compress,
			LocalTime:  true,
		}

	}

	// Parse log level
	level := parseLevel(cfg.Level)

	// Create custom attributes
	attrs := []any{
		slog.String("simulation_id", cfg.SimulationID),
		slog.String("process_type", processType),
	}
	if processID != "" {
		attrs = append(attrs, slog.String("process_id", processID))
	}

	// Create handler based on log mode
	var handler slog.Handler
	switch logMode {
	case "json":
		// File only (JSON format)
		handler = slog.NewJSONHandler(fileWriter, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
			ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
				return a
			},
		})
	case "console":
		// Console only (Text format)
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
		})
	case "all":
		fallthrough
	default:
		// Both file (JSON) and console (Text)
		handler = NewDualHandler(
			// File handler: JSON format with rotation
			slog.NewJSONHandler(fileWriter, &slog.HandlerOptions{
				Level:     level,
				AddSource: true,
				ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
					return a
				},
			}),
			// Console handler: Text format
			slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
				Level:     level,
				AddSource: false,
			}),
		)
	}

	// Create logger with custom attributes
	logger := slog.New(handler).With(attrs...)

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
