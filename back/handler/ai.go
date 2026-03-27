package handler

import (
	"context"
	"devsforge/database"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/prompt"
	"devsforge/request"
	"devsforge/response"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"gorm.io/gorm"
)

// SetupAiRoutes configures AI-related routes.
func SetupAiRoutes(app *fiber.App) {
	group := app.Group("/ai", middleware.Protected())

	group.Post("/generate-diagram", generateDiagram)
	group.Post("/generate-ef-structure", generateEFStructure)
	group.Post("/generate-model", generateModel)
	group.Post("/generate-documentation", generateDocumentation)
}

// Request structures

// Retrieves the OpenAI API client configured by the authenticated user.
func getOpenAIClientForUser(userID string) (*openai.Client, model.UserAISettings, error) {
	db := database.DB
	var settings model.UserAISettings
	if err := db.Where("user_id = ?", userID).First(&settings).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, model.UserAISettings{}, fmt.Errorf("AI settings are not configured for this user")
		}
		return nil, model.UserAISettings{}, err
	}

	settings.APIURL = strings.TrimSpace(settings.APIURL)
	settings.APIKey = strings.TrimSpace(settings.APIKey)
	settings.APIModel = strings.TrimSpace(settings.APIModel)

	if settings.APIURL == "" || settings.APIKey == "" || settings.APIModel == "" {
		return nil, model.UserAISettings{}, fmt.Errorf("AI settings are incomplete: apiUrl, apiKey and apiModel are required")
	}

	client := openai.NewClient(
		option.WithAPIKey(settings.APIKey),
		option.WithBaseURL(settings.APIURL),
	)

	return client, settings, nil
}

func GenerateSchema[T any]() interface{} {
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:            true,
	}
	var v T
	schema := reflector.Reflect(v)
	return schema
}

// GenerateDiagram godoc
//
//	@Summary		Generate a diagram
//	@Description	Sends a prompt to OpenAI to generate a diagram in JSON format based on a strict schema.
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.GenerateDiagramRequest	true	"Data required to generate a diagram"
//	@Success		200		{object}	response.DiagramResponse		"Generated diagram"
//	@Failure		400		{object}	map[string]string				"Invalid request"
//	@Failure		500		{object}	map[string]string				"AI processing error"
//	@Router			/ai/generate-diagram [post]
func generateDiagram(c *fiber.Ctx) error {
	var request request.GenerateDiagramRequest

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if request.DiagramName == "" || request.UserPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "All fields are required"})
	}

	fullPrompt := fmt.Sprintf(`
		[DIAGRAM REQUEST]
		Diagram Name: %s
		User Description: %s
		Please respond ONLY in JSON following the provided schema.
	`, request.DiagramName, request.UserPrompt)

	userID := c.Locals("user_id").(string)
	client, aiSettings, err := getOpenAIClientForUser(userID)
	if err != nil {
		log.Println("OpenAI error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("Diagram"),
		Description: openai.F("Diagram strutural plan"),
		Schema:      openai.F(GenerateSchema[response.DiagramResponse]()),
		Strict:      openai.Bool(true),
	}

	Messages := []openai.ChatCompletionMessageParamUnion{
		openai.SystemMessage(prompt.DiagramPrompt),
	}
	for _, message := range request.PastResponses {
		if message.Role == "user" {
			Messages = append(Messages, openai.UserMessage(message.Content))
		}
		if message.Role == "assistant" {
			Messages = append(Messages, openai.AssistantMessage(message.Content))
		}
	}
	Messages = append(Messages, openai.UserMessage(fullPrompt))

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages:            openai.F(Messages),
		MaxCompletionTokens: openai.Int(4000),
		TopP:                openai.Float(0.7),
		Temperature:         openai.Float(0.9),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		// only certain models can perform structured outputs
		Model: openai.F(aiSettings.APIModel),
	})

	if err != nil {
		log.Println("OpenAI Chat Completion error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	if chat == nil || len(chat.Choices) == 0 {
		log.Println("OpenAI returned empty response")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	response := response.DiagramResponse{}
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &response); err != nil {
		log.Println("JSON Unmarshal error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse AI response"})
	}

	return c.JSON(response)
}

