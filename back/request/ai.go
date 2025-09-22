package request

type PastMessages struct {
	Role    string `json:"role" validate:"required"`
	Content string `json:"content" validate:"required"`
}

type GenerateDiagramRequest struct {
	DiagramName   string         `json:"diagramName" validate:"required" example:"MyDiagram"`
	UserPrompt    string         `json:"userPrompt" validate:"required" example:"Create a software architecture diagram"`
	PastResponses []PastMessages `json:"pastMessages,omitempty" example:"[]"`
}

type GenerateModelRequest struct {
	ModelName          string `json:"modelName" validate:"required" example:"MyModel"`
	ModelType          string `json:"modelType" validate:"required" example:"DEVS"`
	PreviousModelsCode string `json:"previousModelsCode" validate:"required" example:"Existing model code"`
	UserPrompt         string `json:"userPrompt" validate:"required" example:"Generate a model based on the previous code"`
}
