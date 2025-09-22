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
	ID         string    `json:"id" validate:"required"`   // obligatoire
	Type       ModelType `json:"type" validate:"required"` // enum obligatoire
	Ports      *Ports    `json:"ports,omitempty"`          // optionnel
	Components []string  `json:"components,omitempty"`     // optionnel
}

type Ports struct {
	In  []string `json:"in,omitempty"`
	Out []string `json:"out,omitempty"`
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
