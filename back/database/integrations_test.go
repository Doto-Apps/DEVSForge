package database_test

import (
	"context"
	"database/sql"
	"devsforge/database"
	"fmt"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	postgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func TestIntegrationMigrationPreservesExistingModels(t *testing.T) {
	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:17-alpine", postgres.WithDatabase("testdb"), postgres.WithUsername("testuser"), postgres.WithPassword("testpass123"), postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = container.Terminate(ctx) }()
	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	_, file, _, _ := runtime.Caller(0)
	m, err := migrate.New("file://"+filepath.Join(filepath.Dir(file), "migrations"), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = m.Close() }()
	if err = m.Steps(9); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	}()
	snapshot := func() map[string]string {
		rows, err := db.Query("SELECT id,md5((to_jsonb(m)-'language'-'integration_id'-'integration_version')::text) FROM models m")
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			if err := rows.Close(); err != nil {
				t.Error(err)
			}
		}()
		result := map[string]string{}
		for rows.Next() {
			var id, hash string
			if err = rows.Scan(&id, &hash); err != nil {
				t.Fatal(err)
			}
			result[id] = hash
		}
		if err := rows.Err(); err != nil {
			t.Fatal(err)
		}
		return result
	}
	before := snapshot()
	if len(before) == 0 {
		t.Fatal("migration fixture has no models")
	}
	if err = m.Steps(1); err != nil {
		t.Fatal(err)
	}
	after := snapshot()
	if fmt.Sprint(before) != fmt.Sprint(after) {
		t.Fatal("model content changed during catalogue migration")
	}

	previousDB := database.DB
	defer func() { database.DB = previousDB }()
	database.DB, err = gorm.Open(gormpostgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("INTEGRATIONS_ALLOW_CHANGES", "false")
	if err = database.SyncIntegrations(); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("UPDATE integrations SET digest='incompatible' WHERE id='xdevs-python'"); err != nil {
		t.Fatal(err)
	}
	if err = database.SyncIntegrations(); err == nil || !strings.Contains(err.Error(), "bump its version") {
		t.Fatalf("version immutability not enforced: %v", err)
	}
	if _, err = db.Exec("UPDATE integrations SET digest='' WHERE id='xdevs-python'"); err != nil {
		t.Fatal(err)
	}
	if err = database.SyncIntegrations(); err != nil {
		t.Fatal(err)
	}
	var count int
	if err = db.QueryRow("SELECT count(*) FROM models WHERE (type='atomic' AND (integration_id IS NULL OR integration_version <> '1.0.0')) OR (type='coupled' AND integration_id IS NOT NULL)").Scan(&count); err != nil || count != 0 {
		t.Fatalf("invalid assignments: %d %v", count, err)
	}
	if _, err = db.Exec("UPDATE models SET integration_id='missing' WHERE id=(SELECT id FROM models WHERE type='atomic' LIMIT 1)"); err == nil {
		t.Fatal("missing profile was accepted")
	}
	if _, err = db.Exec("INSERT INTO integrations(id,version,name,language,framework) VALUES('other','1.0.0','Other','python','Other')"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("UPDATE models SET integration_id='other' WHERE id=(SELECT id FROM models WHERE type='atomic' LIMIT 1)"); err != nil {
		t.Fatal(err)
	}
	if err = database.SyncIntegrations(); err == nil || !strings.Contains(err.Error(), "missing from installed resources") {
		t.Fatalf("missing historical resources accepted: %v", err)
	}
	if err = m.Steps(-1); err == nil || !strings.Contains(err.Error(), "integration information would be lost") {
		t.Fatalf("unsafe downgrade not rejected: %v", err)
	}
}