// GenerateEFStructure godoc
//
//	@Summary		Generate an experimental frame structure
//	@Description	Generates an Experimental Frame (EF) structure around a target model for validation scenarios.
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.GenerateEFStructureRequest			true	"Data required to generate EF structure"
//	@Success		200		{object}	response.ExperimentalFrameStructureResponse	"Generated EF structure"
//	@Failure		400		{object}	map[string]string							"Invalid request"
//	@Failure		404		{object}	map[string]string							"Target model not found"
//	@Failure		500		{object}	map[string]string							"AI processing error"
//	@Router			/ai/generate-ef-structure [post]
func generateEFStructure(c *fiber.Ctx) error {
	var request request.GenerateEFStructureRequest

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if request.TargetModelID == "" || request.UserPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "TargetModelID and UserPrompt are required"})
	}

	db := database.DB
	var target model.Model
	if err := db.First(&target, "user_id = ? AND id = ?", c.Locals("user_id").(string), request.TargetModelID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target model not found"})
	}

	roomName := strings.TrimSpace(request.RoomName)
	if roomName == "" {
		roomName = fmt.Sprintf("Room - %s", target.Name)
	}

	targetPortsContext := buildTargetPortsContext(target)
	targetComponentsContext := buildTargetComponentsContext(target)

	fullPrompt := fmt.Sprintf(`
[EXPERIMENTAL FRAME REQUEST]
Room Name: %s
Target Model ID: %s
Target Model Name: %s
Target Model Type: %s
Target Model Ports:
%s
%s
Hard Constraint:
- The MUT model must reuse the exact Target Model port names and directions.
- Do not rename MUT ports even if the user asks different names.

Validation Intent:
%s

Please respond ONLY in JSON following the provided schema.
`, roomName, target.ID, target.Name, target.Type, targetPortsContext, targetComponentsContext, request.UserPrompt)

	userID := c.Locals("user_id").(string)
	client, aiSettings, err := getOpenAIClientForUser(userID)
	if err != nil {
		log.Println("OpenAI error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("ExperimentalFrameStructure"),
		Description: openai.F("Experimental frame structure around a model-under-test"),
		Schema:      openai.F(GenerateSchema[response.ExperimentalFrameStructureResponse]()),
		Strict:      openai.Bool(true),
	}

	messages := []openai.ChatCompletionMessageParamUnion{
		openai.SystemMessage(prompt.ExperimentalFrameStructurePrompt),
	}
	for _, message := range request.PastResponses {
		if message.Role == "user" {
			messages = append(messages, openai.UserMessage(message.Content))
		}
		if message.Role == "assistant" {
			messages = append(messages, openai.AssistantMessage(message.Content))
		}
	}
	messages = append(messages, openai.UserMessage(fullPrompt))

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages:            openai.F(messages),
		MaxCompletionTokens: openai.Int(4000),
		TopP:                openai.Float(0.7),
		Temperature:         openai.Float(0.9),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		Model: openai.F(aiSettings.APIModel),
	})

	if err != nil {
		log.Println("OpenAI Chat Completion error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	if chat == nil || len(chat.Choices) == 0 {
		log.Println("OpenAI returned empty response")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	rawEFResponse := strings.TrimSpace(chat.Choices[0].Message.Content)
	log.Printf("[EF AI RAW RESPONSE] %s", truncateForLog(rawEFResponse, 8000))

	efResponse := response.ExperimentalFrameStructureResponse{}
	if err := json.Unmarshal([]byte(rawEFResponse), &efResponse); err != nil {
		log.Println("JSON Unmarshal error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse AI response"})
	}
	log.Printf(
		"[EF AI PARSED] root=%s mut=%s models=%d connections=%d",
		efResponse.RootModelID,
		efResponse.ModelUnderTestID,
		len(efResponse.Models),
		len(efResponse.Connections),
	)

	// Server-side normalization and validation guardrails.
	efResponse.RoomName = roomName
	efResponse.TargetModelID = target.ID

	if err := validateEFStructureResponse(&efResponse, target); err != nil {
		log.Println("EF structure validation error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned invalid EF structure: " + err.Error()})
	}

	return c.JSON(efResponse)
}

