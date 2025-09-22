package json

import (
	"devsforge/back/enum"
)

type ModelPort struct {
	ID   string                  `json:"id" validate:"required"`
	Type enum.ModelPortDirection `json:"type" validate:"required"`
}

type ModelConnection struct {
	From ModelLink `json:"from" validate:"required"`
	To   ModelLink `json:"to" validate:"required"`
}

type ModelLink struct {
	InstanceID string `json:"instanceId" validate:"required"`
	Port       string `json:"port" validate:"required"`
}

type ModelStyle struct {
	Width  float64 `json:"width" validate:"required"`
	Height float64 `json:"height" validate:"required"`
}

type ModelColors struct {
	BodyBackgroundColor   string `json:"bodyBackgroundColor,omitempty"`
	HeaderBackgroundColor string `json:"headerBackgroundColor,omitempty"`
	HeaderTextColor       string `json:"headerTextColor,omitempty"`
}

type ModelPosition struct {
	X float64 `json:"x" validate:"required"`
	Y float64 `json:"y" validate:"required"`
}

type ParameterType string

const (
	ParameterTypeInt    ParameterType = "int"
	ParameterTypeFloat  ParameterType = "float"
	ParameterTypeBool   ParameterType = "bool"
	ParameterTypeString ParameterType = "string"
	ParameterTypeObject ParameterType = "object"
)

type ModelParameter struct {
	Name        string        `json:"name" validate:"required"`
	Type        ParameterType `json:"type" validate:"required"`
	Value       interface{}   `json:"value" validate:"required"`
	Description string        `json:"description,omitempty"`
}

type ToolbarPosition string

const (
	ToolbarPositionTop    ToolbarPosition = "top"
	ToolbarPositionLeft   ToolbarPosition = "left"
	ToolbarPositionRight  ToolbarPosition = "right"
	ToolbarPositionBottom ToolbarPosition = "bottom"
)

type ModelMetadata struct {
	BackgroundColor     *string          `json:"backgroundColor,omitempty"`
	AlwaysShowToolbar   *bool            `json:"alwaysShowToolbar,omitempty"`
	AlwaysShowExtraInfo *bool            `json:"alwaysShowExtraInfo,omitempty"`
	ToolbarVisible      *bool            `json:"toolbarVisible,omitempty"`
	ToolbarPosition     *ToolbarPosition `json:"toolbarPosition,omitempty"`
	Position            ModelPosition    `json:"position" validate:"required"`
	Style               ModelStyle       `json:"style" validate:"required"`
	Parameters          []ModelParameter `json:"parameters,omitempty"`
	ModelColors         ModelColors      `json:"modelColors,omitempty"`
}

type ModelComponent struct {
	InstanceID       string         `json:"instanceId" validate:"required"`
	ModelID          string         `json:"modelId" validate:"required"`
	InstanceMetadata *ModelMetadata `json:"instanceMetadata,omitempty"`
}
