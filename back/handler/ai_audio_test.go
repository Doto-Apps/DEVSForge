package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"devsforge/database"
	"devsforge/model"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	postgrescontainer "github.com/testcontainers/testcontainers-go/modules/postgres"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestAIConnectionUpdateKeepsSecretsAtTheirURL(t *testing.T) {
	base, key, selected := "https://provider.test/v1", "secret", "chat"
	voice := "voice"
	if err := updateAIConnection(&base, &key, &selected, nil, nil, &voice); err != nil || key != "secret" || selected != "voice" {
		t.Fatal("partial update lost credentials", err)
	}
	other := "https://other.test/v1"
	if updateAIConnection(&base, &key, &selected, &other, nil, nil) == nil {
		t.Fatal("saved secret could move to another URL")
	}
	empty := ""
	if err := updateAIConnection(&base, &key, &selected, &other, &empty, nil); err != nil || key != "" || base != other {
		t.Fatal("explicit removal failed", err)
	}
	for _, url := range []string{"file:///tmp/key", "https://user:password@provider.test/v1", "https://provider.test/v1?key=secret", "https://provider.test/#fragment"} {
		if isValidAIURL(url) {
			t.Fatal("invalid base URL accepted", url)
		}
	}
	for _, data := range []string{`{"data":[{"id":"z"},{"id":"a"},{"id":"z"},{"id":""}]}`, `[{"id":"z"},{"id":"a"}]`} {
		models, err := parseProviderModels([]byte(data))
		if err != nil || len(models) != 2 || models[0].ID != "a" {
			t.Fatal("model normalization", models, err)
		}
	}
	if _, err := parseProviderModels([]byte(`{"error":"missing"}`)); err == nil {
		t.Fatal("invalid response accepted")
	}
}

