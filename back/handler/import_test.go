package handler

import (
	"bytes"
	"context"
	"devsforge/database"
	"devsforge/exchange"
	modeljson "devsforge/json"
	"devsforge/model"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	postgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestImportPreservesUnknownModelsAndGuardsExecution(t *testing.T) {
	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:17-alpine", postgres.WithDatabase("imports"), postgres.WithUsername("test"), postgres.WithPassword("test"), postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = container.Terminate(ctx) }()
	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	source, err := iofs.New(os.DirFS("../database/migrations"), ".")
	if err != nil {
		t.Fatal(err)
	}
	migration, err := migrate.NewWithSourceInstance("iofs", source, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = migration.Close() }()
	if err = migration.Up(); err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(gormpostgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	defer func() { database.DB = previous }()
	sqlDB, _ := db.DB()
	defer func() { _ = sqlDB.Close() }()
	if err = database.SyncIntegrations(); err != nil {
		t.Fatal(err)
	}
	user := model.User{Username: "importer", Email: "importer@example.test", Password: "test"}
	if err = db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	other := model.User{Username: "other", Email: "other@example.test", Password: "test"}
	if err = db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	library := model.Library{UserID: user.ID, Title: "Import destination"}
	if err = db.Create(&library).Error; err != nil {
		t.Fatal(err)
	}
	jobID := strings.Repeat("a", 48)
	p := exchange.Package{Version: "1", Roots: []string{"root"}, Models: []exchange.Model{
		{ID: "root", Name: "Imported hierarchy", Type: "coupled", Ports: []modeljson.ModelPort{{Name: "out", Type: "out"}}, Components: []exchange.Component{{InstanceID: "one/with:characters", ModelID: "leaf"}, {InstanceID: "two", ModelID: "leaf"}}, Connections: []modeljson.ModelConnection{{From: modeljson.ModelLink{InstanceID: "one/with:characters", Port: "out"}, To: modeljson.ModelLink{InstanceID: "root", Port: "out"}}}},
		{ID: "leaf", Name: "External source", Type: "atomic", Language: "python", Framework: "Not installed", Code: "original source", Ports: []modeljson.ModelPort{{Name: "out", Type: "out"}}},
	}}
	// Adaptation can annotate the source coupled definition with the target.
	// It remains provenance, never an execution profile on a stored assembly.
	p.Models[0].IntegrationID = "ms4me-java"
	p.Models[0].IntegrationVersion = "1.0.0"
	p.Models[0].Framework = "MS4 Me"
	seals := make(chan int, 4)
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer private-test" || r.Header.Get("X-Import-User") != user.ID {
			w.WriteHeader(404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "GET" && r.URL.Path == "/jobs" {
			_ = json.NewEncoder(w).Encode([]ImportDraft{{ID: jobID, Title: "Imported hierarchy", State: "ready", ModelCount: 2}})
			return
		}
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/seal") {
			var input struct {
				Revision int `json:"revision"`
			}
			_ = json.NewDecoder(r.Body).Decode(&input)
			if input.Revision != 2 {
				w.WriteHeader(409)
				return
			}
			seals <- input.Revision
			_, _ = w.Write([]byte(`{"sealed":true}`))
			return
		}
		if r.Method == "POST" {
			var input map[string]json.RawMessage
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
				t.Error(err)
			}
			var mode string
			_ = json.Unmarshal(input["mode"], &mode)
			if mode == "iso" {
				if input["llm"] != nil {
					t.Error("ISO import received AI credentials")
				}
			} else {
				var llm map[string]string
				_ = json.Unmarshal(input["llm"], &llm)
				if llm["key"] != "test-import-key" || llm["model"] != "test-import-model" {
					t.Error("wrong user's provider settings")
				}
				if !strings.Contains(string(input["integrationContexts"]), "pypdevs.DEVS") {
					t.Error("native API context missing from import recognition")
				}
				var target map[string]string
				_ = json.Unmarshal(input["target"], &target)
				if target["id"] != "devsimpy-python" || !strings.Contains(target["instructions"], "pypdevs.DEVS") {
					t.Error("target modeling context missing")
				}
			}
			w.WriteHeader(202)
		}
		if err := json.NewEncoder(w).Encode(ImportJob{ID: jobID, State: "ready", Strategy: "one-off", Package: &p, Revision: 2, Messages: []ImportMessage{{ID: "test-message", Role: "assistant", Content: "Preserved the original source"}}}); err != nil {
			t.Error(err)
		}
	}))
	defer worker.Close()
	t.Setenv("IMPORT_ADDR", worker.URL)
	t.Setenv("IMPORT_INTERNAL_TOKEN", "private-test")
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error { c.Locals("user_id", c.Get("X-Test-User", user.ID)); return c.Next() })
	app.Get("/imports/:id", getImport)
	app.Get("/imports", listImports)
	app.Post("/imports", startImport)
	app.Post("/imports/:id/commit", commitImport)
	app.Post("/imports/:id/turns", continueImport)
	app.Post("/model", createModel)
	app.Patch("/model/:id", patchModel)
	app.Get("/model/:id/capabilities", modelCapabilities)
	app.Post("/simulation/:modelId", createSimulation)
	app.Post("/experimental-frame", createExperimentalFrame)
	do := func(method, path string, body any, as string) (int, []byte) {
		t.Helper()
		data, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		if as != "" {
			req.Header.Set("X-Test-User", as)
		}
		res, err := app.Test(req, 20000)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = res.Body.Close() }()
		raw, _ := io.ReadAll(res.Body)
		return res.StatusCode, raw
	}
	if status, raw := do("GET", "/imports/"+jobID, nil, other.ID); status == 200 {
		t.Fatalf("cross-user import visible: %s", raw)
	}
	if err := db.Create(&model.UserAISettings{UserID: user.ID, APIURL: "http://provider.test/v1", APIKey: "test-import-key", APIModel: "test-import-model"}).Error; err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"iso", "ai"} {
		input := ImportRequest{Mode: mode, Files: []ImportFile{{Name: "model.py", Base64: "c291cmNl"}}}
		if mode == "ai" {
			input.TargetID = "devsimpy-python"
			input.TargetVersion = "1.0.0"
		}
		status, raw := do("POST", "/imports", input, "")
		if status != 202 || bytes.Contains(raw, []byte("test-import-key")) {
			t.Fatalf("invalid start/credential isolation: %d %s", status, raw)
		}
	}
	if status, raw := do("GET", "/imports", nil, ""); status != 200 || !bytes.Contains(raw, []byte(jobID)) {
		t.Fatalf("resumable draft missing: %d %s", status, raw)
	}
	if status, _ := do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID}, ""); status != 400 {
		t.Fatal("unreviewed import accepted")
	}
	if status, _ := do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID, Reviewed: true, Revision: 1}, ""); status != 409 {
		t.Fatal("stale revision was accepted")
	}
	status, raw := do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID, Reviewed: true}, "")
	if status != 200 {
		t.Fatalf("commit %d: %s", status, raw)
	}
	var result ImportResult
	if err = json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	if len(result.ModelIDs) != 2 || len(result.RootIDs) != 1 {
		t.Fatalf("bad ids %s", raw)
	}
	status, again := do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID, Reviewed: true}, "")
	if status != 200 || string(again) != string(raw) {
		t.Fatal("retry was not idempotent")
	}
	if status, raw := do("GET", "/imports", nil, ""); status != 200 || string(raw) != "[]" {
		t.Fatalf("committed import still listed: %d %s", status, raw)
	}
	if len(seals) != 1 {
		t.Fatal("commit did not seal the reviewed revision")
	}
	if status, _ := do("POST", "/imports/"+jobID+"/turns", ImportTurn{Action: "discuss", Instructions: "change it"}, ""); status != 409 {
		t.Fatal("a committed import was modified")
	}
	var root model.Model
	if err = db.First(&root, "id=?", result.RootIDs[0]).Error; err != nil {
		t.Fatal(err)
	}
	if root.ImportSource == nil || root.ImportSource.Document["importReview"] == nil {
		t.Fatal("conversation provenance was lost")
	}
	if root.IntegrationID != nil || root.IntegrationVersion != nil {
		t.Fatal("coupled assembly was assigned an atomic execution profile")
	}
	if root.ImportSource.Document["integrationId"] != "ms4me-java" {
		t.Fatal("original coupled source integration was lost from provenance")
	}
	if len(root.Components) != 2 || root.Components[0].ModelID != root.Components[1].ModelID || root.Components[0].InstanceID == root.Components[1].InstanceID {
		t.Fatal("definitions and occurrences were conflated")
	}
	if strings.Contains(root.Components[0].InstanceID, "/") || len(root.Connections) != 1 || root.Connections[0].From.InstanceID != root.Components[0].InstanceID {
		t.Fatal("external occurrence ids were not remapped consistently")
	}
	var leaf model.Model
	if err = db.First(&leaf, "id=?", root.Components[0].ModelID).Error; err != nil {
		t.Fatal(err)
	}
	if leaf.IntegrationID != nil || leaf.ImportSource == nil || leaf.Language != "python" || leaf.Code != "original source" {
		t.Fatalf("unknown source lost or mapped to xDEVS: %+v", leaf)
	}
	for _, id := range []string{leaf.ID, root.ID} {
		status, raw = do("GET", "/model/"+id+"/capabilities", nil, "")
		if status != 200 || !bytes.Contains(raw, []byte(`"simulation":false`)) {
			t.Fatalf("bad capability: %s", raw)
		}
		status, raw = do("POST", "/simulation/"+id, map[string]any{}, "")
		if status != 400 {
			t.Fatalf("unsupported simulation accepted: %s", raw)
		}
		status, raw = do("POST", "/experimental-frame", map[string]any{"targetModelId": id}, "")
		if status != 400 {
			t.Fatalf("unsupported EF accepted: %s", raw)
		}
	}
	status, raw = do("PATCH", "/model/"+leaf.ID, map[string]any{"code": "edited original"}, "")
	if status != 200 {
		t.Fatalf("unsupported edit rejected: %s", raw)
	}
	if err = db.First(&leaf, "id=?", leaf.ID).Error; err != nil || leaf.ImportSource == nil || leaf.Code != "edited original" {
		t.Fatal("editing lost source provenance", err)
	}
	status, raw = do("POST", "/model", map[string]any{"name": "unknown creation", "type": "atomic", "integrationId": "unknown", "integrationVersion": "1"}, "")
	if status != 400 {
		t.Fatalf("ordinary creation allowed unknown framework: %s", raw)
	}
	jobID = strings.Repeat("b", 48)
	p.Models[1].IntegrationID = "devsimpy-python"
	p.Models[1].IntegrationVersion = "1.0.0"
	p.Models[1].Framework = "DEVSimPy"
	status, raw = do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID, Reviewed: true}, "")
	if status != 200 {
		t.Fatalf("known profile import failed: %s", raw)
	}
	if err = json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	status, raw = do("GET", "/model/"+result.RootIDs[0]+"/capabilities", nil, "")
	if status != 200 || !bytes.Contains(raw, []byte(`"simulation":true`)) {
		t.Fatalf("known profile was blocked: %s", raw)
	}
	for _, fixture := range []struct {
		env         string
		simulatable bool
	}{{"TEST_LIVE_IMPORT_PACKAGE", true}, {"TEST_LIVE_IMPORT_LEGACY", false}} {
		path := os.Getenv(fixture.env)
		if path == "" {
			continue
		}
		t.Run(fixture.env, func(t *testing.T) {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			var live ImportJob
			if err = json.Unmarshal(data, &live); err != nil || live.Package == nil {
				t.Fatal("invalid live artifact", err)
			}
			p = *live.Package
			jobID = strings.Repeat("c", 48)
			if !fixture.simulatable {
				jobID = strings.Repeat("d", 48)
			}
			status, raw := do("POST", "/imports/"+jobID+"/commit", CommitImportRequest{LibraryID: library.ID, Reviewed: true}, "")
			if status != 200 {
				t.Fatalf("live package commit: %d %s", status, raw)
			}
			var imported ImportResult
			if err = json.Unmarshal(raw, &imported); err != nil {
				t.Fatal(err)
			}
			if len(imported.ModelIDs) != len(p.Models) || len(imported.RootIDs) != len(p.Roots) {
				t.Fatal("live hierarchy was not persisted")
			}
			for _, id := range imported.ModelIDs {
				var stored model.Model
				if err = db.First(&stored, "id=?", id).Error; err != nil {
					t.Fatal(err)
				}
				found := false
				for _, spec := range p.Models {
					if spec.Name == stored.Name {
						found = true
						if stored.Code != spec.Code || len(stored.Ports) != len(spec.Ports) || len(stored.Connections) != len(spec.Connections) {
							t.Fatal("live source or interface changed during persistence")
						}
					}
				}
				if !found {
					t.Fatal("unknown persisted definition")
				}
			}
			status, raw = do("GET", "/model/"+imported.RootIDs[0]+"/capabilities", nil, "")
			var capabilities ModelCapabilities
			if err = json.Unmarshal(raw, &capabilities); err != nil || status != 200 || capabilities.Simulation != fixture.simulatable {
				t.Fatalf("live capability: %s (%v)", raw, err)
			}
		})
	}
}

