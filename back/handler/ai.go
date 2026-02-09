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
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// SetupAiRoutes configures AI-related routes.
func SetupAiRoutes(app *fiber.App) {
	group := app.Group("/ai", middleware.Protected())

	group.Post("/generate-diagram", generateDiagram)
	group.Post("/generate-model", generateModel)
	group.Post("/generate-documentation", generateDocumentation)
}

// Request structures

// Retrieves the OpenAI API client.
func getOpenAIClient() (*openai.Client, error) {
	apiKey := os.Getenv("AI_API_KEY")
	apiURL := os.Getenv("AI_API_URL")

	if apiKey == "" || apiURL == "" {
		return nil, fmt.Errorf("OpenAI API key or URL is not set")
	}

	client := openai.NewClient(
		option.WithAPIKey(apiKey), // defaults to os.LookupEnv("OPENAI_API_KEY")
		option.WithBaseURL(apiURL),
	)

	return client, nil
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

	client, err := getOpenAIClient()
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
		Model: openai.F(os.Getenv("AI_MODEL")),
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
	var request request.GenerateModelRequest

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if request.ModelName == "" || request.Language == "" || request.UserPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ModelName, Language, and UserPrompt are required"})
	}

	// Validate language
	if request.Language != "python" && request.Language != "go" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Language must be 'python' or 'go'"})
	}

	// Build ports context
	var portsContext strings.Builder
	portsContext.WriteString("## Model Ports\n")
	for _, port := range request.Ports {
		portsContext.WriteString(fmt.Sprintf("- %s (%s): %s\n", port.Name, port.Type, port.ID))
	}

	// Get the appropriate prompt with template
	systemPrompt, err := prompt.BuildModelPromptWithContext(request.Language)
	if err != nil {
		log.Println("Failed to build model prompt:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare prompt"})
	}

	fullPrompt := fmt.Sprintf(`
[MODEL REQUEST]
Model Name: %s
Language: %s

%s

Previous Models Code:
%s

User Description: %s

Respond ONLY with the %s code in JSON as { "code": "your_code_here" }
`, request.ModelName, request.Language, portsContext.String(), request.PreviousModelsCode, request.UserPrompt, request.Language)

	client, err := getOpenAIClient()
	if err != nil {
		log.Println("OpenAI error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	schemaParam := openai.ResponseFormatJSONSchemaJSONSchemaParam{
		Name:        openai.F("Model"),
		Description: openai.F("Model code"),
		Schema:      openai.F(GenerateSchema[response.GeneratedModelResponse]()),
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
		Model: openai.F(os.Getenv("AI_MODEL")),
	})

	if err != nil {
		log.Println("OpenAI Chat Completion error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI generation failed: " + err.Error()})
	}

	if chat == nil || len(chat.Choices) == 0 {
		log.Println("OpenAI returned empty response")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI returned empty response"})
	}

	response := response.GeneratedModelResponse{}
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &response); err != nil {
		log.Println("JSON Unmarshal error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse AI response"})
	}

	return c.JSON(response)
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

	client, err := getOpenAIClient()
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
		Model: openai.F(os.Getenv("AI_MODEL")),
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
