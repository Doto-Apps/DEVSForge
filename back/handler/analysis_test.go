package handler

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestIntegrationCatalogueExposesAnalysisWithoutNativeLaunchers(t *testing.T) {
	app := fiber.New()
	SetupLanguageRoutes(app)
	response, err := app.Test(httptest.NewRequest("GET", "/integrations", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	var definitions []map[string]json.RawMessage
	if err = json.NewDecoder(response.Body).Decode(&definitions); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || len(definitions) != 3 {
		t.Fatalf("invalid catalogue response: %d", response.StatusCode)
	}
	for _, definition := range definitions {
		if _, exists := definition["servers"]; exists {
			t.Fatal("catalogue still exposes native server launch declarations")
		}
		var capabilities struct{ LSP bool }
		if err = json.Unmarshal(definition["capabilities"], &capabilities); err != nil || !capabilities.LSP {
			t.Fatalf("modeling sources are no longer available for browser analysis: %v", err)
		}
	}
}

func TestAnalysisSourcesETagAndUnknownVersion(t *testing.T) {
	app := fiber.New()
	SetupLanguageRoutes(app)
	url := "/integrations/xdevs-python/versions/1.0.0/analysis"
	response, err := app.Test(httptest.NewRequest("GET", url, nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			t.Error(err)
		}
	}()
	if response.StatusCode != 200 || response.Header.Get("ETag") == "" {
		t.Fatal("analysis sources are not cacheable")
	}
	request := httptest.NewRequest("GET", url, nil)
	request.Header.Set("If-None-Match", response.Header.Get("ETag"))
	cached, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := cached.Body.Close(); err != nil {
			t.Error(err)
		}
	}()
	if cached.StatusCode != 304 {
		t.Fatalf("got %d for matching fingerprint", cached.StatusCode)
	}
	unknown, err := app.Test(httptest.NewRequest("GET", "/integrations/xdevs-python/versions/missing/analysis", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := unknown.Body.Close(); err != nil {
			t.Error(err)
		}
	}()
	if unknown.StatusCode != 404 {
		t.Fatalf("unknown version returned %d", unknown.StatusCode)
	}
}
