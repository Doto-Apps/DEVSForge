package generators

import (
	"context"
	devspb "devsforge-shared/proto"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

func PythonCommand() string {
	if runtime.GOOS == "windows" {
		return "python"
	}
	return "python3"
}

// LaunchModelProcess captures diagnostics and owns startup cleanup for adapters
// whose project is already built. The process and connection remain owned by w.
func LaunchModelProcess(w *WrapperInfo, cmd *exec.Cmd, label string) error {
	if w.Cfg == nil || w.Cfg.Model == nil {
		return fmt.Errorf("%s: missing model configuration", label)
	}
	log, err := os.Create(filepath.Join(w.ModelDir, "wrapper.log"))
	if err != nil {
		return err
	}
	cmd.Dir = w.ModelDir
	cmd.Env = append(os.Environ(), "GRPC_PORT="+strconv.Itoa(w.Cfg.GRPC.Port))
	cmd.Stdout = io.MultiWriter(os.Stdout, log)
	cmd.Stderr = io.MultiWriter(os.Stderr, log)
	if err = cmd.Start(); err != nil {
		_ = log.Close()
		return fmt.Errorf("%s launch failed: %w", label, err)
	}
	w.Cmd = cmd
	exited := make(chan error, 1)
	go func() { err := cmd.Wait(); _ = log.Close(); exited <- err }()
	success := false
	defer func() {
		if !success {
			_ = w.Cleanup()
		}
	}()
	conn, err := grpc.NewClient(net.JoinHostPort(w.Cfg.GRPC.Host, strconv.Itoa(w.Cfg.GRPC.Port)), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return err
	}
	w.GRPCConn = conn
	ready, stop := context.WithTimeout(context.Background(), 30*time.Second)
	defer stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ready.Done():
			return fmt.Errorf("%s gRPC startup timed out: %w", label, ready.Err())
		case err := <-exited:
			data, _ := os.ReadFile(log.Name())
			return fmt.Errorf("%s exited before startup (%v): %s", label, err, SummarizeLog(string(data), 20, 3000))
		case <-ticker.C:
			probe, end := context.WithTimeout(ready, 500*time.Millisecond)
			_, err := devspb.NewAtomicModelServiceClient(conn).Initialize(probe, &emptypb.Empty{})
			end()
			if err == nil {
				success = true
				return nil
			}
			if status.Code(err) != codes.Unavailable && status.Code(err) != codes.DeadlineExceeded {
				return fmt.Errorf("%s model initialization failed: %w", label, err)
			}
		}
	}
}
