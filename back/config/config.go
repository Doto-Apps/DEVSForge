// Package config provides environment-based configuration management with singleton pattern.
// It uses environment variables with prefixes and default values for type-safe configuration.
package config

import (
	"sync"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

var (
	once     sync.Once
	instance *Config
)

type Config struct {
	DB        DBConfig
	Server    ServerConfig
	Auth      AuthConfig
	Log       LogConfig
	Kafka     KafkaConfig
	Simulator SimulatorConfig
}

type DBConfig struct {
	Host         string `env:"DB_HOST" envDefault:"localhost"`
	Port         int    `env:"DB_PORT" envDefault:"5432"`
	User         string `env:"DB_USER" envDefault:"devsforge"`
	Password     string `env:"DB_PASSWORD" envDefault:"test123"`
	Name         string `env:"DB_NAME" envDefault:"devsforge"`
	DebugQueries bool   `env:"DB_DEBUG_QUERIES" envDefault:"false"`
}

type ServerConfig struct {
	Port int `env:"PORT" envDefault:"3000"`
}

type AuthConfig struct {
	JWTSecret          string `env:"JWT_SECRET"`
	RefreshTokenSecret string `env:"REFRESH_TOKEN_SECRET"`
}

type LogConfig struct {
	Dir  string `env:"LOG_DIR" envDefault:"/tmp/devsforge-logs/"`
	Mode string `env:"LOG_MODE" envDefault:"all"`
}

type KafkaConfig struct {
	Address string `env:"KAFKA_ADDRESS" envDefault:"localhost:9092"`
}

type SimulatorConfig struct {
	CoordinatorPath string `env:"SIMULATOR_COORDINATOR_PATH" envDefault:"/app/simulator/coordinator"`
	Cmd             string `env:"SIMULATOR_CMD"`
	Addr            string `env:"SIMULATOR_ADDR" envDefault:"localhost:8080"`
	Mode            string `env:"SIMULATOR_MODE" envDefault:"sync"`
}

func Get() *Config {
	once.Do(func() {
		_ = godotenv.Load(".env")

		cfg := &Config{}
		err := env.Parse(cfg)
		if err != nil {
			panic("config error: " + err.Error())
		}
		instance = cfg
	})
	return instance
}
