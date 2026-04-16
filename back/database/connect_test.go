package database_test

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	testcontainerspostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func TestMigrations_Up(t *testing.T) {
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
		t.Fatalf("Failed to run migrations up: %v", err)
	}

	t.Log("Migrations up completed successfully")
}

func TestMigrations_Down(t *testing.T) {
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

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		_, _ = m.Close()
		t.Fatalf("Failed to run migrations up: %v", err)
	}

	_, _ = m.Close()
	m, err = migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		dsn,
	)
	if err != nil {
		t.Fatalf("Failed to create migrate instance: %v", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err := m.Down(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migrations down: %v", err)
	}

	t.Log("Migrations down completed successfully")
}
