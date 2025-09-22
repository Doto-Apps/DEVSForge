package handler

import (
	"context"
	"devsforge/back/middleware"
	"devsforge/back/prompt"
	"devsforge/back/request"
	"devsforge/back/response"
	"encoding/json"
	"fmt"
	"log"
	"os"

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
// @Summary Generate a diagram
// @Description Sends a prompt to OpenAI to generate a diagram in JSON format based on a strict schema.
// @Tags AI
// @Accept json
// @Produce json
// @Param body body request.GenerateDiagramRequest true "Data required to generate a diagram"
// @Success 200 {object} response.DiagramResponse "Generated diagram"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 500 {object} map[string]string "AI processing error"
// @Router /ai/generate-diagram [post]
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

	chat, _ := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages:    openai.F(Messages),
		MaxTokens:   openai.Int(4000),
		TopP:        openai.Float(0.7),
		Temperature: openai.Float(0.9),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		// only certain models can perform structured outputs
		Model: openai.F(os.Getenv("AI_MODEL")),
	})

	response := response.DiagramResponse{}
	_ = json.Unmarshal([]byte(chat.Choices[0].Message.Content), &response)

	return c.JSON(response)
}

// GenerateModel godoc
// @Summary Generate a model
// @Description Sends a prompt to OpenAI to generate a DEVS model code.
// @Tags AI
// @Accept json
// @Produce json
// @Param body body request.GenerateModelRequest true "Data required to generate a model"
// @Success 200 {object} response.GeneratedModelResponse "Generated model code"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 500 {object} map[string]string "AI processing error"
// @Router /ai/generate-model [post]
func generateModel(c *fiber.Ctx) error {
	var request request.GenerateModelRequest

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if request.ModelName == "" || request.ModelType == "" || request.PreviousModelsCode == "" || request.UserPrompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "All fields are required"})
	}

	fullPrompt := fmt.Sprintf(`
		[MODEL REQUEST]
		Model Name: %s
		Model Type: %s

		Previous Models Code:
		%s

		User Description: %s
		Respond ONLY with the Python code in JSON as { "code": "your_code_here" }
	`, request.ModelName, request.ModelType, request.PreviousModelsCode, request.UserPrompt)

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

	chat, _ := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(prompt.ModelPrompt),
			openai.UserMessage(fullPrompt),
		}),
		MaxTokens:   openai.Int(4000),
		TopP:        openai.Float(0.7),
		Temperature: openai.Float(0.9),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type:       openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(schemaParam),
			},
		),
		Model: openai.F(os.Getenv("AI_MODEL")),
	})

	response := response.GeneratedModelResponse{}
	_ = json.Unmarshal([]byte(chat.Choices[0].Message.Content), &response)

	return c.JSON(response)
}
