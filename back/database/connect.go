package database

import (
	"devsforge/config"
	"devsforge/model"
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDB initializes the database connection
func ConnectDB() {
	cfg := config.Get()

	port := cfg.DB.Port

	// Construct DSN (Data Source Name)
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.DB.Host, port, cfg.DB.User, cfg.DB.Password, cfg.DB.Name,
	)

	dbLogger := logger.Warn
	if cfg.DB.DebugQueries {
		dbLogger = logger.Info
	}

	// Connect to the database
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(dbLogger),
	})
	if err != nil {
		panic("ERROR: Failed to connect to the database")
	}

	currentLogger := DB.Logger

	err = DB.Session(&gorm.Session{
		Logger: logger.Default.LogMode(logger.Warn),
	}).AutoMigrate(
		&model.User{},
		&model.UserAISettings{},
		&model.Library{},
		&model.Model{},
		&model.ExperimentalFrame{},
		&model.Simulation{},
		&model.SimulationEvent{},
		&model.WebAppDeployment{},
	)
	if err != nil {
		panic("ERROR: cannot migrate database")
	}

	DB.Logger = currentLogger
}
