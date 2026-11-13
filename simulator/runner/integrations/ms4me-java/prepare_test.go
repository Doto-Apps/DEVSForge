package ms4mejava

import (
	"context"
	"crypto/sha256"
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
	"devsforge-shared/integrations"
	pb "devsforge-shared/proto"
	"fmt"
	"math"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestBundledDependencyIntegrity(t *testing.T) {
	manifest, err := os.ReadFile("dependencies.sha256")
	if err != nil {
		t.Fatal(err)
	}
	fields := strings.Fields(string(manifest))
	if len(fields) != 2 {
		t.Fatal("expected one pinned dependency checksum")
	}
	data, err := os.ReadFile(filepath.Join("wrapper", fields[1]))
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprintf("%x", sha256.Sum256(data)); got != fields[0] {
		t.Fatalf("Closure-DEVS JAR checksum mismatch: got %s, want %s; check binary Git attributes and restore the original archive", got, fields[0])
	}
}

func TestSourcePaths(t *testing.T) {
	for _, tt := range []struct{ code, fallback, want string }{
		{"package app.models; public class Light {}", "light ", "app/models/Light"},
		{"/* package wrong; public class Wrong {} */ package démo; public class Light {}", "x", "démo/Light"},
		{"// package ignored;\npublic class Light {}", "x", "Light"},
		{"public class Light { String s = \"package wrong;\"; }", "x", "Light"},
		{"", "../escape", "Model"},
		{"package ../../escape; public class Light {}", "x", "Light"},
	} {
		if got := filepath.ToSlash(SourcePath(tt.code, tt.fallback)); got != tt.want {
			t.Fatalf("%q: %q, want %q", tt.code, got, tt.want)
		}
	}
}

func testProject(t *testing.T, code string) *generators.WrapperInfo {
	t.Helper()
	d, err := integrations.Resolve("ms4me-java", "1.0.0", "java")
	if err != nil {
		t.Fatal(err)
	}
	source, err := d.Resource(d.Wrapper)
	if err != nil {
		t.Fatal(err)
	}
	w := &generators.WrapperInfo{ModelDir: t.TempDir(), Cfg: &config.RunnerConfig{Model: &shared.RunnableModel{ID: "ms4-test", Name: "display label ", Code: code, IntegrationID: d.ID, IntegrationVersion: d.Version, Language: "java"}}}
	if err = util.CopyDir(source, w.ModelDir); err != nil {
		t.Fatal(err)
	}
	return w
}

func TestAnalysisUsesRealLibraryWithoutExecutingUserCode(t *testing.T) {
	w := testProject(t, "package example.user; public class Light { static { throw new Error(\"must not run\"); } }")
	if err := PrepareSources(w, shared.RunnableManifest{}); err != nil {
		t.Fatal(err)
	}
	d, _ := integrations.Resolve("ms4me-java", "1.0.0", "")
	source, _ := d.Resource(d.Wrapper)
	if err := PrepareAnalysis(w, source); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"src/model/java/example/user/Light.java", "dependencies/maven/com/ms4systems/Closure-DEVS/1.0.0/Closure-DEVS-1.0.0.jar"} {
		if _, err := os.Stat(filepath.Join(w.ModelDir, path)); err != nil {
			t.Fatal(err)
		}
	}
	pom, _ := os.ReadFile(filepath.Join(w.ModelDir, "pom.xml"))
	if !strings.Contains(string(pom), "<artifactId>model-ms4-test</artifactId>") || w.Cmd != nil {
		t.Fatal("analysis project was not isolated or ran user code")
	}
}

