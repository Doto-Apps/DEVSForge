package response

import (
	jsonModel "devsforge/json"
	"devsforge/model"
	"time"
)

type WebAppSkeletonResponse struct {
	Contract jsonModel.WebAppContract `json:"contract"`
	UISchema jsonModel.WebAppUISchema `json:"uiSchema"`
}

type WebAppGenerationLLMResponse struct {
	UISchema jsonModel.WebAppUISchema `json:"uiSchema"`
}

type WebAppDeploymentResponse struct {
	ID          string                   `json:"id"`
	UserID      string                   `json:"userId"`
	ModelID     string                   `json:"modelId"`
	Name        string                   `json:"name"`
	Slug        string                   `json:"slug"`
	Description string                   `json:"description"`
	Prompt      string                   `json:"prompt"`
	IsPublic    bool                     `json:"isPublic"`
	Contract    jsonModel.WebAppContract `json:"contract"`
	UISchema    jsonModel.WebAppUISchema `json:"uiSchema"`
	CreatedAt   time.Time                `json:"createdAt"`
	UpdatedAt   time.Time                `json:"updatedAt"`
}

func CreateWebAppDeploymentResponse(deployment model.WebAppDeployment) WebAppDeploymentResponse {
	return WebAppDeploymentResponse{
		ID:          deployment.ID,
		UserID:      deployment.UserID,
		ModelID:     deployment.ModelID,
		Name:        deployment.Name,
		Slug:        deployment.Slug,
		Description: deployment.Description,
		Prompt:      deployment.Prompt,
		IsPublic:    deployment.IsPublic,
		Contract:    deployment.Contract,
		UISchema:    deployment.UISchema,
		CreatedAt:   deployment.CreatedAt,
		UpdatedAt:   deployment.UpdatedAt,
	}
}
