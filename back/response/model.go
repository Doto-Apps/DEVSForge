package response

import (
	"devsforge-shared/integrations"
	"devsforge/enum"
	"devsforge/json"
	"devsforge/model"
)

type ModelComponentResponse struct {
	ComponentID string `json:"componentId" validate:"required"`
	ModelID     string `json:"modelId" validate:"required"`
}

type ModelResponse struct {
	ID                 string                 `json:"id" validate:"required"`
	UserID             string                 `json:"userId" validate:"required"`
	LibID              *string                `json:"libId"`
	Name               string                 `json:"name" validate:"required"`
	Type               enum.ModelType         `json:"type" validate:"required"`
	Language           string                 `json:"language,omitempty"`
	IntegrationID      *string                `json:"integrationId"`
	IntegrationVersion *string                `json:"integrationVersion"`
	Description        string                 `json:"description" validate:"required"`
	Code               string                 `json:"code" validate:"required"`
	Components         []json.ModelComponent  `json:"components" validate:"required"`
	Ports              []json.ModelPort       `json:"ports" validate:"required"`
	Metadata           json.ModelMetadata     `json:"metadata" validate:"required"`
	Connections        []json.ModelConnection `json:"connections" validate:"required"`
}

func CreateModelResponse(m model.Model) ModelResponse {
	if m.Language == "" && m.IntegrationID != nil && m.IntegrationVersion != nil {
		if d, err := integrations.Resolve(*m.IntegrationID, *m.IntegrationVersion, ""); err == nil {
			m.Language = d.Language
		}
	}
	return ModelResponse{
		ID:       m.ID,
		UserID:   m.UserID,
		LibID:    m.LibID,
		Name:     m.Name,
		Type:     m.Type,
		Language: m.Language, IntegrationID: m.IntegrationID, IntegrationVersion: m.IntegrationVersion,
		Description: m.Description,
		Code:        m.Code,
		Ports:       m.Ports,
		Components:  m.Components,
		Connections: m.Connections,
		Metadata:    m.Metadata,
	}
}
