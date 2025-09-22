package main

import "devsforge/shared/enum"

type RunnableModelPort struct {
	ID   string                  `json:"id" validate:"required"`
	Type enum.ModelPortDirection `json:"type" validate:"required"`
}

type RunnableModelConnection struct {
	From ModelLink `json:"from" validate:"required"`
	To   ModelLink `json:"to" validate:"required"`
}

type ModelLink struct {
	ID   string `json:"id" validate:"required"`
	Port string `json:"port" validate:"required"`
}

type ParameterType string

const (
	ParameterTypeInt    ParameterType = "int"
	ParameterTypeFloat  ParameterType = "float"
	ParameterTypeBool   ParameterType = "bool"
	ParameterTypeString ParameterType = "string"
	ParameterTypeObject ParameterType = "object"
)

type RunnableModelParameter struct {
	Name        string        `json:"name" validate:"required"`
	Type        ParameterType `json:"type" validate:"required"`
	Value       interface{}   `json:"value" validate:"required"`
	Description string        `json:"description,omitempty"`
}

type RunnableModel struct {
	ID          string                    `json:"id" validate:"required"`
	Name        string                    `json:"name" validate:"required"`
	Code        string                    `json:"code" validate:"required"`
	Ports       []RunnableModelPort       `json:"ports" validate:"required"`
	Parameters  []RunnableModelParameter  `json:"parameters,omitempty"`
	Connections []RunnableModelConnection `json:"connections" validate:"required"`
}

type RunnableManifest struct {
	models []RunnableModel
}
