package ms4mejava

import (
	"context"
	"devsforge-runner/internal/generators"
	shared "devsforge-shared"
	devspb "devsforge-shared/proto"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

func PrepareSources(w *generators.WrapperInfo, _ shared.RunnableManifest) error {
	if w.Cfg == nil || w.Cfg.Model == nil {
		return fmt.Errorf("MS4 Me: missing model configuration")
	}
	file := filepath.Join(w.ModelDir, "src", "model", "java", SourcePath(w.Cfg.Model.Code, w.Cfg.Model.Name)+".java")
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		return err
	}
	return os.WriteFile(file, []byte(w.Cfg.Model.Code), 0600)
}

func PrepareWrapper(w *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	if err := PrepareSources(w, manifest); err != nil {
		return err
	}
	// Images build the runtime once. Native development can build the same project
	// in this private workspace without modifying the versioned integration.
	runtime := os.Getenv("MS4ME_RUNTIME_JAR")
	if runtime == "" {
		runtime = filepath.Join(w.ModelDir, "target", "runtime", "ms4me-runtime.jar")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		build := exec.CommandContext(ctx, "./mvnw", "-B", "package", "-DskipTests", "-Duser.sources=src/runtime-only", "-q")
		build.Dir = w.ModelDir
		if output, err := build.CombinedOutput(); err != nil {
			return fmt.Errorf("MS4 Me runtime build failed: %w: %s", err, generators.SummarizeLog(string(output), 20, 3000))
		}
	}
	runtime, err := filepath.Abs(runtime)
	if err != nil {
		return err
	}
	if _, err = os.Stat(runtime); err != nil {
		return fmt.Errorf("MS4 Me runtime unavailable: %w", err)
	}
	classes := filepath.Join(w.ModelDir, "classes")
	if err = os.MkdirAll(classes, 0700); err != nil {
		return err
	}
	source := SourcePath(w.Cfg.Model.Code, w.Cfg.Model.Name)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	compile := exec.CommandContext(ctx, generators.JavaTool("javac"), "--release", "21", "-encoding", "UTF-8", "-cp", runtime, "-d", classes, filepath.Join(w.ModelDir, "src", "model", "java", source+".java"))
	if output, err := compile.CombinedOutput(); err != nil {
		return fmt.Errorf("MS4 Me model compilation failed: %w: %s", err, generators.SummarizeLog(string(output), 20, 3000))
	}
	modelJSON, err := json.Marshal(w.Cfg.Model)
	if err != nil {
		return err
	}
	log, err := os.Create(filepath.Join(w.ModelDir, "wrapper.log"))
	if err != nil {
		return err
	}
	className := strings.ReplaceAll(source, string(filepath.Separator), ".")
	cmd := exec.Command(generators.JavaTool("java"), "-Djava.awt.headless=true", "-cp", classes+string(os.PathListSeparator)+runtime,
		"com.devsforge.ms4me.Main", "--model-class", className, "--json", string(modelJSON))
	cmd.Dir = w.ModelDir
	cmd.Env = append(os.Environ(), "GRPC_PORT="+strconv.Itoa(w.Cfg.GRPC.Port))
	cmd.Stdout = io.MultiWriter(os.Stdout, log)
	cmd.Stderr = io.MultiWriter(os.Stderr, log)
	if err = cmd.Start(); err != nil {
		_ = log.Close()
		return fmt.Errorf("MS4 Me launch failed: %w", err)
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
	conn, err := grpc.NewClient(fmt.Sprintf("%s:%d", w.Cfg.GRPC.Host, w.Cfg.GRPC.Port), grpc.WithTransportCredentials(insecure.NewCredentials()))
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
			return fmt.Errorf("MS4 Me gRPC startup timed out: %w", ready.Err())
		case err := <-exited:
			data, _ := os.ReadFile(log.Name())
			return fmt.Errorf("MS4 Me exited before startup (%v): %s", err, generators.SummarizeLog(string(data), 20, 3000))
		case <-ticker.C:
			probe, end := context.WithTimeout(ready, 500*time.Millisecond)
			_, err := devspb.NewAtomicModelServiceClient(conn).Initialize(probe, &emptypb.Empty{})
			end()
			if err == nil {
				success = true
				return nil
			}
			if status.Code(err) != codes.Unavailable && status.Code(err) != codes.DeadlineExceeded {
				return fmt.Errorf("MS4 Me model initialization failed: %w", err)
			}
		}
	}
}
