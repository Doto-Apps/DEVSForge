package handler

import (
	"context"
	"devsforge/database"
	jsonModel "devsforge/json"
	"devsforge/lib"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/prompt"
	"devsforge/request"
	"devsforge/response"
	"devsforge/services"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/openai/openai-go"
	"gorm.io/gorm"
)

var webAppSlugSanitizer = regexp.MustCompile(`[^a-z0-9]+`)

// SetupWebAppRoutes configures WebApp deployment routes.
func SetupWebAppRoutes(app *fiber.App) {
	group := app.Group("/webapp", middleware.Protected())

	group.Post("/skeleton/:modelId", generateWebAppSkeleton)
	group.Post("/generate", generateWebAppUISchema)
	group.Post("/deployment", createWebAppDeployment)
	group.Get("/deployment", listWebAppDeployments)
	group.Get("/deployment/:id", getWebAppDeployment)
	group.Patch("/deployment/:id", patchWebAppDeployment)
	group.Delete("/deployment/:id", deleteWebAppDeployment)
}

// generateWebAppSkeleton godoc
//
//	@Summary		Generate deterministic WebApp skeleton
//	@Description	Builds a deterministic WebApp contract and UI skeleton from a validated model.
//	@Tags			webapp
//	@Produce		json
//	@Param			modelId	path		string							true	"Root model ID"
//	@Success		200		{object}	response.WebAppSkeletonResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/webapp/skeleton/{modelId} [post]
func generateWebAppSkeleton(c *fiber.Ctx) error {
	modelID := strings.TrimSpace(c.Params("modelId"))
	if modelID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "modelId is required"})
	}

	userID := c.Locals("user_id").(string)
	models, rootModel, err := loadWebAppModelTree(modelID, userID)
	if err != nil {
		if isModelNotFoundError(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "model not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	contract, err := lib.BuildWebAppContract(models, modelID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build webapp contract: " + err.Error()})
	}

	uiSchema := lib.BuildWebAppSkeleton(contract, defaultWebAppName(rootModel.Name))

	return c.JSON(response.WebAppSkeletonResponse{
		Contract: contract,
		UISchema: uiSchema,
	})
}

// generateWebAppUISchema godoc
//
//	@Summary		Generate refined WebApp UI schema with AI
//	@Description	Refines a deterministic WebApp skeleton using an LLM while enforcing contract compatibility.
//	@Tags			webapp
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.GenerateWebAppRequest	true	"WebApp generation request"
//	@Success		200		{object}	response.WebAppSkeletonResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/webapp/generate [post]
func generateWebAppUISchema(c *fiber.Ctx) error {
	var req request.GenerateWebAppRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}

	modelID := strings.TrimSpace(req.ModelID)
	userPrompt := strings.TrimSpace(req.UserPrompt)
	if modelID == "" || userPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "modelId and userPrompt are required"})
	}

	userID := c.Locals("user_id").(string)
	models, rootModel, err := loadWebAppModelTree(modelID, userID)
	if err != nil {
		if isModelNotFoundError(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "model not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	contract, err := lib.BuildWebAppContract(models, modelID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build webapp contract: " + err.Error()})
	}

	baseSchema := lib.BuildWebAppSkeleton(contract, defaultWebAppName(rootModel.Name))
	if req.CurrentSchema != nil {
		baseSchema = *req.CurrentSchema
	}
	if err := lib.ValidateWebAppUISchemaAgainstContract(baseSchema, contract); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid currentSchema: " + err.Error()})
	}

	client, aiSettings, err := getOpenAIClientForUser(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	contractJSON, _ := json.Marshal(contract)
	baseSchemaJSON, _ := json.Marshal(baseSchema)
	webAppName := strings.TrimSpace(req.Name)
	if webAppName == "" {
		webAppName = defaultWebAppName(rootModel.Name)
	}

	fullPrompt := fmt.Sprintf(`
[WEBAPP GENERATION REQUEST]
Model ID: %s
Model Name: %s
WebApp Name: %s

Contract JSON:
%s

Current UI Schema JSON:
%s

User prompt:
%s

Return only JSON following the provided schema.
`, contract.ModelID, contract.ModelName, webAppName, string(contractJSON), string(baseSchemaJSON), userPrompt)

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("WebAppGeneration"),
		Description: openai.F("Refined WebApp UI schema preserving the DEVS contract"),
		Schema:      openai.F(GenerateSchema[response.WebAppGenerationLLMResponse]()),
		Strict:      openai.Bool(true),
	}

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(prompt.WebAppGeneratorPrompt),
			openai.UserMessage(fullPrompt),
		}),
		MaxCompletionTokens: openai.Int(4000),
		TopP:                openai.Float(0.7),
		Temperature:         openai.Float(0.7),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		Model: openai.F(aiSettings.APIModel),
	})
	if err != nil {
		slog.Error("OpenAI Chat Completion error", "error", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}
	if chat == nil || len(chat.Choices) == 0 {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	generationResponse := response.WebAppGenerationLLMResponse{}
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &generationResponse); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse AI response"})
	}

	if err := lib.ValidateWebAppUISchemaAgainstContract(generationResponse.UISchema, contract); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned invalid ui schema: " + err.Error()})
	}
	if webAppSchemasEquivalent(baseSchema, generationResponse.UISchema) {
		generationResponse.UISchema = applyDeterministicWebAppRefinement(baseSchema, userPrompt)
		if err := lib.ValidateWebAppUISchemaAgainstContract(generationResponse.UISchema, contract); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "fallback refinement failed: " + err.Error()})
		}
	}

	return c.JSON(response.WebAppSkeletonResponse{
		Contract: contract,
		UISchema: generationResponse.UISchema,
	})
}

