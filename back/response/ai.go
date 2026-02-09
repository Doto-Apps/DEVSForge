package response

type DiagramResponse struct {
	Models      []Model      `json:"models" jsonschema:"required"`      // required
	Connections []Connection `json:"connections" jsonschema:"required"` // required
}

type ModelType string

const (
	ModelTypeAtomic  ModelType = "atomic"
	ModelTypeCoupled ModelType = "coupled"
)

type Model struct {
	ID         string         `json:"id" jsonschema:"required"`         // required
	Type       ModelType      `json:"type" jsonschema:"required"`       // required enum
	Ports      []PortResponse `json:"ports" jsonschema:"required"`      // required (can be empty array)
	Components []string       `json:"components" jsonschema:"required"` // required (can be empty array)
}

type PortDirection string

const (
	PortDirectionIn  PortDirection = "in"
	PortDirectionOut PortDirection = "out"
)

type PortResponse struct {
	ID   string        `json:"id" jsonschema:"required"`                    // unique port identifier
	Name string        `json:"name" jsonschema:"required"`                  // logical port name
	Type PortDirection `json:"type" jsonschema:"required,enum=in,enum=out"` // "in" or "out"
}

type Connection struct {
	From Endpoint `json:"from" jsonschema:"required"` // required
	To   Endpoint `json:"to" jsonschema:"required"`   // required
}

type Endpoint struct {
	Model string `json:"model" jsonschema:"required"` // required
	Port  string `json:"port" jsonschema:"required"`  // required
}

type GeneratedModelResponse struct {
	Code string `json:"code" validate:"required"`
}

type DocumentationRole string

const (
	DocumentationRoleGenerator  DocumentationRole = "generator"
	DocumentationRoleTransducer DocumentationRole = "transducer"
	DocumentationRoleObserver   DocumentationRole = "observer"
)

type GeneratedDocumentationResponse struct {
	Description string            `json:"description" jsonschema:"required"`
	Keywords    []string          `json:"keywords" jsonschema:"required"`
	Role        DocumentationRole `json:"role" jsonschema:"required,enum=generator,enum=transducer,enum=observer"`
}
