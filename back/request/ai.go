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

type GenerateEFStructureRequest struct {
	TargetModelID string         `json:"targetModelId" validate:"required" example:"uuid-of-target-model"`
	RoomName      string         `json:"roomName,omitempty" example:"Room - NomDuEF"`
	UserPrompt    string         `json:"userPrompt" validate:"required" example:"I want 2 generators and 1 acceptor to validate latency"`
	PastResponses []PastMessages `json:"pastMessages,omitempty" example:"[]"`
}

type PortInfo struct {
	ID   string `json:"id" validate:"required" example:"port-1"`
	Name string `json:"name" validate:"required" example:"input"`
	Type string `json:"type" validate:"required,oneof=in out" example:"in"`
}

type GenerateModelRequest struct {
	ModelName          string     `json:"modelName" validate:"required" example:"MyModel"`
	Language           string     `json:"language" validate:"required,oneof=python go" example:"python"`
	Ports              []PortInfo `json:"ports" validate:"required"`
	PreviousModelsCode string     `json:"previousModelsCode" validate:"required" example:"Existing model code"`
	UserPrompt         string     `json:"userPrompt" validate:"required" example:"Generate a model based on the previous code"`
}

type GenerateDocumentationRequest struct {
	ModelID string `json:"modelId" validate:"required" example:"uuid-of-model"`
}
