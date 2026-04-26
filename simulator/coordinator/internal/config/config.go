// Package config provides environment-based configuration management for the coordinator.
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
	Log       LogConfig
	Simulator SimulatorConfig
	Paths     PathsConfig
	Kafka     KafkaConfig
}

type LogConfig struct {
	Dir  string `env:"LOG_DIR" envDefault:"/tmp/devsforge-logs/"`
	Mode string `env:"LOG_MODE" envDefault:"all"`
}

type SimulatorConfig struct {
	Port int `env:"SIMULATOR_PORT" envDefault:"8080"`
}

type PathsConfig struct {
	RunnerCmd         string `env:"PATHS_RUNNER_CMD" envDefault:"/opt/devsforge/devsforge-runner"`
	SimulationDirRoot string `env:"PATHS_SIM_ROOT" envDefault:"/tmp/simulations"`
}

type KafkaConfig struct {
	Topic string `env:"KAFKA_TOPIC"`
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
