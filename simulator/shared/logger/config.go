package logger

import (
	"sync"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

var (
	once     sync.Once
	instance *LoggerConfig
)

type LoggerConfig struct {
	Log LogConfig
}

type LogConfig struct {
	Dir  string `env:"LOG_DIR" envDefault:"/tmp/devsforge-logs/"`
	Mode string `env:"LOG_MODE" envDefault:"all"`
}

func Get() *LoggerConfig {
	once.Do(func() {
		_ = godotenv.Load(".env")

		cfg := &LoggerConfig{}
		err := env.Parse(cfg)
		if err != nil {
			panic("logger config error: " + err.Error())
		}
		instance = cfg
	})
	return instance
}
