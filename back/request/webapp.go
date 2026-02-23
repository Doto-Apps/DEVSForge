package request

import jsonModel "devsforge/json"

type GenerateWebAppRequest struct {
	ModelID       string                    `json:"modelId" validate:"required"`
	Name          string                    `json:"name,omitempty"`
	UserPrompt    string                    `json:"userPrompt" validate:"required"`
	CurrentSchema *jsonModel.WebAppUISchema `json:"currentSchema,omitempty"`
}

type CreateWebAppDeploymentRequest struct {
	ModelID     string                    `json:"modelId" validate:"required"`
	Name        string                    `json:"name" validate:"required"`
	Description string                    `json:"description,omitempty"`
	Prompt      string                    `json:"prompt,omitempty"`
	IsPublic    bool                      `json:"isPublic"`
	UISchema    *jsonModel.WebAppUISchema `json:"uiSchema,omitempty"`
}

type UpdateWebAppDeploymentRequest struct {
	Name        *string                   `json:"name,omitempty"`
	Description *string                   `json:"description,omitempty"`
	Prompt      *string                   `json:"prompt,omitempty"`
	IsPublic    *bool                     `json:"isPublic,omitempty"`
	UISchema    *jsonModel.WebAppUISchema `json:"uiSchema,omitempty"`
}
