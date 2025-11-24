// main_test.go
package tests

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"testing"

	tccompose "github.com/testcontainers/testcontainers-go/modules/compose"
)

var KafkaAddr = "localhost:9092"
var TmpDirectory = "../../../../tmp"
var ErrSimulationDone = errors.New("simulation completed normally")
var Sender = "fakecoordinator"
var testLogger = log.New(os.Stdout, "[TEST FAKE COORDINATOR ]   :", log.LstdFlags)

// Variable globale pour la stack, utile pour la fermer proprement
var stack *tccompose.DockerCompose

func TestMain(m *testing.M) {
	ctx := context.Background()
	composeFile := "../../tests/docker-compose.yml"

	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		log.Fatalf("docker-compose file %s not found, skipping test", composeFile)
	}

	// 1. Initialisation de la stack
	var err error
	stack, err = tccompose.NewDockerCompose(composeFile)
	if err != nil {
		log.Fatalf("could not create compose stack: %v", err)
	}

	// 2. Gestion des signaux (Ctrl+C)
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("🛑 Interrupt received, shutting down...")
		teardownGlobal(ctx)
		os.Exit(1)
	}()

	// 3. Démarrage (BeforeAll)
	log.Println("🚀 Starting Docker Stack...")
	if err := stack.Up(ctx, tccompose.Wait(true)); err != nil {
		log.Fatalf("compose up failed: %v", err)
	}
	log.Println("✅ Kafka started.")

	// 4. Exécution des tests
	exitCode := m.Run()

	// 5. Nettoyage Global (AfterAll)
	// On le fait explicitement AVANT os.Exit
	teardownGlobal(ctx)

	os.Exit(exitCode)
}

// Fonction pour éteindre Docker proprement
func teardownGlobal(ctx context.Context) {
	if stack != nil {
		log.Println("⬇️ Stopping Docker Stack...")
		if err := stack.Down(ctx, tccompose.RemoveOrphans(true), tccompose.RemoveImagesLocal); err != nil {
			log.Printf("⚠️ Error during stack down: %v", err)
		}
	}
}

// --- LE AFTER EACH EST ICI ---

// setupTest configure l'environnement pour UN test unique
// À appeler au début de chaque TestXxx(t *testing.T)
func setupTest(t *testing.T) {
	// Création du dossier temporaire (BeforeEach)
	_ = os.MkdirAll(TmpDirectory, 0755)

	// Enregistrement du nettoyage (AfterEach)
	t.Cleanup(func() {
		cleanup() // Votre fonction qui supprime ./tmp
	})
}

func cleanup() {
	// Votre logique de suppression de dossier existante...
	log.Printf("🧹 Test Cleaning up %s...", TmpDirectory)
	os.RemoveAll(TmpDirectory)
	log.Printf("✅ Test Cleaned %s...", TmpDirectory)
}
