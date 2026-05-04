package generators

import (
	"devsforge-runner/internal/config"
	"log/slog"
	"os/exec"
	"strings"

	"google.golang.org/grpc"
)

// WrapperInfo contains everything needed for a wrapper (independent of LaunchSim)
type WrapperInfo struct {
	Cfg      *config.RunnerConfig
	RootDir  string
	ModelDir string
	GRPCConn *grpc.ClientConn
	Cmd      *exec.Cmd
}

// Cleanup stops the process, closes gRPC connection, and cleans up temp directory
func (w *WrapperInfo) Cleanup() error {
	// 1. Close gRPC connection
	if w.GRPCConn != nil {
		slog.Info("Closing gRPC connection")
		if err := w.GRPCConn.Close(); err != nil {
			slog.Debug("Failed to close gRPC connection", "error", err)
		}
		w.GRPCConn = nil
	}

	// 2. Stop the process
	if w.Cmd != nil && w.Cmd.Process != nil {
		pid := w.Cmd.Process.Pid
		slog.Info("Stopping model process", "pid", pid)
		slog.Info("Toto", "pid", pid)

		// Kill the process (it's a single binary now, not go run)
		if err := w.Cmd.Process.Kill(); err != nil {
			slog.Warn("Failed to kill process", "error", err)
		}

		slog.Info("Process stopped", "pid", pid)
		w.Cmd = nil
	}

	return nil
}

// CompactTailLog returns a summarized tail of stderr/stdout for error diagnostics
func CompactTailLog(stderr string, stdout string, maxLines int, maxChars int) string {
	trimmedErr := SummarizeLog(stderr, maxLines, maxChars)
	if trimmedErr != "" {
		return "stderr tail: " + trimmedErr
	}
	trimmedOut := SummarizeLog(stdout, maxLines, maxChars)
	if trimmedOut != "" {
		return "stdout tail: " + trimmedOut
	}
	return ""
}

// SummarizeLog trims and truncates log output for readability
func SummarizeLog(raw string, maxLines int, maxChars int) string {
	if maxLines <= 0 {
		maxLines = 12
	}
	if maxChars <= 0 {
		maxChars = 1200
	}

	s := strings.ReplaceAll(raw, "\r\n", "\n")
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	lines := strings.Split(s, "\n")
	if len(lines) > maxLines {
		lines = lines[len(lines)-maxLines:]
	}

	out := strings.Join(lines, " || ")
	out = strings.TrimSpace(out)
	if len(out) > maxChars {
		out = out[len(out)-maxChars:]
		out = "... " + out
	}
	return out
}
