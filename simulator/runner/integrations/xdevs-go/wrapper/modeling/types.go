package modeling

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
	Value       any           `json:"value" validate:"required"`
	Description string        `json:"description,omitempty"`
}

type ModelPortDirection string

const (
	ModelPortDirectionIn  ModelPortDirection = "in"
	ModelPortDirectionOut ModelPortDirection = "out"
)

type RunnableModelPort struct {
	ID   string             `json:"id" validate:"required"`
	Name string             `json:"name" validate:"required"`
	Type ModelPortDirection `json:"type" validate:"required"`
}

type RunnableModel struct {
	ID         string                   `json:"id" validate:"required"`
	Name       string                   `json:"name" validate:"required"`
	Ports      []RunnableModelPort      `json:"ports" validate:"required"`
	Parameters []RunnableModelParameter `json:"parameters,omitempty"`
}
