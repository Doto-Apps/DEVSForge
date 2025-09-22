package response

import (
	"devsforge/back/enum"
	"devsforge/back/json"
	"devsforge/back/model"
)

type ModelComponentResponse struct {
	ComponentID string `json:"componentId" validate:"required"`
	ModelID     string `json:"modelId" validate:"required"`
}

type ModelResponse struct {
	ID          string                 `json:"id" validate:"required"`
	UserID      string                 `json:"userId" validate:"required"`
	LibID       *string                `json:"libId"`
	Name        string                 `json:"name" validate:"required"`
	Type        enum.ModelType         `json:"type" validate:"required"`
	Description string                 `json:"description" validate:"required"`
	Code        string                 `json:"code" validate:"required"`
	Components  []json.ModelComponent  `json:"components" validate:"required"`
	Ports       []json.ModelPort       `json:"ports" validate:"required"`
	Metadata    json.ModelMetadata     `json:"metadata" validate:"required"`
	Connections []json.ModelConnection `json:"connections" validate:"required"`
}

func CreateModelResponse(m model.Model) ModelResponse {
	return ModelResponse{
		ID:          m.ID,
		UserID:      m.UserID,
		LibID:       m.LibID,
		Name:        m.Name,
		Type:        m.Type,
		Description: m.Description,
		Code:        m.Code,
		Ports:       m.Ports,
		Components:  m.Components,
		Connections: m.Connections,
		Metadata:    m.Metadata,
	}
}
