package database_test

import (
	"context"
	"devsforge/model"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	testcontainerspostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestValidateMigrations(t *testing.T) {
	ctx := context.Background()

	container, err := testcontainerspostgres.Run(ctx,
		"postgres:17-alpine",
		testcontainerspostgres.WithDatabase("testdb"),
		testcontainerspostgres.WithUsername("testuser"),
		testcontainerspostgres.WithPassword("testpass123"),
		testcontainerspostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("Failed to start PostgreSQL container: %v", err)
	}
	defer func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate container: %v", err)
		}
	}()

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("Failed to get connection string: %v", err)
	}

	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("Failed to get current file path")
	}
	migrationsPath := filepath.Join(filepath.Dir(filename), "migrations")

	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		dsn,
	)
	if err != nil {
		t.Fatalf("Failed to create migrate instance: %v", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	t.Log("Migrations applied successfully")

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	models := []struct {
		name  string
		model any
		table string
	}{
		{"User", &model.User{}, "users"},
		{"UserAISettings", &model.UserAISettings{}, "user_ai_settings"},
		{"Library", &model.Library{}, "libraries"},
		{"Model", &model.Model{}, "models"},
		{"ExperimentalFrame", &model.ExperimentalFrame{}, "experimental_frames"},
		{"Simulation", &model.Simulation{}, "simulations"},
		{"SimulationEvent", &model.SimulationEvent{}, "simulation_events"},
		{"WebAppDeployment", &model.WebAppDeployment{}, "web_app_deployments"},
	}

	failed := false
	for _, m := range models {
		if !db.Migrator().HasTable(m.model) {
			t.Errorf("✗ Model %s: table %s does not exist", m.name, m.table)
			failed = true
			continue
		}

		var count int64
		if err := db.Table(m.table).Count(&count).Error; err != nil {
			t.Errorf("✗ Model %s: failed to query table %s: %v", m.name, m.table, err)
			failed = true
			continue
		}

		t.Logf("✓ Model %s: table %s is valid (%d rows)", m.name, m.table, count)
	}

	if failed {
		t.Fatal("One or more models failed validation")
	}

	t.Logf("✅ All %d models validated successfully", len(models))
}
