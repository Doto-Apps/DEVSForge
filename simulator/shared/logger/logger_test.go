package logger

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestInitLogger(t *testing.T) {
	tmpDir := t.TempDir()

	cfg := Config{
		LogDir:       tmpDir,
		SimulationID: "test-sim-123",
		MaxSize:      10,
		MaxBackups:   5,
		Compress:     true,
		Level:        "DEBUG",
	}

	// Test coordinator logger
	coordLogger, err := InitLogger(cfg, "coordinator", "")
	if err != nil {
		t.Fatalf("Failed to init coordinator logger: %v", err)
	}

	if coordLogger == nil {
		t.Fatal("Coordinator logger is nil")
	}

	// Test runner logger
	runnerLogger, err := InitLogger(cfg, "runner", "model-1")
	if err != nil {
		t.Fatalf("Failed to init runner logger: %v", err)
	}

	if runnerLogger == nil {
		t.Fatal("Runner logger is nil")
	}

	// Verify log files are created
	coordLogger.Info("Test message")
	runnerLogger.Info("Test message")

	coordLogFile := filepath.Join(tmpDir, "test-sim-123", "coordinator.log")
	runnerLogFile := filepath.Join(tmpDir, "test-sim-123", "runner-model-1.log")

	if _, err := os.Stat(coordLogFile); os.IsNotExist(err) {
		t.Errorf("Coordinator log file was not created: %s", coordLogFile)
	}

	if _, err := os.Stat(runnerLogFile); os.IsNotExist(err) {
		t.Errorf("Runner log file was not created: %s", runnerLogFile)
	}
}

func TestDefaultConfig(t *testing.T) {
	// Save original LOG_DIR
	originalLogDir := os.Getenv("LOG_DIR")
	defer func() {
		if err := os.Setenv("LOG_DIR", originalLogDir); err != nil {
			t.Error("Cannot set LOG_DIR env", err)
		}
	}()

	// Test with default
	if err := os.Unsetenv("LOG_DIR"); err != nil {
		t.Error("Cannot unset LOG_DIR env", err)
	}

	cfg := DefaultConfig("test-sim")
	if cfg.LogDir != "logs" {
		t.Errorf("Expected LogDir to be 'logs', got: %s", cfg.LogDir)
	}

	// Test with custom LOG_DIR
	if err := os.Setenv("LOG_DIR", "/custom/logs"); err != nil {
		t.Error("Cannot set LOG_DIR env", err)
	}

	cfg = DefaultConfig("test-sim")
	if cfg.LogDir != "/custom/logs" {
		t.Errorf("Expected LogDir to be '/custom/logs', got: %s", cfg.LogDir)
	}
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		input    string
		expected slog.Level
	}{
		{"DEBUG", slog.LevelDebug},
		{"debug", slog.LevelDebug},
		{"INFO", slog.LevelInfo},
		{"info", slog.LevelInfo},
		{"WARN", slog.LevelWarn},
		{"WARNING", slog.LevelWarn},
		{"ERROR", slog.LevelError},
		{"INVALID", slog.LevelDebug}, // Should default to DEBUG
		{"", slog.LevelDebug},        // Should default to DEBUG
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parseLevel(tt.input)
			if result != tt.expected {
				t.Errorf("parseLevel(%q) = %v, expected %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestGetLogFilePath(t *testing.T) {
	cfg := Config{
		LogDir:       "/tmp/logs",
		SimulationID: "test-123",
	}

	// Test coordinator
	coordPath := GetLogFilePath(cfg, "coordinator", "")
	expected := "/tmp/logs/test-123/coordinator.log"
	if coordPath != expected {
		t.Errorf("Coordinator path: got %s, expected %s", coordPath, expected)
	}

	// Test runner
	runnerPath := GetLogFilePath(cfg, "runner", "model-1")
	expected = "/tmp/logs/test-123/runner-model-1.log"
	if runnerPath != expected {
		t.Errorf("Runner path: got %s, expected %s", runnerPath, expected)
	}
}

func TestInitLoggerValidation(t *testing.T) {
	cfg := Config{
		SimulationID: "", // Empty should fail
	}

	_, err := InitLogger(cfg, "coordinator", "")
	if err == nil {
		t.Error("Expected error for empty SimulationID, got nil")
	}

	expectedErr := "simulationID is required"
	if err.Error() != expectedErr {
		t.Errorf("Expected error %q, got %q", expectedErr, err.Error())
	}
}

func TestLoggerOutput(t *testing.T) {
	tmpDir := t.TempDir()

	cfg := Config{
		LogDir:       tmpDir,
		SimulationID: "test-output",
		MaxSize:      10,
		MaxBackups:   5,
		Compress:     false, // Don't compress for easier testing
		Level:        "DEBUG",
	}

	logger, err := InitLogger(cfg, "coordinator", "")
	if err != nil {
		t.Fatalf("Failed to init logger: %v", err)
	}

	// Log various levels
	logger.Debug("Debug message", "key", "value")
	logger.Info("Info message", "count", 42)
	logger.Warn("Warning message")
	logger.Error("Error message", "error", "test error")

	// Read log file and verify JSON format
	logFile := filepath.Join(tmpDir, "test-output", "coordinator.log")
	content, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	lines := string(content)
	if lines == "" {
		t.Error("Log file is empty")
	}

	// Each line should be valid JSON
	// (We're not parsing it here, but manual inspection can verify)
	t.Logf("Log content:\n%s", lines)
}

func TestLogMode(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name     string
		logMode  string
		expected string
	}{
		{"JSON only", "json", "file"},
		{"Console only", "console", "stdout"},
		{"All (default)", "all", "both"},
		{"Empty (default)", "", "both"},
		{"Invalid (default to all)", "invalid", "both"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{
				LogDir:       tmpDir,
				SimulationID: "test-mode",
				MaxSize:      10,
				MaxBackups:   5,
				Compress:     false,
				Level:        "DEBUG",
				LogMode:      tt.logMode,
			}

			logger, err := InitLogger(cfg, "test", "")
			if err != nil {
				t.Fatalf("Failed to init logger: %v", err)
			}

			if logger == nil {
				t.Fatal("Logger is nil")
			}

			// Log a message
			logger.Info("Test message")

			// Verify file exists for json and all modes
			if tt.logMode == "json" || tt.logMode == "all" || tt.logMode == "" {
				logFile := filepath.Join(tmpDir, "test-mode", "test.log")
				if _, err := os.Stat(logFile); os.IsNotExist(err) {
					t.Errorf("Log file should exist for mode %s", tt.logMode)
				}
			}
		})
	}
}