func TestImportProfileResolutionNeverGuessesFromLanguage(t *testing.T) {
	p := exchange.Package{Models: []exchange.Model{
		{Type: "atomic", Language: "python", Framework: "unknown", Code: "source"},
		{Type: "atomic", Language: "python", IntegrationID: "devsimpy-python", IntegrationVersion: "1.0.0", Code: "source"},
		{Type: "atomic", Language: "java", RunnerID: "ms4me-java@1.0.0", Code: "source"},
		{Type: "atomic", Language: "python", Framework: "PyPDEVS", Code: "source", Dependencies: []string{"pypdevs"}},
		{Type: "atomic", Language: "python", Framework: "PyPDEVS", Code: "source", Dependencies: []string{"pypdevs==2.2.1"}},
	}}
	resolveImportedProfiles(&p)
	if p.Models[0].IntegrationID != "" || p.Models[0].BlockedReason == "" {
		t.Fatal("language inferred an executable framework")
	}
	if p.Models[1].IntegrationID != "devsimpy-python" || p.Models[1].BlockedReason != "" {
		t.Fatal("known integration was not resolved")
	}
	if p.Models[2].IntegrationID != "ms4me-java" {
		t.Fatal("runner identity was not resolved")
	}
	if p.Models[3].IntegrationID != "devsimpy-python" || p.Models[3].BlockedReason != "" || len(p.Models[3].Dependencies) != 0 {
		t.Fatal("native framework alias and bundled library were not recognized")
	}
	if p.Models[4].BlockedReason == "" {
		t.Fatal("a version-specific external dependency was silently discarded")
	}
}
