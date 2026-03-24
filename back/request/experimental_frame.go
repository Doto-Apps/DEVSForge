package request

import (
	"devsforge/enum"
	"devsforge/model"
)

type ExperimentalFrameRequest struct {
	TargetModelID    string                                `json:"targetModelId" validate:"required"`
	FrameModelID     string                                `json:"frameModelId,omitempty"`
	RootModelID      string                                `json:"rootModelId,omitempty"`
	ModelUnderTestID string                                `json:"modelUnderTestId,omitempty"`
	RoomName         string                                `json:"roomName,omitempty"`
	LibraryID        *string                               `json:"libraryId,omitempty"`
	Models           []AssistedExperimentalFrameModel      `json:"models,omitempty"`
	Connections      []AssistedExperimentalFrameConnection `json:"connections,omitempty"`
}

func (req ExperimentalFrameRequest) ToModel(userID string) model.ExperimentalFrame {
	return model.ExperimentalFrame{
		UserID:        userID,
		TargetModelID: req.TargetModelID,
		FrameModelID:  req.FrameModelID,
	}
}

func (req ExperimentalFrameRequest) IsAssistedSave() bool {
	return req.FrameModelID == "" &&
		req.RootModelID != "" &&
		len(req.Models) > 0
}

type AssistedExperimentalFrameModel struct {
	ID         string                               `json:"id" validate:"required"`
	Name       string                               `json:"name" validate:"required"`
	Type       enum.ModelType                       `json:"type" validate:"required,oneof=atomic coupled"`
	Role       string                               `json:"role,omitempty"`
	Ports      []AssistedExperimentalFrameModelPort `json:"ports"`
	Components []string                             `json:"components"`
	Code       string                               `json:"code,omitempty"`
}

type AssistedExperimentalFrameModelPort struct {
	Name string                  `json:"name" validate:"required"`
	Type enum.ModelPortDirection `json:"type" validate:"required,oneof=in out"`
}

type AssistedExperimentalFrameConnection struct {
	From AssistedExperimentalFrameEndpoint `json:"from" validate:"required"`
	To   AssistedExperimentalFrameEndpoint `json:"to" validate:"required"`
}

type AssistedExperimentalFrameEndpoint struct {
	Model string `json:"model" validate:"required"`
	Port  string `json:"port" validate:"required"`
}
