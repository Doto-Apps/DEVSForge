package database

import (
	"devsforge/config"
	"fmt"
	"log/slog"

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

	// Construct DSN for GORM (libpq format)
	gormDSN := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.DB.Host, cfg.DB.Port, cfg.DB.User, cfg.DB.Password, cfg.DB.Name,
	)

	// Construct DSN for golang-migrate (URL format)
	migrateDSN := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.Name,
	)

	dbLogger := logger.Warn
	if cfg.DB.DebugQueries {
		dbLogger = logger.Info
	}

	// Connect to the database
	var err error
	DB, err = gorm.Open(postgres.Open(gormDSN), &gorm.Config{
		Logger: logger.Default.LogMode(dbLogger),
	})
	if err != nil {
		panic("ERROR: Failed to connect to the database")
	}

	runMigrations(migrateDSN)
}

// runMigrations run migration with golang-migrate if the project is going larger may be consider using `atlas`
func runMigrations(migrateDSN string) {
	cfg := config.Get()

	m, err := migrate.New(
		"file://"+cfg.DB.MigrationsPath,
		migrateDSN,
	)
	if err != nil {
		panic(fmt.Sprintf("ERROR: cannot create migrate instance: %v", err))
	}
	defer func() {
		if sourceErr, dbErr := m.Close(); sourceErr != nil || dbErr != nil {
			panic(fmt.Sprintf("ERROR: cannot close migrate instance:\nSource error:%v\n\nDatabase Error:%v\n", sourceErr, dbErr))
		}
	}()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		panic(fmt.Sprintf("ERROR: cannot run migrations: %v", err))
	} else {
		slog.Info("Database is up to date")
	}
}
