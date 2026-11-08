package handler

import (
	"errors"
	"net/url"
	"strings"

	"devsforge/database"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// getCurrentUserAISettings godoc
//
//	@Summary		Get current user AI settings
//	@Description	Returns the current user's AI provider settings.
//	@Tags			user
//	@Produce		json
//	@Success		200	{object}	response.UserAISettingsResponse
//	@Failure		500	{object}	map[string]any
//	@Router			/user/settings/ai [get]
func getCurrentUserAISettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	db := database.DB

	var settings model.UserAISettings
	err := db.Where("user_id = ?", userID).First(&settings).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(response.UserAISettingsResponse{
				APIURL:    "",
				APIModel:  "",
				HasAPIKey: false,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load AI settings",
		})
	}

	return c.JSON(toUserAISettingsResponse(settings))
}

// patchCurrentUserAISettings godoc
//
//	@Summary		Update current user AI settings
//	@Description	Updates generation and transcription connections. Omitted keys are preserved; an explicit empty key removes it.
//	@Tags			user
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.UpdateUserAISettingsRequest	true	"AI settings to update"
//	@Success		200		{object}	response.UserAISettingsResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/user/settings/ai [patch]
func patchCurrentUserAISettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var req request.UpdateUserAISettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	db := database.DB
	settings := model.UserAISettings{UserID: userID}
	err := db.Where("user_id = ?", userID).First(&settings).Error
	isNew := errors.Is(err, gorm.ErrRecordNotFound)
	if err != nil && !isNew {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load AI settings",
		})
	}

	if err := updateAIConnection(&settings.APIURL, &settings.APIKey, &settings.APIModel, req.APIURL, req.APIKey, req.APIModel); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Generation: " + err.Error()})
	}
	if err := updateAIConnection(&settings.TranscriptionAPIURL, &settings.TranscriptionAPIKey, &settings.TranscriptionAPIModel, req.TranscriptionAPIURL, req.TranscriptionAPIKey, req.TranscriptionAPIModel); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Transcription: " + err.Error()})
	}

	if isNew {
		if err := db.Create(&settings).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to save AI settings",
			})
		}
	} else {
		if err := db.Save(&settings).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to update AI settings",
			})
		}
	}

	return c.JSON(toUserAISettingsResponse(settings))
}

func toUserAISettingsResponse(settings model.UserAISettings) response.UserAISettingsResponse {
	hasKey := strings.TrimSpace(settings.APIKey) != ""

	return response.UserAISettingsResponse{
		APIURL:                    settings.APIURL,
		APIModel:                  settings.APIModel,
		HasAPIKey:                 hasKey,
		APIKeyMasked:              maskSecret(settings.APIKey),
		TranscriptionAPIURL:       settings.TranscriptionAPIURL,
		TranscriptionAPIModel:     settings.TranscriptionAPIModel,
		HasTranscriptionAPIKey:    strings.TrimSpace(settings.TranscriptionAPIKey) != "",
		TranscriptionAPIKeyMasked: maskSecret(settings.TranscriptionAPIKey),
	}
}

func maskSecret(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 4 {
		return "****"
	}
	return "****" + trimmed[len(trimmed)-4:]
}

func isValidAIURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	return parsed.Hostname() != "" && parsed.User == nil && parsed.RawQuery == "" && parsed.Fragment == ""
}

// Require an explicit key decision when a URL changes; never forward a hidden
// saved key to a newly entered provider URL.
func updateAIConnection(apiURL, apiKey, apiModel *string, nextURL, nextKey, nextModel *string) error {
	if nextURL != nil {
		value := strings.TrimRight(strings.TrimSpace(*nextURL), "/")
		if value != "" && !isValidAIURL(value) {
			return errors.New("API URL must be an http(s) base URL without credentials, query or fragment")
		}
		if value != strings.TrimRight(*apiURL, "/") && *apiKey != "" && nextKey == nil {
			return errors.New("enter a key for the new URL, or explicitly remove the stored key")
		}
		*apiURL = value
	}
	if nextKey != nil {
		*apiKey = strings.TrimSpace(*nextKey)
	}
	if nextModel != nil {
		*apiModel = strings.TrimSpace(*nextModel)
	}
	return nil
}