// GenerateModel godoc
//
//	@Summary		Generate a model
//	@Description	Sends a prompt to OpenAI to generate a DEVS model code in Python or Go.
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.GenerateModelRequest	true	"Data required to generate a model"
//	@Success		200		{object}	response.GeneratedModelResponse	"Generated model code"
//	@Failure		400		{object}	map[string]string				"Invalid request"
//	@Failure		500		{object}	map[string]string				"AI processing error"
//	@Router			/ai/generate-model [post]
func generateModel(c *fiber.Ctx) error {
	var req request.GenerateModelRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ModelName == "" || req.Language == "" || req.UserPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ModelName, Language, and UserPrompt are required"})
	}

	// Validate language
	if req.Language != "python" && req.Language != "go" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Language must be 'python' or 'go'"})
	}

	userID := c.Locals("user_id").(string)
	client, aiSettings, err := getOpenAIClientForUser(userID)
	if err != nil {
		log.Println("OpenAI error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Reuse-first: extract keywords and rank existing models with simple Jaccard.
	promptKeywords, kwErr := extractPromptKeywords(client, aiSettings.APIModel, req.UserPrompt)
	if kwErr != nil {
		log.Printf("keyword extraction warning: %v", kwErr)
	}
	candidates, candidateErr := getReuseCandidates(
		database.DB,
		userID,
		req.Language,
		promptKeywords,
		reuseTopK,
		reuseLowThreshold,
	)
	if candidateErr != nil {
		log.Printf("reuse candidate ranking warning: %v", candidateErr)
		candidates = nil
	}
	reuseModelID := ""
	if req.ReuseModelID != nil {
		reuseModelID = strings.TrimSpace(*req.ReuseModelID)
	}
	hasReuseChoice := req.ForceScratch || reuseModelID != ""

	if len(candidates) > 0 && !hasReuseChoice {
		return c.JSON(response.GeneratedModelResponse{
			Code:            "",
			Keywords:        promptKeywords,
			ReuseCandidates: toReuseCandidatesResponse(candidates),
			ReuseMode:       "selection-required",
		})
	}

	selectedCandidate := pickReuseCandidate(candidates, req.ReuseModelID, req.ForceScratch)
	if reuseModelID != "" && selectedCandidate == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid reuseModelId. Choose one candidate from the provided shortlist.",
		})
	}

	contextCandidates := candidates
	if req.ForceScratch {
		contextCandidates = nil
	}
	reuseContext := buildReuseContext(promptKeywords, contextCandidates, selectedCandidate)
	previousModelsCode := buildPreviousCodeWithReuse(req.PreviousModelsCode, selectedCandidate)

	// Build ports context
	var portsContext strings.Builder
	portsContext.WriteString("## Model Ports\n")
	for _, port := range req.Ports {
		fmt.Fprintf(&portsContext, "- %s (%s): %s\n", port.Name, port.Type, port.ID)
	}

	// Get the appropriate prompt with template
	systemPrompt, err := prompt.BuildModelPromptWithContext(req.Language)
	if err != nil {
		log.Println("Failed to build model prompt:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare prompt"})
	}

	fullPrompt := fmt.Sprintf(`
[MODEL REQUEST]
Model Name: %s
Language: %s

%s

%s

Previous Models Code:
%s

User Description: %s

Respond ONLY with the %s code in JSON as { "code": "your_code_here" }
`, req.ModelName, req.Language, portsContext.String(), reuseContext, previousModelsCode, req.UserPrompt, req.Language)

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("Model"),
		Description: openai.F("Model code"),
		Schema:      openai.F(GenerateSchema[response.GeneratedModelLLMResponse]()),
		Strict:      openai.Bool(true),
	}

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(systemPrompt),
			openai.UserMessage(fullPrompt),
		}),
		MaxCompletionTokens: openai.Int(4000),
		TopP:                openai.Float(0.7),
		Temperature:         openai.Float(0.9),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		Model: openai.F(aiSettings.APIModel),
	})

	if err != nil {
		log.Println("OpenAI Chat Completion error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	if chat == nil || len(chat.Choices) == 0 {
		log.Println("OpenAI returned empty response")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	llmResponse := response.GeneratedModelLLMResponse{}
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &llmResponse); err != nil {
		log.Println("JSON Unmarshal error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse AI response"})
	}

	apiResponse := response.GeneratedModelResponse{
		Code:            llmResponse.Code,
		Keywords:        promptKeywords,
		ReuseCandidates: toReuseCandidatesResponse(candidates),
		ReuseMode:       "scratch",
	}
	if selectedCandidate != nil {
		selected := toReuseCandidateResponse(*selectedCandidate)
		apiResponse.ReuseUsed = &selected
		apiResponse.ReuseMode = "reuse-first"
	}

	return c.JSON(apiResponse)
}

