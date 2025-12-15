package response

type DiagramResponse struct {
	Models      []Model      `json:"models" validate:"required"`      // obligatoire
	Connections []Connection `json:"connections" validate:"required"` // obligatoire
}

type ModelType string

const (
	ModelTypeAtomic  ModelType = "atomic"
	ModelTypeCoupled ModelType = "coupled"
)

type Model struct {
	ID         string    `json:"id" jsonschema:"required"`         // required
	Type       ModelType `json:"type" jsonschema:"required"`       // required enum
	Ports      Ports     `json:"ports" jsonschema:"required"`      // required
	Components []string  `json:"components" jsonschema:"required"` // required (can be empty array)
}

type Ports struct {
	In  []string `json:"in" jsonschema:"required"`  // required (can be empty array)
	Out []string `json:"out" jsonschema:"required"` // required (can be empty array)
}

type Connection struct {
	From Endpoint `json:"from" validate:"required"` // obligatoire
	To   Endpoint `json:"to" validate:"required"`   // obligatoire
}

type Endpoint struct {
	Model string `json:"model" validate:"required"` // obligatoire
	Port  string `json:"port" validate:"required"`  // obligatoire
}

type GeneratedModelResponse struct {
	Code string `json:"code" validate:"required"`
}