func TestAIProviderSettingsAndDictation(t *testing.T) {
	ctx := context.Background()
	container, err := postgrescontainer.Run(ctx, "postgres:17-alpine", postgrescontainer.WithDatabase("dictation_test"), postgrescontainer.WithUsername("test"), postgrescontainer.WithPassword("test"), postgrescontainer.BasicWaitStrategies())
	if err != nil {
		t.Fatal(err)
	}
	defer container.Terminate(ctx)
	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	path, err := filepath.Abs("../database/migrations")
	if err != nil {
		t.Fatal(err)
	}
	migration, err := migrate.New("file://"+path, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer migration.Close()
	// Exercise upgrading an existing database, rather than just creating the new columns.
	if err = migration.Migrate(10); err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	defer func() { database.DB = previous }()
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	user := model.User{Username: "dictation", Email: "dictation@example.test", Password: "test-password"}
	other := model.User{Username: "other-user", Email: "other@example.test", Password: "test-password"}
	if err = db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err = db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	if err = db.Exec("INSERT INTO user_ai_settings(user_id,api_url,api_key,api_model) VALUES (?,?,?,?)", user.ID, "https://old.test/v1", "generation-secret", "chat-old").Error; err != nil {
		t.Fatal(err)
	}
	if err = migration.Up(); err != nil {
		t.Fatal(err)
	}
	var old model.UserAISettings
	if err = db.First(&old, "user_id = ?", user.ID).Error; err != nil || old.APIKey != "generation-secret" || old.TranscriptionAPIURL != "" {
		t.Fatal("migration changed existing configuration", err)
	}
	providerCalls := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalls++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/models":
			if r.Header.Get("Authorization") != "Bearer generation-secret" && r.Header.Get("Authorization") != "Bearer voice-secret" {
				t.Error("wrong discovery key")
			}
			io.WriteString(w, `{"data":[{"id":"chat-id"},{"id":"voice-id"}]}`)
		case "/v1/audio/transcriptions":
			if r.Header.Get("Authorization") != "Bearer voice-secret" {
				t.Error("generation key used for dictation")
			}
			if err := r.ParseMultipartForm(4 << 20); err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			if r.FormValue("model") != "voice-id" || r.FormValue("language") != "fr" {
				t.Error("wrong voice model or language")
			}
			file, header, err := r.FormFile("file")
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			defer file.Close()
			audio, _ := io.ReadAll(file)
			if string(audio) != "test-audio" || header.Filename != "dictation.webm" {
				t.Error("recording changed")
			}
			io.WriteString(w, `{"text":"Créer une maison avec deux pièces."}`)
		default:
			w.WriteHeader(404)
		}
	}))
	defer provider.Close()
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		id := c.Get("X-Test-User")
		if id == "" {
			return c.SendStatus(401)
		}
		c.Locals("user_id", id)
		return c.Next()
	})
	app.Get("/settings", getCurrentUserAISettings)
	app.Patch("/settings", patchCurrentUserAISettings)
	app.Post("/models", listCurrentUserAIModels)
	app.Post("/transcribe", transcribeCurrentUserAudio)
	do := func(method, path string, payload any, userID string) (int, []byte) {
		t.Helper()
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(method, path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User", userID)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(res.Body)
		return res.StatusCode, body
	}
	status, body := do("PATCH", "/settings", map[string]any{"apiUrl": provider.URL + "/v1", "apiKey": "generation-secret", "apiModel": "chat-id", "transcriptionApiUrl": provider.URL + "/v1", "transcriptionApiKey": "voice-secret", "transcriptionApiModel": "voice-id"}, user.ID)
	if status != 200 || bytes.Contains(body, []byte("generation-secret")) || bytes.Contains(body, []byte("voice-secret")) {
		t.Fatalf("save/masking: %d %s", status, body)
	}
	status, _ = do("PATCH", "/settings", map[string]any{"apiModel": "chat-updated"}, user.ID)
	if status != 200 {
		t.Fatal("partial save failed")
	}
	var saved model.UserAISettings
	db.First(&saved, "user_id = ?", user.ID)
	if saved.TranscriptionAPIKey != "voice-secret" || saved.APIKey != "generation-secret" {
		t.Fatal("partial save reset a secret")
	}
	for _, purpose := range []string{"generation", "transcription"} {
		status, body = do("POST", "/models", map[string]any{"purpose": purpose}, user.ID)
		if status != 200 || !bytes.Contains(body, []byte("voice-id")) {
			t.Fatalf("model discovery: %d %s", status, body)
		}
	}
	status, _ = do("POST", "/models", map[string]any{"purpose": "generation", "apiUrl": "https://other.test/v1"}, user.ID)
	if status != 400 {
		t.Fatal("hidden key could be forwarded")
	}
	status, body = do("GET", "/settings", nil, other.ID)
	if status != 200 || bytes.Contains(body, []byte("voice-secret")) || bytes.Contains(body, []byte(provider.URL)) {
		t.Fatal("settings crossed accounts")
	}
	var recording bytes.Buffer
	writer := multipart.NewWriter(&recording)
	part, _ := writer.CreateFormFile("file", "recorded.webm")
	part.Write([]byte("test-audio"))
	writer.WriteField("language", "fr")
	writer.Close()
	transcribe := func(id string) (int, []byte) {
		req := httptest.NewRequest("POST", "/transcribe", bytes.NewReader(recording.Bytes()))
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("X-Test-User", id)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(res.Body)
		return res.StatusCode, body
	}
	status, body = transcribe(user.ID)
	if status != 200 || !bytes.Contains(body, []byte("Créer une maison")) {
		t.Fatalf("transcription failed: %d %s", status, body)
	}
	calls := providerCalls
	status, _ = transcribe(other.ID)
	if status != 400 || providerCalls != calls {
		t.Fatal("other account used a voice credential")
	}
	// Capacity limits reject excess work before contacting the provider.
	transcriptionSlots <- struct{}{}
	transcriptionSlots <- struct{}{}
	calls = providerCalls
	status, _ = transcribe(user.ID)
	<-transcriptionSlots
	<-transcriptionSlots
	if status != 429 || providerCalls != calls {
		t.Fatal("transcription capacity limit was bypassed")
	}
	// File bounds are checked before dispatch.
	var large bytes.Buffer
	largeWriter := multipart.NewWriter(&large)
	largePart, _ := largeWriter.CreateFormFile("file", "recorded.webm")
	largePart.Write(bytes.Repeat([]byte{0}, maxDictationBytes+1))
	largeWriter.Close()
	largeReq := httptest.NewRequest("POST", "/transcribe", &large)
	largeReq.Header.Set("Content-Type", largeWriter.FormDataContentType())
	largeReq.Header.Set("X-Test-User", user.ID)
	largeRes, err := app.Test(largeReq)
	if err != nil {
		t.Fatal(err)
	}
	largeRes.Body.Close()
	if largeRes.StatusCode != 413 || providerCalls != calls {
		t.Fatal("oversized recording reached the provider")
	}
	// Provider 401s must not log users out of DEVSForge or leak response bodies.
	unauthorized := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401); fmt.Fprint(w, "voice-secret") }))
	defer unauthorized.Close()
	do("PATCH", "/settings", map[string]any{"transcriptionApiUrl": unauthorized.URL, "transcriptionApiKey": "voice-secret"}, user.ID)
	status, body = transcribe(user.ID)
	if status == 401 || bytes.Contains(body, []byte("voice-secret")) {
		t.Fatal("upstream error exposed credentials or became a login error")
	}
	do("PATCH", "/settings", map[string]any{"transcriptionApiKey": ""}, user.ID)
	db.First(&saved, "user_id = ?", user.ID)
	if saved.TranscriptionAPIKey != "" || saved.APIKey != "generation-secret" {
		t.Fatal("explicit deletion affected the wrong key")
	}
	// A downgrade removes only the new voice columns; generation settings survive.
	if err = migration.Steps(-1); err != nil {
		t.Fatal(err)
	}
	var generationKey string
	if err = db.Raw("SELECT api_key FROM user_ai_settings WHERE user_id = ?", user.ID).Scan(&generationKey).Error; err != nil || generationKey != "generation-secret" {
		t.Fatal("downgrade lost generation settings", err)
	}
	if err = migration.Up(); err != nil {
		t.Fatal(err)
	}
	status, body = do("POST", "/models", map[string]any{"purpose": "other"}, user.ID)
	if status != 400 || strings.Contains(string(body), "secret") {
		t.Fatal("invalid purpose accepted")
	}
}