// GenerateDocumentation godoc
//
//	@Summary		Generate model documentation
//	@Description	Analyzes a DEVS model and generates description, keywords, and role using AI.
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.GenerateDocumentationRequest	true	"Model ID to generate documentation for"
//	@Success		200		{object}	response.GeneratedDocumentationResponse	"Generated documentation"
//	@Failure		400		{object}	map[string]string						"Invalid request"
//	@Failure		404		{object}	map[string]string						"Model not found"
//	@Failure		500		{object}	map[string]string						"AI processing error"
//	@Router			/ai/generate-documentation [post]
func generateDocumentation(c *fiber.Ctx) error {
	var req request.GenerateDocumentationRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ModelID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Model ID is required"})
	}

	// Fetch the model from database
	db := database.DB
	var m model.Model
	if err := db.First(&m, "user_id = ? AND id = ?", c.Locals("user_id").(string), req.ModelID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Model not found"})
	}

	// Build ports description
	var portsIn, portsOut []string
	for _, port := range m.Ports {
		if port.Type == "in" {
			portsIn = append(portsIn, port.ID)
		} else {
			portsOut = append(portsOut, port.ID)
		}
	}

	// Build components description (for coupled models)
	var componentsDesc string
	if m.Type == "coupled" && len(m.Components) > 0 {
		var compNames []string
		for _, comp := range m.Components {
			compNames = append(compNames, comp.ModelID)
		}
		componentsDesc = fmt.Sprintf("Components: %s", strings.Join(compNames, ", "))
	}

	fullPrompt := fmt.Sprintf(`
[MODEL ANALYSIS REQUEST]
Model Name: %s
Model Type: %s
Input Ports: %v
Output Ports: %v
%s

Code:
%s

Please analyze this DEVS model and generate:
1. A clear description of what it does
2. Relevant keywords for search and RAG-based reuse
3. The role (generator, transducer, or observer)

Respond ONLY in JSON following the provided schema.
`, m.Name, m.Type, portsIn, portsOut, componentsDesc, m.Code)

	userID := c.Locals("user_id").(string)
	client, aiSettings, err := getOpenAIClientForUser(userID)
	if err != nil {
		log.Println("OpenAI error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("Documentation"),
		Description: openai.F("Model documentation with description, keywords, and role"),
		Schema:      openai.F(GenerateSchema[response.GeneratedDocumentationResponse]()),
		Strict:      openai.Bool(true),
	}

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(prompt.DocumentationPrompt),
			openai.UserMessage(fullPrompt),
		}),
		MaxCompletionTokens: openai.Int(1000),
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
		log.Println("OpenAI Chat Completion error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	if chat == nil || len(chat.Choices) == 0 {
		log.Println("OpenAI returned empty response")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	docResponse := response.GeneratedDocumentationResponse{}
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &docResponse); err != nil {
		log.Println("JSON Unmarshal error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse AI response"})
	}

	return c.JSON(docResponse)
}

func buildTargetPortsContext(target model.Model) string {
	if len(target.Ports) == 0 {
		return "- none"
	}

	var b strings.Builder
	for _, port := range target.Ports {
		displayName := canonicalPortName(port.Name, port.ID)
		if displayName == "" {
			displayName = "(unnamed-port)"
		}
		fmt.Fprintf(&b, "- %s (%s) [id=%s]\n", displayName, port.Type, port.ID)
	}
	return b.String()
}

func buildTargetComponentsContext(target model.Model) string {
	if target.Type != "coupled" || len(target.Components) == 0 {
		return "Target Components: none"
	}

	componentIDs := make([]string, 0, len(target.Components))
	for _, component := range target.Components {
		componentIDs = append(componentIDs, component.ModelID)
	}
	return fmt.Sprintf("Target Components: %s", strings.Join(componentIDs, ", "))
}

