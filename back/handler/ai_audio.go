package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"devsforge/database"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const maxDictationBytes = 3 * 1024 * 1024
const maxProviderResponseBytes = 1024 * 1024

var transcriptionSlots = make(chan struct{}, 2)

func loadUserAISettings(userID string) (model.UserAISettings, error) {
	settings := model.UserAISettings{UserID: userID}
	err := database.DB.Where("user_id = ?", userID).First(&settings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = nil
	}
	return settings, err
}

func providerClient(timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
}

// listCurrentUserAIModels godoc
// @Summary List models exposed by a configured compatible API
// @Description Discovers model IDs using saved or supplied credentials. This does not verify transcription or structured-output capabilities.
// @Tags user
// @Accept json
// @Produce json
// @Param body body request.ListAIModelsRequest true "Connection to discover"
// @Success 200 {object} response.AIProviderModelsResponse
// @Failure 400 {object} map[string]any
// @Failure 502 {object} map[string]any
// @Router /user/settings/ai/models [post]
func listCurrentUserAIModels(c *fiber.Ctx) error {
	var req request.ListAIModelsRequest
	if c.BodyParser(&req) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	settings, err := loadUserAISettings(c.Locals("user_id").(string))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load provider settings"})
	}
	var base, key, selected string
	switch req.Purpose {
	case "generation":
		base, key, selected = settings.APIURL, settings.APIKey, settings.APIModel
	case "transcription":
		base, key, selected = settings.TranscriptionAPIURL, settings.TranscriptionAPIKey, settings.TranscriptionAPIModel
	default:
		return c.Status(400).JSON(fiber.Map{"error": "purpose must be generation or transcription"})
	}
	if err := updateAIConnection(&base, &key, &selected, req.APIURL, req.APIKey, nil); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if base == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Enter an API base URL first"})
	}
	httpReq, err := http.NewRequestWithContext(c.UserContext(), http.MethodGet, strings.TrimRight(base, "/")+"/models", nil)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid provider URL"})
	}
	if key != "" {
		httpReq.Header.Set("Authorization", "Bearer "+key)
	}
	upstream, err := providerClient(20 * time.Second).Do(httpReq)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "Provider could not be reached. Check its URL and network access."})
	}
	defer func() { _ = upstream.Body.Close() }()
	if upstream.StatusCode < 200 || upstream.StatusCode >= 300 {
		return providerFailure(c, upstream.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(upstream.Body, maxProviderResponseBytes+1))
	if err != nil || len(data) > maxProviderResponseBytes {
		return c.Status(502).JSON(fiber.Map{"error": "Provider model response is too large or unreadable"})
	}
	models, err := parseProviderModels(data)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "This API did not return a compatible model list. Enter the model ID manually."})
	}
	return c.JSON(response.AIProviderModelsResponse{Models: models})
}

