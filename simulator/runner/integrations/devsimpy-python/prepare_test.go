package devsimpypython

import (
	"context"
	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
	"devsforge-shared/integrations"
	pb "devsforge-shared/proto"
	"math"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"
)

func testProject(t *testing.T, code string) (*generators.WrapperInfo, string) {
	t.Helper()
	d, err := integrations.Resolve("devsimpy-python", "1.0.0", "python")
	if err != nil {
		t.Fatal(err)
	}
	source, err := d.Resource(d.Wrapper)
	if err != nil {
		t.Fatal(err)
	}
	w := &generators.WrapperInfo{ModelDir: t.TempDir(), Cfg: &config.RunnerConfig{Model: &shared.RunnableModel{ID: "devsimpy-test", Name: "light ", Code: code, IntegrationID: d.ID, IntegrationVersion: d.Version, Language: "python"}}}
	if err = util.CopyDir(source, w.ModelDir); err != nil {
		t.Fatal(err)
	}
	return w, source
}

func TestAnalysisUsesRealSourcesWithoutExecutingModel(t *testing.T) {
	w, source := testProject(t, "raise RuntimeError('analysis must not execute user code')")
	if err := PrepareSources(w, shared.RunnableManifest{}); err != nil {
		t.Fatal(err)
	}
	if err := PrepareAnalysis(w, source); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"pypdevs"} {
		target, err := os.Readlink(filepath.Join(w.ModelDir, path))
		if err != nil || target != filepath.Join(source, path) {
			t.Fatalf("library %s is not shared from the canonical source: %s %v", path, target, err)
		}
	}
	if w.Cmd != nil {
		t.Fatal("analysis executed the model")
	}
}

func TestRealWrapper(t *testing.T) {
	if err := exec.Command(generators.PythonCommand(), "-c", "import grpc, google.protobuf").Run(); err != nil {
		t.Skip("run in the simulator image, which installs the Python RPC dependencies")
	}
	d, err := integrations.Resolve("devsimpy-python", "1.0.0", "")
	if err != nil {
		t.Fatal(err)
	}
	code, err := d.RenderTemplate("Example")
	if err != nil {
		t.Fatal(err)
	}
	w, _ := testProject(t, code)
	w.Cfg.Model.Ports = []shared.RunnableModelPort{{ID: "out", Name: "out", Type: "out"}}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	w.Cfg.GRPC = shared.YamlInputConfigGRPC{Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port}
	_ = listener.Close()
	t.Cleanup(func() { _ = w.Cleanup() })
	if err = PrepareWrapper(w, shared.RunnableManifest{}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := pb.NewAtomicModelServiceClient(w.GRPCConn)
	empty := &emptypb.Empty{}
	sigma, err := client.TimeAdvance(ctx, empty)
	if err != nil || sigma.GetSigma() != 1 {
		t.Fatalf("unexpected initial time advance: %v %v", sigma, err)
	}
	out, err := client.Output(ctx, empty)
	if err != nil || len(out.GetOutputs()) != 1 || out.Outputs[0].PortName != "out" || !strings.Contains(out.Outputs[0].ValuesJson[0], "hello") {
		t.Fatalf("unexpected output: %v %v", out, err)
	}
	if _, err = client.InternalTransition(ctx, empty); err != nil {
		t.Fatal(err)
	}
	sigma, err = client.TimeAdvance(ctx, empty)
	if err != nil || !math.IsInf(sigma.GetSigma(), 1) {
		t.Fatalf("template did not passivate: %v %v", sigma, err)
	}
	if _, err = client.Initialize(ctx, empty); err != nil {
		t.Fatal(err)
	}
	sigma, err = client.TimeAdvance(ctx, empty)
	if err != nil || sigma.GetSigma() != 1 {
		t.Fatalf("reinitialization did not reset state: %v %v", sigma, err)
	}
	if _, err = client.Finalize(ctx, empty); err != nil {
		t.Fatal(err)
	}
}

func TestRealWrapperReportsFailureAndCleansUp(t *testing.T) {
	if err := exec.Command(generators.PythonCommand(), "-c", "import grpc, google.protobuf").Run(); err != nil {
		t.Skip("run in the simulator image")
	}
	for _, tt := range []struct{ name, code, want string }{
		{"syntax", "invalid python ???", "SyntaxError"},
		{"initialization", "from pypdevs.DEVS import AtomicDEVS\nclass Broken(AtomicDEVS):\n def __init__(self):\n  raise ValueError('bad initial state')\n", "bad initial state"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := testProject(t, tt.code)
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			w.Cfg.GRPC = shared.YamlInputConfigGRPC{Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port}
			_ = listener.Close()
			t.Cleanup(func() { _ = w.Cleanup() })
			err = PrepareWrapper(w, shared.RunnableManifest{})
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("missing startup diagnostic: %v", err)
			}
			if w.Cmd != nil || w.GRPCConn != nil {
				t.Fatal("failed startup retained process or connection")
			}
		})
	}
}
