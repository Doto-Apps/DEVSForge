package generators

import (
	"bytes"
	"context"
	"devsforge-runner/internal/config"
	shared "devsforge-shared"
	devspb "devsforge-wrapper/proto"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

// PrepareJavaWrapper is the Java version of PrepareGoWraper.
// Workflow:
// 1. Writes user's Java file to src/main/java/com/devsforge/runner/<ClassName>.java
// 2. Modifies ServerRunner.java to use user's class via reflection
// 3. Compiles with mvn clean package -DskipTests -q
// 4. Finds JAR in target/*-jar-with-dependencies.jar
// 5. Runs java -jar <jar> --json <modelJSON>
// 6. Waits for gRPC server to be ready (30s timeout)
func PrepareJavaWrapper(wrapper *WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("PrepareJavaWrapper: missing config")
	}

	// 1. Write user's Java file
	className := cfg.Model.Name
	modelPath := filepath.Join(wrapper.ModelDir, "src", "main", "java", "com", "devsforge", "runner", className+".java")
	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write %s.java: %w", className, err)
	}

	// 2. Modify ServerRunner.java to use user's class via reflection
	serverRunnerPath := filepath.Join(wrapper.ModelDir, "src", "main", "java", "com", "devsforge", "runner", "rpc", "ServerRunner.java")
	serverRunnerContent, err := os.ReadFile(serverRunnerPath)
	if err != nil {
		return fmt.Errorf("failed to read ServerRunner.java: %w", err)
	}

	// Replace Class.forName("Model") → Class.forName("com.devsforge.runner.<ClassName>")
	modifiedContent := strings.Replace(string(serverRunnerContent), `Class.forName("Model")`, `Class.forName("com.devsforge.runner.`+className+`")`, 1)

	// Replace static method call with constructor call
	oldCode := `java.lang.reflect.Method newModelMethod = modelClass.getMethod("NewModel", RunnableModel.class);
            return (Atomic) newModelMethod.invoke(null, config);`
	newCode := `return (Atomic) modelClass.getConstructor(RunnableModel.class).newInstance(config);`
	modifiedContent = strings.Replace(modifiedContent, oldCode, newCode, 1)

	if err := os.WriteFile(serverRunnerPath, []byte(modifiedContent), 0o644); err != nil {
		return fmt.Errorf("failed to write modified ServerRunner.java: %w", err)
	}

	// 3. Serialize model to pass as --json
	modelJSON, err := json.Marshal(cfg.Model)
	if err != nil {
		return fmt.Errorf("failed to marshal model config for java wrapper: %w", err)
	}

	// 4. Compile with Maven
	slog.Info("Building Java model wrapper with Maven...")
	buildCmd := exec.Command("./mvnw", "clean", "package", "-DskipTests", "-q")
	buildCmd.Dir = wrapper.ModelDir

	// Force JAVA_HOME if not set
	javaHome := config.Get().Env.Java.Home
	if javaHome == "" {
		// Try to find Java 21
		if _, err := os.Stat("/usr/lib/jvm/java-21-openjdk"); err == nil {
			buildCmd.Env = append(os.Environ(), "JAVA_HOME=/usr/lib/jvm/java-21-openjdk")
		}
	} else {
		buildCmd.Env = os.Environ()
	}

	var buildStdout, buildStderr bytes.Buffer
	buildCmd.Stdout = &buildStdout
	buildCmd.Stderr = &buildStderr

	if err := buildCmd.Run(); err != nil {
		diagnostic := CompactTailLog(buildStderr.String(), buildStdout.String(), 12, 1200)
		if diagnostic != "" {
			return fmt.Errorf("failed to build Java wrapper: %w | %s", err, diagnostic)
		}
		return fmt.Errorf("failed to build Java wrapper: %w", err)
	}
	slog.Info("✅ Java model wrapper built successfully")

	// 5. Find JAR with dependencies in target/
	jarPattern := filepath.Join(wrapper.ModelDir, "target", "*-jar-with-dependencies.jar")
	matches, err := filepath.Glob(jarPattern)
	if err != nil || len(matches) == 0 {
		return fmt.Errorf("JAR file not found after Maven build")
	}
	jarPath := matches[0]

	// 6. Start Java process
	portStr := strconv.Itoa(cfg.GRPC.Port)
	env := append(os.Environ(), "GRPC_PORT="+portStr)

	cmd := exec.Command("java", "-jar", jarPath, "--json", string(modelJSON))
	cmd.Dir = wrapper.ModelDir
	cmd.Env = env

	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = io.MultiWriter(os.Stdout, &stdoutBuf)
	cmd.Stderr = io.MultiWriter(os.Stderr, &stderrBuf)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start java model process: %w", err)
	}

	slog.Info("Started JAVA model process", "model_id", cfg.Model.ID, "pid", cmd.Process.Pid)
	wrapper.Cmd = cmd

	// 7. Monitor process to detect crash before gRPC is ready
	procErrCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		procErrCh <- err
	}()

	// 8. gRPC connection with process monitoring and timeout
	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)
	slog.Info(fmt.Sprintf("Waiting for gRPC server at %s to be ready...", addr))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for JAVA gRPC server to be ready")

		case perr := <-procErrCh:
			if perr != nil {
				diagnostic := CompactTailLog(stderrBuf.String(), stdoutBuf.String(), 12, 1200)
				if diagnostic != "" {
					return fmt.Errorf("java model process exited before gRPC was ready: %w | %s", perr, diagnostic)
				}
				return fmt.Errorf("java model process exited before gRPC was ready: %w", perr)
			}
			return fmt.Errorf("java model process exited before gRPC was ready (no error from Wait)")

		case <-ticker.C:
			// Attempt connection
			conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				continue
			}

			testCtx, testCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			modelClient := devspb.NewAtomicModelServiceClient(conn)
			_, testErr := modelClient.Initialize(testCtx, &emptypb.Empty{})
			testCancel()

			if testErr == nil {
				// Connection successful!
				slog.Info("✅ gRPC server is ready and responding")
				wrapper.GRPCConn = conn
				return nil
			}

			if err = conn.Close(); err != nil {
				slog.Warn("cannot close grpc connection")
			}
		}
	}
}