// createWebAppDeployment godoc
//
//	@Summary		Create a WebApp deployment
//	@Description	Saves a deployable WebApp artifact bound to a model contract.
//	@Tags			webapp
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.CreateWebAppDeploymentRequest	true	"Deployment payload"
//	@Success		201		{object}	response.WebAppDeploymentResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/webapp/deployment [post]
func createWebAppDeployment(c *fiber.Ctx) error {
	var req request.CreateWebAppDeploymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}

	modelID := strings.TrimSpace(req.ModelID)
	name := strings.TrimSpace(req.Name)
	if modelID == "" || name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "modelId and name are required"})
	}

	userID := c.Locals("user_id").(string)
	models, rootModel, err := loadWebAppModelTree(modelID, userID)
	if err != nil {
		if isModelNotFoundError(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "model not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	contract, err := lib.BuildWebAppContract(models, modelID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build webapp contract: " + err.Error()})
	}

	uiSchema := lib.BuildWebAppSkeleton(contract, defaultWebAppName(rootModel.Name))
	if req.UISchema != nil {
		uiSchema = *req.UISchema
	}
	if err := lib.ValidateWebAppUISchemaAgainstContract(uiSchema, contract); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid uiSchema: " + err.Error()})
	}

	db := database.DB
	slug, err := generateUniqueWebAppSlug(db, name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate slug"})
	}

	deployment := model.WebAppDeployment{
		UserID:      userID,
		ModelID:     modelID,
		Name:        name,
		Slug:        slug,
		Description: strings.TrimSpace(req.Description),
		Prompt:      strings.TrimSpace(req.Prompt),
		IsPublic:    req.IsPublic,
		Contract:    contract,
		UISchema:    uiSchema,
	}

	if err := db.Create(&deployment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save deployment"})
	}

	return c.Status(fiber.StatusCreated).JSON(response.CreateWebAppDeploymentResponse(deployment))
}

// listWebAppDeployments godoc
//
//	@Summary		List WebApp deployments
//	@Description	Lists authenticated user's WebApp deployments (optionally filtered by modelId).
//	@Tags			webapp
//	@Produce		json
//	@Param			modelId	query		string	false	"Optional model ID filter"
//	@Success		200		{array}		response.WebAppDeploymentResponse
//	@Failure		500		{object}	map[string]string
//	@Router			/webapp/deployment [get]
func listWebAppDeployments(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	modelID := strings.TrimSpace(c.Query("modelId"))

	db := database.DB
	query := db.Where("user_id = ?", userID)
	if modelID != "" {
		query = query.Where("model_id = ?", modelID)
	}

	var deployments []model.WebAppDeployment
	if err := query.Order("updated_at DESC").Find(&deployments).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list deployments"})
	}

	res := make([]response.WebAppDeploymentResponse, 0, len(deployments))
	for _, deployment := range deployments {
		res = append(res, response.CreateWebAppDeploymentResponse(deployment))
	}

	return c.JSON(res)
}

// getWebAppDeployment godoc
//
//	@Summary		Get a WebApp deployment
//	@Description	Returns a WebApp deployment for the authenticated user.
//	@Tags			webapp
//	@Produce		json
//	@Param			id	path		string	true	"Deployment ID"
//	@Success		200	{object}	response.WebAppDeploymentResponse
//	@Failure		404	{object}	map[string]string
//	@Router			/webapp/deployment/{id} [get]
func getWebAppDeployment(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	deploymentID := strings.TrimSpace(c.Params("id"))
	if deploymentID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	deployment, err := getDeploymentByID(deploymentID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "deployment not found"})
	}

	return c.JSON(response.CreateWebAppDeploymentResponse(*deployment))
}

