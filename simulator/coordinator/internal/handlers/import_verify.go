//go:build !windows

package handlers

import (
	"context"
	"crypto/subtle"
	shared "devsforge-shared"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	kafkaclient "github.com/segmentio/kafka-go"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
)

var verificationSlots = make(chan struct{}, 2)

// tailWriter bounds diagnostics even when a model prints indefinitely.
type tailWriter struct {
	mu   sync.Mutex
	data []byte
}

func (w *tailWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	n := len(p)
	w.data = append(w.data, p...)
	if len(w.data) > 16000 {
		w.data = w.data[len(w.data)-16000:]
	}
	return n, nil
}

// Verification uses the same coordinator/runner in a separate process group.
// A wall-clock deadline kills the entire group, including Java/Python children.
func handleVerifyImport(w http.ResponseWriter, r *http.Request) error {
	token := os.Getenv("IMPORT_INTERNAL_TOKEN")
	if token == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+token)) != 1 {
		w.WriteHeader(401)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "Unauthorized"})
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return nil
	}
	// The daemon's ordinary 30s write timeout is shorter than a Java build.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(100 * time.Second)); err != nil {
		return err
	}
	select {
	case verificationSlots <- struct{}{}:
		defer func() { <-verificationSlots }()
	default:
		w.WriteHeader(429)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "Verification service busy"})
	}
	var input struct {
		Manifest shared.RunnableManifest `json:"manifest"`
		Kafka    string                  `json:"kafka"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 20<<20)).Decode(&input); err != nil || len(input.Manifest.Models) == 0 || len(input.Manifest.Models) > 100 || math.IsNaN(input.Manifest.MaxTime) || input.Manifest.MaxTime <= 0 || input.Manifest.MaxTime > 1000000 {
		w.WriteHeader(400)
		return json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid verification manifest (maximum 100 atomic instances)"})
	}
	input.Manifest.SimulationID = uuid.NewString()
	id := input.Manifest.SimulationID
	file, err := os.CreateTemp("", "import-verify-*.json")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(file.Name()) }()
	err = json.NewEncoder(file).Encode(input.Manifest)
	_ = file.Close()
	if err != nil {
		return err
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, executable, "-file", file.Name(), "-kafka", input.Kafka, "-topic", "import-"+id)
	workspace, err := os.MkdirTemp("", "import-runtime-")
	if err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(workspace) }()
	// Credentials are never propagated into executed model source.
	for _, env := range os.Environ() {
		key, _, _ := strings.Cut(env, "=")
		if key == "PATH" || key == "HOME" || key == "JAVA_HOME" || key == "LD_LIBRARY_PATH" || strings.HasPrefix(key, "GO") || strings.HasPrefix(key, "INTEGRATIONS_") || key == "SHARED_GO_DIR" || key == "PATHS_RUNNER_CMD" || strings.HasPrefix(key, "LOG_") {
			cmd.Env = append(cmd.Env, env)
		}
	}
	cmd.Env = append(cmd.Env, "PATHS_SIM_ROOT="+workspace, "TMPDIR="+workspace)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process != nil {
			return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		return nil
	}
	cmd.WaitDelay = 2 * time.Second
	output := &tailWriter{}
	cmd.Stdout, cmd.Stderr = output, output
	started := time.Now()
	err = cmd.Run()
	// Also reap descendants left behind after an early coordinator exit.
	if cmd.Process != nil {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	result := map[string]any{"status": "completed", "simulationId": id, "durationMs": time.Since(started).Milliseconds(), "logs": string(output.data)}
	if err != nil {
		result["status"] = "failed"
		result["error"] = err.Error()
	}
	if ctx.Err() != nil {
		result["status"] = "timeout"
		result["error"] = "Verification stopped after its 90-second deadline or cancellation"
	}
	if status, statusErr := getLogStore().GetStatus(id); statusErr == nil {
		if status.ErrorMessage != "" {
			result["status"] = "failed"
			result["error"] = status.ErrorMessage
		}
		result["simulationStatus"] = status.Status
	}
	// The bounded report is retained by the import session; remove transient log files.
	_ = getLogStore().Delete(id)
	cleanupVerificationTopic(input.Kafka, "import-"+id)
	return json.NewEncoder(w).Encode(result)
}

func cleanupVerificationTopic(broker, topic string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	dialer := kafkaclient.Dialer{Timeout: time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", broker)
	if err != nil {
		return
	}
	defer func() { _ = conn.Close() }()
	_ = conn.SetDeadline(time.Now().Add(time.Second))
	controller, err := conn.Controller()
	if err != nil {
		return
	}
	control, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", controller.Host, controller.Port))
	if err != nil {
		return
	}
	defer func() { _ = control.Close() }()
	_ = control.SetDeadline(time.Now().Add(time.Second))
	_ = control.DeleteTopics(topic)
}
