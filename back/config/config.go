package config

import (
	"fmt"
	"os"
	"sync"

	"github.com/joho/godotenv"
)

var once sync.Once

// LoadEnv loads environment files once.
func LoadEnv() {
	once.Do(func() {
		if err := godotenv.Load(".env"); err == nil {
			fmt.Println("Loaded .env")
			return
		}

		fmt.Println("Warning: could not load .env.back or .env, using process environment variables")
	})
}

// Config returns a variable after env loading.
func Config(key string) string {
	LoadEnv()
	return os.Getenv(key)
}
