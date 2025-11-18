// main_test.go — dans runners/go/
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	"devsforge/simulator/runner/cmd"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
	"gopkg.in/yaml.v3"
)

// TestLaunchRunnerWithKafka démarre Kafka via docker-compose, puis lance UN runner
// avec un manifest JSON (contenant ton DumbModel) + un YAML de config généré.
func TestLaunchRunnerWithKafka(t *testing.T) {
	t.Helper()

	ctx := context.Background()

	// ⚠️ Adapte le chemin si ton docker-compose n'est pas là.
	composeFile := "../tests/docker-compose.yml"

	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		t.Skipf("docker-compose file %s not found, skipping test", composeFile)
	}

	// 1️⃣ Démarrer Kafka avec testcontainers-go
	stack, err := tccompose.NewDockerCompose(
		composeFile,
	)

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal)
		os.Exit(1)
	}()

	defer func() {
		if err := stack.Down(ctx, tccompose.RemoveOrphans(true)); err != nil {
			t.Logf("compose down returned error: %v", err)
		}
	}()

	if err != nil {
		t.Fatalf("could not create compose stack: %v", err)
	}

	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		t.Fatalf("compose up failed: %v", err)

	}

	// Gestion propre du Ctrl+C pendant le test

	t.Log("✅ Kafka started for runner test...")

	var manifest shared.RunnableManifest

	codeContent, err := os.ReadFile("../tests/m1/m1.go")
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "go",
			"id": "m1",
			"name": "GeneratorIncremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test"
	}`, string(codeContent))

	err = utils.ParseManifest(jsonContent, &manifest)
	if err != nil {
		t.Fatalf("Error while parsing test manifest\n %v", err)
	}

	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("failed to marshal manifest: %v", err)
	}

	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, data, 0644); err != nil {
		t.Fatalf("failed to write temp manifest: %v", err)
	}

	// 3️⃣ Générer un fichier YAML de config pour le runner
	kafkaAddr := "localhost:9092"
	kafkaTopic := "runner-test"

	yamlCfg := shared.YamlInputConfig{
		Kafka: shared.YamlInputConfigKafka{
			Enabled: true,
			Address: kafkaAddr,
			Topic:   kafkaTopic,
		},
		GRPC: shared.YamlInputConfigGRPC{
			Host: "localhost",
			Port: 50051,
		},
	}

	cfgPath := filepath.Join(tmpDir, "runner-config.yaml")
	yamlBytes, err := yaml.Marshal(&yamlCfg)
	if err != nil {
		t.Fatalf("failed to marshal yaml config: %v", err)
	}

	if err := os.WriteFile(cfgPath, yamlBytes, 0o644); err != nil {
		t.Fatalf("failed to write yaml config: %v", err)
	}

	// 4️⃣ Lancer le runner directement via LaunchRunner
	//    On simule la ligne de commande :
	//    go run runners/go/main.go --file <manifest> --config <config>
	args := []string{
		"--file", jsonPath,
		"--config", cfgPath,
	}

	if err := cmd.LaunchRunner(args); err != nil {
		t.Fatalf("expected runner to exit cleanly, got error:\n%v", err)
	}
}