func validateEFStructureResponse(ef *response.ExperimentalFrameStructureResponse, target model.Model) error {
	if len(ef.Models) == 0 {
		return fmt.Errorf("models cannot be empty")
	}

	modelByID := make(map[string]response.ExperimentalFrameModel, len(ef.Models))
	rootID := ""
	mutID := ""

	for _, m := range ef.Models {
		if strings.TrimSpace(m.ID) == "" {
			return fmt.Errorf("model id cannot be empty")
		}
		if _, exists := modelByID[m.ID]; exists {
			return fmt.Errorf("duplicate model id: %s", m.ID)
		}

		modelByID[m.ID] = m

		if m.Role == response.ExperimentalFrameRoleExperimentalFrame {
			if rootID != "" {
				return fmt.Errorf("exactly one model with role experimental-frame is required")
			}
			if m.Type != response.ModelTypeCoupled {
				return fmt.Errorf("experimental-frame root must be coupled")
			}
			rootID = m.ID
		}

		if m.Role == response.ExperimentalFrameRoleModelUnderTest {
			if mutID != "" {
				return fmt.Errorf("exactly one model with role model-under-test is required")
			}
			mutID = m.ID
		}

		if m.Type == response.ModelTypeAtomic && len(m.Components) > 0 {
			return fmt.Errorf("atomic model %s cannot declare components", m.ID)
		}
	}

	if rootID == "" {
		return fmt.Errorf("missing experimental-frame root model")
	}
	if mutID == "" {
		return fmt.Errorf("missing model-under-test model")
	}

	if ef.RootModelID == "" {
		ef.RootModelID = rootID
	}
	if ef.ModelUnderTestID == "" {
		ef.ModelUnderTestID = mutID
	}

	if ef.RootModelID != rootID {
		return fmt.Errorf("rootModelId must reference the experimental-frame model")
	}
	if ef.ModelUnderTestID != mutID {
		return fmt.Errorf("modelUnderTestId must reference the model-under-test model")
	}

	if err := normalizeMutPortsAndConnections(ef, target, mutID); err != nil {
		return err
	}

	// Rebuild after potential normalization.
	modelByID = make(map[string]response.ExperimentalFrameModel, len(ef.Models))
	for _, m := range ef.Models {
		modelByID[m.ID] = m
	}

	rootModel := modelByID[rootID]
	if !containsString(rootModel.Components, mutID) {
		return fmt.Errorf("experimental-frame root must include model-under-test as component")
	}

	for _, m := range ef.Models {
		if m.Type == response.ModelTypeCoupled {
			for _, componentID := range m.Components {
				if _, exists := modelByID[componentID]; !exists {
					return fmt.Errorf("model %s references unknown component %s", m.ID, componentID)
				}
			}
		}
	}

	mutModel := modelByID[mutID]
	if string(mutModel.Type) != string(target.Type) {
		return fmt.Errorf("model-under-test type (%s) must match target type (%s)", mutModel.Type, target.Type)
	}

	if err := validateMutPorts(mutModel.Ports, target); err != nil {
		return err
	}

	for _, conn := range ef.Connections {
		fromModel, exists := modelByID[conn.From.Model]
		if !exists {
			return fmt.Errorf("connection references unknown source model %s", conn.From.Model)
		}
		toModel, exists := modelByID[conn.To.Model]
		if !exists {
			return fmt.Errorf("connection references unknown target model %s", conn.To.Model)
		}

		if !hasPortByNameAndDirection(fromModel.Ports, conn.From.Port, response.PortDirectionOut) {
			return fmt.Errorf("source port %s does not exist as out port on model %s", conn.From.Port, conn.From.Model)
		}
		if !hasPortByNameAndDirection(toModel.Ports, conn.To.Port, response.PortDirectionIn) {
			return fmt.Errorf("target port %s does not exist as in port on model %s", conn.To.Port, conn.To.Model)
		}
	}

	return nil
}

