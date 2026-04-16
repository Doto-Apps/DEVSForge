package database

import (
	"devsforge/config"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
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

	runMigrations(dsn)
}

// runMigrations run migration with golang-migrate if the project is going larger may be consider using `atlas`
func runMigrations(dsn string) {
	cfg := config.Get()

	m, err := migrate.New(
		"file://"+cfg.DB.MigrationsPath,
		"postgres://"+dsn,
	)
	if err != nil {
		panic(fmt.Sprintf("ERROR: cannot create migrate instance: %v", err))
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		panic(fmt.Sprintf("ERROR: cannot run migrations: %v", err))
	}
}