func parseProviderModels(data []byte) ([]response.AIProviderModelResponse, error) {
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	var models []response.AIProviderModelResponse
	if len(bytes.TrimSpace(data)) > 0 && bytes.TrimSpace(data)[0] == '[' {
		if err := json.Unmarshal(data, &models); err != nil {
			return nil, err
		}
	} else {
		if err := json.Unmarshal(data, &envelope); err != nil {
			return nil, err
		}
		if envelope.Data == nil || bytes.Equal(envelope.Data, []byte("null")) {
			return nil, errors.New("missing model data")
		}
		if err := json.Unmarshal(envelope.Data, &models); err != nil {
			return nil, err
		}
	}
	result := make([]response.AIProviderModelResponse, 0, len(models))
	seen := map[string]bool{}
	for _, item := range models {
		id := strings.TrimSpace(item.ID)
		if id == "" || len(id) > 512 || seen[id] {
			continue
		}
		seen[id] = true
		result = append(result, response.AIProviderModelResponse{ID: id})
		if len(result) == 1000 {
			break
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result, nil
}

// transcribeCurrentUserAudio godoc
// @Summary Transcribe a short dictation with the current user's voice provider
// @Description Sends at most 3 MiB to the saved compatible /audio/transcriptions endpoint. The returned text never starts model generation.
// @Tags user
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Recorded audio (WebM, Ogg, MP4/M4A, WAV or MP3), at most 3 MiB"
// @Param language formData string false "Optional ISO language hint"
// @Success 200 {object} response.TranscriptionResponse
// @Failure 400 {object} map[string]any
// @Failure 413 {object} map[string]any
// @Failure 429 {object} map[string]any
// @Failure 502 {object} map[string]any
// @Router /user/settings/ai/transcriptions [post]
func transcribeCurrentUserAudio(c *fiber.Ctx) error {
	settings, err := loadUserAISettings(c.Locals("user_id").(string))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load transcription settings"})
	}
	base := strings.TrimRight(strings.TrimSpace(settings.TranscriptionAPIURL), "/")
	if base == "" || settings.TranscriptionAPIModel == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Configure a transcription URL and model in Settings first."})
	}
	if !isValidAIURL(base) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid transcription API URL"})
	}
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "An audio file is required"})
	}
	if file.Size <= 0 || file.Size > maxDictationBytes {
		return c.Status(413).JSON(fiber.Map{"error": "Dictation must be between 1 byte and 3 MiB."})
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".webm": true, ".ogg": true, ".mp4": true, ".m4a": true, ".wav": true, ".mp3": true}
	if !allowed[ext] {
		return c.Status(400).JSON(fiber.Map{"error": "Unsupported audio format"})
	}
	language := strings.TrimSpace(c.FormValue("language"))
	if len(language) > 12 || strings.ContainsAny(language, "\r\n") {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid language hint"})
	}
	select {
	case transcriptionSlots <- struct{}{}:
		defer func() { <-transcriptionSlots }()
	default:
		return c.Status(429).JSON(fiber.Map{"error": "Transcription is busy. Try again shortly."})
	}
	input, err := file.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Could not read the recording"})
	}
	defer func() { _ = input.Close() }()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "dictation"+ext)
	if err != nil {
		return c.SendStatus(500)
	}
	if _, err = io.Copy(part, io.LimitReader(input, maxDictationBytes+1)); err != nil {
		return c.SendStatus(500)
	}
	if err = writer.WriteField("model", settings.TranscriptionAPIModel); err != nil {
		return c.SendStatus(500)
	}
	if language != "" {
		if err = writer.WriteField("language", language); err != nil {
			return c.SendStatus(500)
		}
	}
	if err = writer.Close(); err != nil {
		return c.SendStatus(500)
	}
	httpReq, err := http.NewRequestWithContext(c.UserContext(), http.MethodPost, base+"/audio/transcriptions", &body)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid provider URL"})
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	if settings.TranscriptionAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+settings.TranscriptionAPIKey)
	}
	upstream, err := providerClient(90 * time.Second).Do(httpReq)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "Transcription failed or timed out. Check your provider connection."})
	}
	defer func() { _ = upstream.Body.Close() }()
	if upstream.StatusCode < 200 || upstream.StatusCode >= 300 {
		return providerFailure(c, upstream.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(upstream.Body, maxProviderResponseBytes+1))
	if err != nil || len(data) > maxProviderResponseBytes {
		return c.Status(502).JSON(fiber.Map{"error": "Provider transcription response is too large or unreadable"})
	}
	var result response.TranscriptionResponse
	if json.Unmarshal(data, &result) != nil || strings.TrimSpace(result.Text) == "" {
		return c.Status(502).JSON(fiber.Map{"error": "Provider returned no transcript. Check the model and recording."})
	}
	result.Text = strings.TrimSpace(result.Text)
	return c.JSON(result)
}

func providerFailure(c *fiber.Ctx, status int) error {
	// Provider authorization failures are not application login failures (401).
	if status == 401 || status == 403 {
		return c.Status(400).JSON(fiber.Map{"error": "Provider rejected the API key or its permissions."})
	}
	if status == 429 {
		return c.Status(429).JSON(fiber.Map{"error": "Provider capacity or quota exceeded. Try again later."})
	}
	return c.Status(502).JSON(fiber.Map{"error": fmt.Sprintf("Provider returned HTTP %d. Check the API URL, model and supported operation.", status)})
}
