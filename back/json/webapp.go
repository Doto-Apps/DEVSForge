package json

import "devsforge/enum"

type WebAppPortBinding struct {
	BindingKey string                  `json:"bindingKey"`
	PortID     string                  `json:"portId"`
	Name       string                  `json:"name"`
	Direction  enum.ModelPortDirection `json:"direction"`
}

type WebAppParameterBinding struct {
	BindingKey      string        `json:"bindingKey"`
	InstanceModelID string        `json:"instanceModelId"`
	InstancePath    string        `json:"instancePath"`
	ModelID         string        `json:"modelId"`
	ModelName       string        `json:"modelName"`
	Name            string        `json:"name"`
	Type            ParameterType `json:"type"`
	DefaultValue    any           `json:"defaultValue"`
	Description     string        `json:"description,omitempty"`
}

type WebAppContract struct {
	ModelID            string                   `json:"modelId"`
	ModelName          string                   `json:"modelName"`
	ModelDescription   string                   `json:"modelDescription"`
	ParameterBindings  []WebAppParameterBinding `json:"parameterBindings"`
	InputPortBindings  []WebAppPortBinding      `json:"inputPortBindings"`
	OutputPortBindings []WebAppPortBinding      `json:"outputPortBindings"`
}

type WebAppUISectionKind string

const (
	WebAppUISectionKindParameters WebAppUISectionKind = "parameters"
	WebAppUISectionKindInputs     WebAppUISectionKind = "inputs"
	WebAppUISectionKindOutputs    WebAppUISectionKind = "outputs"
	WebAppUISectionKindRun        WebAppUISectionKind = "run"
	WebAppUISectionKindCustom     WebAppUISectionKind = "custom"
)

type WebAppUISection struct {
	ID                   string              `json:"id"`
	Kind                 WebAppUISectionKind `json:"kind"`
	Title                string              `json:"title"`
	Description          string              `json:"description"`
	ParameterBindingKeys []string            `json:"parameterBindingKeys"`
	PortBindingKeys      []string            `json:"portBindingKeys"`
}

type WebAppUISchema struct {
	Version        int               `json:"version"`
	Layout         string            `json:"layout"`
	RunButtonLabel string            `json:"runButtonLabel"`
	Sections       []WebAppUISection `json:"sections"`
}
