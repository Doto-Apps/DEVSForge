package internal

import (
	"log"
	"os"
	"os/exec"
	"time"

	"google.golang.org/grpc"
)

// WrapperInfo regroupe tout ce qui est nécessaire pour un wrapper (indépendant de LaunchSim)
type WrapperInfo struct {
	Cfg      *RunnerConfig
	RootDir  string
	LangRoot string
	ModelDir string
	GRPCConn *grpc.ClientConn
	Cmd      *exec.Cmd
}

// Cleanup nettoie le process, la connexion gRPC et le répertoire temporaire
func (w *WrapperInfo) Cleanup() error {
	// 1. Fermer la connexion gRPC
	if w.GRPCConn != nil {
		if err := w.GRPCConn.Close(); err != nil {
			log.Printf("⚠️ failed to close gRPC connection: %v", err)
		}
		w.GRPCConn = nil
	}

	// 2. Arrêter le processus
	if w.Cmd != nil && w.Cmd.Process != nil {
		pid := w.Cmd.Process.Pid
		log.Printf("Stopping model process pid=%d", pid)

		// Tuer le processus (c'est un binaire unique maintenant, pas go run)
		if err := w.Cmd.Process.Kill(); err != nil {
			log.Printf("⚠️ failed to kill process: %v", err)
		}

		// Attendre que le processus se termine
		w.Cmd.Wait()
		log.Printf("Process stopped pid=%d", pid)
		w.Cmd = nil

		// Petit délai pour que le système libère les fichiers
		time.Sleep(500 * time.Millisecond)
	}

	// 3. Nettoyer le répertoire temporaire
	if w.RootDir != "" {
		// Réessayer plusieurs fois avec backoff (au cas où)
		var lastErr error
		for i := 0; i < 5; i++ {
			if i > 0 {
				delay := time.Duration(i*300) * time.Millisecond
				time.Sleep(delay)
				log.Printf("Retrying cleanup (attempt %d/5)...", i+1)
			}

			if err := os.RemoveAll(w.RootDir); err != nil {
				lastErr = err
				continue
			}

			log.Printf("🧹 temp dir %s removed", w.RootDir)
			w.RootDir = ""
			return nil
		}

		// Si échec après 5 tentatives, logger mais ne pas bloquer
		log.Printf("⚠️ Could not remove temp dir %s after 5 attempts: %v", w.RootDir, lastErr)
		log.Printf("   Directory will be reused on next run")
	}

	return nil
}