// Runs automatically in simulator/CI images, which provide the prebuilt runtime.
func TestRealWrapper(t *testing.T) {
	if os.Getenv("MS4ME_RUNTIME_JAR") == "" {
		t.Skip("run in the simulator image with its prebuilt MS4 Me runtime")
	}
	d, _ := integrations.Resolve("ms4me-java", "1.0.0", "")
	for _, fixture := range []string{"sample", "template", "native"} {
		t.Run(fixture, func(t *testing.T) {
			if fixture == "native" {
				t.Setenv("MS4ME_RUNTIME_JAR", "")
			}
			sample := fixture != "template"
			var code string
			if sample {
				b, err := os.ReadFile("wrapper/src/test/java/com/devsforge/ms4me/SampleGenerator.java")
				if err != nil {
					t.Fatal(err)
				}
				code = string(b)
			} else {
				var err error
				code, err = d.RenderTemplate("TemplateExample")
				if err != nil {
					t.Fatal(err)
				}
			}
			w := testProject(t, code)
			w.Cfg.Model.Ports = []shared.RunnableModelPort{{ID: "out", Name: "out", Type: "out"}}
			w.Cfg.Model.Parameters = []shared.RunnableModelParameter{{Name: "period", Value: 2.5}}
			if sample {
				w.Cfg.Model.Ports = append(w.Cfg.Model.Ports, shared.RunnableModelPort{ID: "setPeriod", Name: "setPeriod", Type: "in"}, shared.RunnableModelPort{ID: "stop", Name: "stop", Type: "in"})
			}
			l, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			w.Cfg.GRPC = shared.YamlInputConfigGRPC{Host: "127.0.0.1", Port: l.Addr().(*net.TCPAddr).Port}
			_ = l.Close()
			t.Cleanup(func() { _ = w.Cleanup() })
			if err = PrepareWrapper(w, shared.RunnableManifest{}); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			client := pb.NewAtomicModelServiceClient(w.GRPCConn)
			empty := &emptypb.Empty{}
			assertSigma := func(want float64) {
				r, err := client.TimeAdvance(ctx, empty)
				if err != nil || r.GetSigma() != want {
					t.Fatalf("sigma: %v %v, want %v", r, err, want)
				}
			}
			assertSigma(2.5)
			for count := 0; count < 3; count++ {
				out, err := client.Output(ctx, empty)
				if err != nil || len(out.GetOutputs()) != 1 || out.Outputs[0].PortName != "out" {
					t.Fatalf("output: %v %v", out, err)
				}
				if _, err = client.InternalTransition(ctx, empty); err != nil {
					t.Fatal(err)
				}
			}
			if sample {
				if _, err = client.AddInput(ctx, &pb.InputMessage{PortName: "setPeriod", ValueJson: "3"}); err != nil {
					t.Fatal(err)
				}
				if _, err = client.ExternalTransition(ctx, &pb.ElapsedTime{Value: 0.5}); err != nil {
					t.Fatal(err)
				}
				assertSigma(3)
				if _, err = client.AddInput(ctx, &pb.InputMessage{PortName: "stop", ValueJson: "true"}); err != nil {
					t.Fatal(err)
				}
				if _, err = client.ConfluentTransition(ctx, &pb.ElapsedTime{Value: 3}); err != nil {
					t.Fatal(err)
				}
				assertSigma(math.MaxFloat64)
			}
			if _, err = client.AddInput(ctx, &pb.InputMessage{PortName: "missing", ValueJson: "0"}); status.Code(err) != codes.NotFound {
				t.Fatalf("unknown port: %v", err)
			}
			if _, err = client.Finalize(ctx, empty); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRealWrapperReportsFailureAndCleansUp(t *testing.T) {
	if os.Getenv("MS4ME_RUNTIME_JAR") == "" {
		t.Skip("run in the simulator image")
	}
	d, _ := integrations.Resolve("ms4me-java", "1.0.0", "")
	code, err := d.RenderTemplate("Broken")
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct{ name, code, want string }{
		{"compile", "public class Broken { invalid java; }", "compilation failed"},
		{"port", code, "does not declare input port 'missing'"},
		{"initialize", "public class Broken extends com.ms4systems.devs.core.model.impl.Atomic { public Broken() { addInputPort(\"missing\"); } public void initialize() { throw new IllegalStateException(\"bad initial state\"); } }", "bad initial state"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			w := testProject(t, tt.code)
			w.Cfg.Model.Ports = []shared.RunnableModelPort{{ID: "missing", Name: "missing", Type: "in"}}
			w.Cfg.GRPC = shared.YamlInputConfigGRPC{Host: "127.0.0.1", Port: 50051}
			t.Cleanup(func() { _ = w.Cleanup() })
			err := PrepareWrapper(w, shared.RunnableManifest{})
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("missing useful diagnostic: %v", err)
			}
			if w.Cmd != nil || w.GRPCConn != nil {
				t.Fatal("failed startup retained process or connection")
			}
		})
	}
}