// patchWebAppDeployment godoc
//
//	@Summary		Update a WebApp deployment
//	@Description	Updates metadata and/or UI schema of a deployment.
//	@Tags			webapp
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string								true	"Deployment ID"
//	@Param			body	body		request.UpdateWebAppDeploymentRequest	true	"Patch payload"
//	@Success		200		{object}	response.WebAppDeploymentResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/webapp/deployment/{id} [patch]
func patchWebAppDeployment(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	deploymentID := strings.TrimSpace(c.Params("id"))
	if deploymentID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	var req request.UpdateWebAppDeploymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}

	deployment, err := getDeploymentByID(deploymentID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "deployment not found"})
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name cannot be empty"})
		}
		deployment.Name = name
	}
	if req.Description != nil {
		deployment.Description = strings.TrimSpace(*req.Description)
	}
	if req.Prompt != nil {
		deployment.Prompt = strings.TrimSpace(*req.Prompt)
	}
	if req.IsPublic != nil {
		deployment.IsPublic = *req.IsPublic
	}
	if req.UISchema != nil {
		if err := lib.ValidateWebAppUISchemaAgainstContract(*req.UISchema, deployment.Contract); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid uiSchema: " + err.Error()})
		}
		deployment.UISchema = *req.UISchema
	}

	if err := database.DB.Save(deployment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update deployment"})
	}

	return c.JSON(response.CreateWebAppDeploymentResponse(*deployment))
}

// deleteWebAppDeployment godoc
//
//	@Summary		Delete a WebApp deployment
//	@Description	Deletes a deployment owned by the authenticated user.
//	@Tags			webapp
//	@Param			id	path		string	true	"Deployment ID"
//	@Success		204	{object}	nil
//	@Failure		404	{object}	map[string]string
//	@Failure		500	{object}	map[string]string
//	@Router			/webapp/deployment/{id} [delete]
func deleteWebAppDeployment(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	deploymentID := strings.TrimSpace(c.Params("id"))
	if deploymentID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	deployment, err := getDeploymentByID(deploymentID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "deployment not found"})
	}

	if err := database.DB.Delete(deployment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete deployment"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func loadWebAppModelTree(modelID string, userID string) ([]model.Model, *model.Model, error) {
	models, err := services.GetModelRecursice(modelID, userID)
	if err != nil {
		return nil, nil, err
	}

	rootModel := findModelByID(models, modelID)
	if rootModel == nil {
		return nil, nil, fmt.Errorf("MODEL_NOT_FOUND")
	}

	return models, rootModel, nil
}

func findModelByID(models []model.Model, id string) *model.Model {
	for i := range models {
		if models[i].ID == id {
			return &models[i]
		}
	}
	return nil
}

func isModelNotFoundError(err error) bool {
	return err != nil && strings.Contains(strings.ToUpper(err.Error()), "MODEL_NOT_FOUND")
}

func getDeploymentByID(deploymentID string, userID string) (*model.WebAppDeployment, error) {
	db := database.DB
	var deployment model.WebAppDeployment
	err := db.Where("id = ? AND user_id = ?", deploymentID, userID).First(&deployment).Error
	if err != nil {
		return nil, err
	}
	return &deployment, nil
}

func defaultWebAppName(modelName string) string {
	name := strings.TrimSpace(modelName)
	if name == "" {
		return "WebApp"
	}
	return name + " WebApp"
}

func generateUniqueWebAppSlug(db *gorm.DB, rawName string) (string, error) {
	baseSlug := slugify(rawName)
	if baseSlug == "" {
		baseSlug = fmt.Sprintf("webapp-%d", time.Now().Unix())
	}

	slug := baseSlug
	for i := 2; ; i++ {
		var count int64
		if err := db.Model(&model.WebAppDeployment{}).Where("slug = ?", slug).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", baseSlug, i)
	}
}

func slugify(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	slug := webAppSlugSanitizer.ReplaceAllString(trimmed, "-")
	slug = strings.Trim(slug, "-")
	return slug
}

func webAppSchemasEquivalent(a jsonModel.WebAppUISchema, b jsonModel.WebAppUISchema) bool {
	aj, err := json.Marshal(a)
	if err != nil {
		return false
	}
	bj, err := json.Marshal(b)
	if err != nil {
		return false
	}
	return string(aj) == string(bj)
}

func applyDeterministicWebAppRefinement(
	base jsonModel.WebAppUISchema,
	userPrompt string,
) jsonModel.WebAppUISchema {
	refined := base
	trimmedPrompt := strings.TrimSpace(userPrompt)
	if len(trimmedPrompt) > 80 {
		trimmedPrompt = trimmedPrompt[:80]
	}

	if refined.Layout == "two-column" {
		refined.Layout = "single-column"
	} else if strings.TrimSpace(refined.Layout) == "" {
		refined.Layout = "single-column"
	}

	if strings.TrimSpace(refined.RunButtonLabel) == "" ||
		strings.EqualFold(strings.TrimSpace(refined.RunButtonLabel), "run simulation") {
		refined.RunButtonLabel = "Run experiment"
	} else {
		refined.RunButtonLabel = refined.RunButtonLabel + " now"
	}

	for i := range refined.Sections {
		section := refined.Sections[i]
		if strings.TrimSpace(section.Description) == "" {
			if trimmedPrompt != "" {
				section.Description = "Refined from prompt: " + trimmedPrompt
			} else {
				section.Description = "Refined runtime section."
			}
		}
		if section.Kind == jsonModel.WebAppUISectionKindRun &&
			!strings.Contains(strings.ToLower(section.Title), "refined") {
			section.Title = strings.TrimSpace(section.Title + " (refined)")
		}
		refined.Sections[i] = section
	}

	return refined
}
