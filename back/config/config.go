package config

import (
	"fmt"
	"os"
	"sync"

	"github.com/joho/godotenv"
)

// Chargement unique avec sync.Once
var once sync.Once

// LoadEnv charge `.env.back` une seule fois
func LoadEnv() {
	once.Do(func() {
		err := godotenv.Load(".env.back")
		if err != nil {
			fmt.Println("⚠️ Warning: Could not load .env.back, using default environment variables")
		}
	})
}

// Config récupère la variable d'env après chargement
func Config(key string) string {
	LoadEnv() // On s'assure que l'env est chargé
	return os.Getenv(key)
}
