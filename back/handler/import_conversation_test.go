package handler

import (
	"bytes"
	"devsforge/exchange"
	modeljson "devsforge/json"
	"devsforge/lib"
	"devsforge/services"
	"encoding/json"
	"github.com/gofiber/fiber/v2"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDraftManifestPreservesOccurrencesAndParameterOverrides(t *testing.T) {
	p := exchange.Package{Version: "1", Roots: []string{"root"}, Models: []exchange.Model{
		{ID: "root", Name: "Root", Type: "coupled", Components: []exchange.Component{{InstanceID: "one", ModelID: "leaf", ParameterOverrides: map[string]any{"delay": 2.0}}, {InstanceID: "two", ModelID: "leaf", ParameterOverrides: map[string]any{"delay": 4.0}}}, Connections: []modeljson.ModelConnection{{From: modeljson.ModelLink{InstanceID: "one", Port: "out"}, To: modeljson.ModelLink{InstanceID: "two", Port: "in"}}}},
		{ID: "leaf", Name: "Leaf", Type: "atomic", Framework: "PyPDEVS", Language: "python", Code: "source", Parameters: []modeljson.ModelParameter{{Name: "delay", Type: "float", Value: 1.0}}, Ports: []modeljson.ModelPort{{Name: "in", Type: "in"}, {Name: "out", Type: "out"}}},
	}}
	if err := p.Validate(); err != nil {
		t.Fatal(err)
	}
	resolveImportedProfiles(&p)
	p.Models[0].IntegrationID = "ms4me-java"
	p.Models[0].IntegrationVersion = "1.0.0"
	models := draftModels(p)
	if models[0].IntegrationID != nil || models[0].IntegrationVersion != nil {
		t.Fatal("draft coupled assembly should not receive an atomic profile")
	}
	if models[0].Components[0].InstanceMetadata.Parameters[0].Value != 2.0 || models[0].Components[1].InstanceMetadata.Parameters[0].Value != 4.0 {
		t.Fatal("per-instance overrides lost")
	}
	manifest, err := lib.ModelToManifest(models, "root", "probe", 400, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Models) != 2 || manifest.MaxTime != 400 {
		t.Fatal("draft manifest does not match saved model execution")
	}
	// An unrelated unsupported root must not prevent this selected root from running.
	p.Models = append(p.Models, exchange.Model{ID: "other", Name: "Other", Type: "atomic", BlockedReason: "unknown framework"})
	if _, err := lib.ModelToManifest(draftRootModels(p, "root"), "root", "probe", 400, nil); err != nil {
		t.Fatal(err)
	}
}

func TestImportVerificationRequiresInternalTokenAndDetectsMS4Variant(t *testing.T) {
	t.Setenv("IMPORT_INTERNAL_TOKEN", "private-test")
	app := fiber.New()
	app.Post("/verify", verifyImportDraft)
	req := httptest.NewRequest("POST", "/verify", strings.NewReader("{}"))
	res, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if res.StatusCode != 401 {
		t.Fatal("internal verification is public")
	}
	p := exchange.Package{Version: "1", Roots: []string{"a"}, Models: []exchange.Model{{ID: "a", Name: "Legacy", Type: "atomic", Language: "java", Framework: "MS4 Me", Code: "import com.ms4systems.devs.core.model.impl.AtomicModelImpl; class Legacy extends PhaseAtomic {}"}}}
	data, _ := json.Marshal(map[string]any{"package": p, "rootId": "a", "maxTime": 100})
	req = httptest.NewRequest("POST", "/verify", bytes.NewReader(data))
	req.Header.Set("Authorization", "Bearer private-test")
	req.Header.Set("Content-Type", "application/json")
	res, err = app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != 422 {
		t.Fatalf("expected incompatible API to block, got %d", res.StatusCode)
	}
	var report map[string]string
	_ = json.NewDecoder(res.Body).Decode(&report)
	if !strings.Contains(report["error"], "API variant") {
		t.Fatal(report)
	}
	resolveImportedProfiles(&p)
	if err := services.CheckSimulation(draftModels(p)); err == nil {
		t.Fatal("regular simulation must enforce the same guard")
	}
}
