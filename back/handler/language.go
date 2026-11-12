package handler

import (
	"devsforge-shared/integrations"
	"devsforge/response"
	"github.com/gofiber/fiber/v2"
)

// GetIntegrations lists installed versioned framework integrations.
// @Summary Get integrations
// @Tags Integrations
// @Produce json
// @Success 200 {array} integrations.Definition
// @Router /integrations [get]
func GetIntegrations(c *fiber.Ctx) error {
	defs, err := integrations.List()
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	return c.JSON(defs)
}

// GetIntegrationTemplate returns the template belonging to a specific profile version.
// @Summary Get integration template
// @Tags Integrations
// @Produce json
// @Param id path string true "Integration ID"
// @Param version path string true "Integration version"
// @Param name query string false "Source identifier" default(MyModel)
// @Success 200 {object} response.LanguageTemplateResponse
// @Router /integrations/{id}/versions/{version}/template [get]
func GetIntegrationTemplate(c *fiber.Ctx) error {
	d, err := integrations.Resolve(c.Params("id"), c.Params("version"), "")
	if err != nil {
		return SendRequestError(c, 404, err)
	}
	return renderIntegrationTemplate(c, d)
}

// GetIntegrationAnalysis provides the actual library sources for local analysis.
// @Summary Get integration analysis sources
// @Tags Integrations
// @Produce json
// @Param id path string true "Integration ID"
// @Param version path string true "Integration version"
// @Success 200 {object} integrations.AnalysisSources
// @Router /integrations/{id}/versions/{version}/analysis [get]
func GetIntegrationAnalysis(c *fiber.Ctx) error {
	d, err := integrations.Resolve(c.Params("id"), c.Params("version"), "")
	if err != nil {
		return SendRequestError(c, 404, err)
	}
	etag := `"` + d.Digest + `"`
	c.Set("ETag", etag)
	c.Set("Cache-Control", "public, max-age=0, must-revalidate")
	if c.Get("If-None-Match") == etag {
		return c.SendStatus(fiber.StatusNotModified)
	}
	sources, err := d.AnalysisSources()
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	return c.JSON(sources)
}
func renderIntegrationTemplate(c *fiber.Ctx, d integrations.Definition) error {
	code, err := d.RenderTemplate(c.Query("name", "MyModel"))
	if err != nil {
		return SendRequestError(c, 400, err)
	}
	return c.JSON(response.LanguageTemplateResponse{Language: d.Language, Code: code})
}

// GetLanguages is the compatibility projection of the integration catalogue.
// @Summary Get available languages
// @Tags Languages
// @Produce json
// @Success 200 {object} response.LanguageListResponse
// @Router /languages [get]
func GetLanguages(c *fiber.Ctx) error {
	defs, err := integrations.List()
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	result := []response.LanguageInfo{}
	for _, d := range defs {
		if d.LegacyLanguage != "" {
			result = append(result, response.LanguageInfo{ID: d.LegacyLanguage, Name: d.Name, Extension: d.Extension, Description: d.Framework})
		}
	}
	return c.JSON(response.LanguageListResponse{Languages: result})
}

// GetLanguageTemplate adapts legacy language identifiers to catalogue entries.
// @Summary Get language template
// @Tags Languages
// @Produce json
// @Param lang path string true "Legacy language"
// @Param name query string false "Source identifier" default(MyModel)
// @Success 200 {object} response.LanguageTemplateResponse
// @Router /languages/{lang}/template [get]
func GetLanguageTemplate(c *fiber.Ctx) error {
	d, err := integrations.Resolve("", "", c.Params("lang"))
	if err != nil {
		return SendRequestError(c, 400, err)
	}
	return renderIntegrationTemplate(c, d)
}
func SetupLanguageRoutes(app *fiber.App) {
	app.Get("/integrations", GetIntegrations)
	app.Get("/integrations/:id/versions/:version/template", GetIntegrationTemplate)
	app.Get("/integrations/:id/versions/:version/analysis", GetIntegrationAnalysis)
	app.Get("/languages", GetLanguages)
	app.Get("/languages/:lang/template", GetLanguageTemplate)
}
