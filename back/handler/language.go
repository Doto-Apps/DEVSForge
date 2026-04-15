package handler

import (
	"bytes"
	"text/template"

	"devsforge/enum"
	"devsforge/response"
	"devsforge/templates"

	"github.com/gofiber/fiber/v2"
)

// Language metadata
var languageInfoMap = map[enum.ModelLanguage]response.LanguageInfo{
	enum.ModelLanguageGo: {
		ID:          "go",
		Name:        "Go",
		Extension:   ".go",
		Description: "Modèle DEVS en Go - performant et typé statiquement",
	},
	enum.ModelLanguagePython: {
		ID:          "python",
		Name:        "Python",
		Extension:   ".py",
		Description: "Modèle DEVS en Python - simple et flexible",
	},
}

// GetLanguages returns the list of available languages
//
//	@Summary		Get available languages
//	@Description	Returns the list of programming languages available for DEVS models
//	@Tags			Languages
//	@Produce		json
//	@Success		200	{object}	response.LanguageListResponse
//	@Router			/languages [get]
func GetLanguages(c *fiber.Ctx) error {
	languages := make([]response.LanguageInfo, 0, len(enum.AllModelLanguages()))

	for _, lang := range enum.AllModelLanguages() {
		if info, ok := languageInfoMap[lang]; ok {
			languages = append(languages, info)
		}
	}

	return c.JSON(response.LanguageListResponse{
		Languages: languages,
	})
}

// GetLanguageTemplate returns the code template for a specific language
//
//	@Summary		Get language template
//	@Description	Returns the atomic model code template for the specified language
//	@Tags			Languages
//	@Produce		json
//	@Param			lang	path		string	true	"Language ID (go, python)"
//	@Param			name	query		string	false	"Model name to inject in template"	default(MyModel)
//	@Success		200		{object}	response.LanguageTemplateResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/languages/{lang}/template [get]
func GetLanguageTemplate(c *fiber.Ctx) error {
	langParam := c.Params("lang")
	modelName := c.Query("name", "MyModel")

	// Validate language
	lang := enum.ModelLanguage(langParam)
	if !lang.IsValid() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid language: " + langParam,
		})
	}

	// Get template path based on language
	var templatePath string
	switch lang {
	case enum.ModelLanguageGo:
		templatePath = "go/atomic.tmpl"
	case enum.ModelLanguagePython:
		templatePath = "python/atomic.tmpl"
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Template not found for language: " + langParam,
		})
	}

	// Read template file
	tmplContent, err := templates.FS.ReadFile(templatePath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read template: " + err.Error(),
		})
	}

	// Parse and execute template
	tmpl, err := template.New("atomic").Parse(string(tmplContent))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to parse template: " + err.Error(),
		})
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, map[string]string{
		"Name": modelName,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to execute template: " + err.Error(),
		})
	}

	return c.JSON(response.LanguageTemplateResponse{
		Language: langParam,
		Code:     buf.String(),
	})
}

// SetupLanguageRoutes registers language-related routes
func SetupLanguageRoutes(app *fiber.App) {
	app.Get("/languages", GetLanguages)
	app.Get("/languages/:lang/template", GetLanguageTemplate)
}