func normalizeMutPortsAndConnections(
	ef *response.ExperimentalFrameStructureResponse,
	target model.Model,
	mutID string,
) error {
	mutModelIndex := -1
	for i, m := range ef.Models {
		if m.ID == mutID {
			mutModelIndex = i
			break
		}
	}
	if mutModelIndex < 0 {
		return fmt.Errorf("missing model-under-test model")
	}

	mutPorts := make([]response.PortResponse, len(ef.Models[mutModelIndex].Ports))
	copy(mutPorts, ef.Models[mutModelIndex].Ports)

	// If already valid, keep as-is.
	if err := validateMutPorts(mutPorts, target); err == nil {
		return nil
	}

	targetInNames := make([]string, 0)
	targetOutNames := make([]string, 0)
	for _, p := range target.Ports {
		canonicalName := canonicalPortName(p.Name, p.ID)
		if canonicalName == "" {
			continue
		}
		if p.Type == "in" {
			targetInNames = append(targetInNames, canonicalName)
		}
		if p.Type == "out" {
			targetOutNames = append(targetOutNames, canonicalName)
		}
	}

	mutInIndexes := make([]int, 0)
	mutOutIndexes := make([]int, 0)
	for idx, p := range mutPorts {
		if p.Type == response.PortDirectionIn {
			mutInIndexes = append(mutInIndexes, idx)
		}
		if p.Type == response.PortDirectionOut {
			mutOutIndexes = append(mutOutIndexes, idx)
		}
	}

	// If interface cardinality differs, leave strict validation to fail with clear error.
	if len(mutInIndexes) != len(targetInNames) || len(mutOutIndexes) != len(targetOutNames) {
		return nil
	}

	renamedIn := make(map[string]string, len(mutInIndexes))
	renamedOut := make(map[string]string, len(mutOutIndexes))

	for i, portIndex := range mutInIndexes {
		oldName := canonicalPortName(mutPorts[portIndex].Name, mutPorts[portIndex].ID)
		newName := targetInNames[i]
		if oldName != newName {
			for _, alias := range []string{oldName, strings.TrimSpace(mutPorts[portIndex].Name), strings.TrimSpace(mutPorts[portIndex].ID)} {
				alias = strings.TrimSpace(alias)
				if alias != "" {
					renamedIn[alias] = newName
				}
			}
			mutPorts[portIndex].Name = newName
		}
	}
	for i, portIndex := range mutOutIndexes {
		oldName := canonicalPortName(mutPorts[portIndex].Name, mutPorts[portIndex].ID)
		newName := targetOutNames[i]
		if oldName != newName {
			for _, alias := range []string{oldName, strings.TrimSpace(mutPorts[portIndex].Name), strings.TrimSpace(mutPorts[portIndex].ID)} {
				alias = strings.TrimSpace(alias)
				if alias != "" {
					renamedOut[alias] = newName
				}
			}
			mutPorts[portIndex].Name = newName
		}
	}

	ef.Models[mutModelIndex].Ports = mutPorts

	for i, conn := range ef.Connections {
		if conn.From.Model == mutID {
			if renamed, exists := renamedOut[strings.TrimSpace(conn.From.Port)]; exists {
				ef.Connections[i].From.Port = renamed
			}
		}
		if conn.To.Model == mutID {
			if renamed, exists := renamedIn[strings.TrimSpace(conn.To.Port)]; exists {
				ef.Connections[i].To.Port = renamed
			}
		}
	}

	return nil
}

func validateMutPorts(mutPorts []response.PortResponse, target model.Model) error {
	if len(mutPorts) != len(target.Ports) {
		return fmt.Errorf("model-under-test ports must match target model interface")
	}

	expected := make(map[string]string, len(target.Ports))
	for _, port := range target.Ports {
		key := canonicalPortName(port.Name, port.ID)
		if key == "" {
			return fmt.Errorf("target model has a port with empty name and id")
		}
		expected[key] = string(port.Type)
	}

	for _, port := range mutPorts {
		key := canonicalPortName(port.Name, port.ID)
		expectedDirection, exists := expected[key]
		if !exists {
			return fmt.Errorf("model-under-test has unexpected port name %s", key)
		}
		if expectedDirection != string(port.Type) {
			return fmt.Errorf("model-under-test port %s has wrong direction %s", key, port.Type)
		}
	}

	return nil
}

func hasPortByNameAndDirection(ports []response.PortResponse, name string, direction response.PortDirection) bool {
	targetName := strings.TrimSpace(name)
	for _, port := range ports {
		if port.Type != direction {
			continue
		}
		if canonicalPortName(port.Name, port.ID) == targetName {
			return true
		}
		if strings.TrimSpace(port.Name) == targetName || strings.TrimSpace(port.ID) == targetName {
			return true
		}
	}
	return false
}

func canonicalPortName(name string, id string) string {
	trimmedName := strings.TrimSpace(name)
	if trimmedName != "" {
		return trimmedName
	}
	return strings.TrimSpace(id)
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func truncateForLog(value string, maxLen int) string {
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen] + "...(truncated)"
}
