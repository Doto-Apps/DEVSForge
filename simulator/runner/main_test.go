// main_test.go — dans runners/go/
package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	"devsforge/simulator/runner/cmd"
	"devsforge/simulator/shared"

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
	if err != nil {
		t.Fatalf("could not create compose stack: %v", err)
	}

	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		t.Fatalf("compose up failed: %v", err)
	}

	// Gestion propre du Ctrl+C pendant le test
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

	t.Log("✅ Kafka started for runner test...")

	// 2️⃣ Charger le manifest JSON du modèle (avec le DumbModel dans "code")
	// ⚠️ Adapte le chemin si nécessaire.
	jsonContent, err := os.ReadFile("../tests/manifest.json")
	if err != nil {
		t.Fatalf("Error while reading test manifest: %v", err)
	}

	tmpDir := t.TempDir()
	jsonPath := filepath.Join(tmpDir, "manifest.json")
	if err := os.WriteFile(jsonPath, jsonContent, 0o644); err != nil {
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
