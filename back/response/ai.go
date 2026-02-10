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

type ExperimentalFrameRole string

const (
	ExperimentalFrameRoleExperimentalFrame ExperimentalFrameRole = "experimental-frame"
	ExperimentalFrameRoleModelUnderTest    ExperimentalFrameRole = "model-under-test"
	ExperimentalFrameRoleGenerator         ExperimentalFrameRole = "generator"
	ExperimentalFrameRoleTransducer        ExperimentalFrameRole = "transducer"
	ExperimentalFrameRoleAcceptor          ExperimentalFrameRole = "acceptor"
)

type ExperimentalFrameModel struct {
	ID         string                `json:"id" jsonschema:"required"`
	Name       string                `json:"name" jsonschema:"required"`
	Type       ModelType             `json:"type" jsonschema:"required,enum=atomic,enum=coupled"`
	Role       ExperimentalFrameRole `json:"role" jsonschema:"required,enum=experimental-frame,enum=model-under-test,enum=generator,enum=transducer,enum=acceptor"`
	Ports      []PortResponse        `json:"ports" jsonschema:"required"`
	Components []string              `json:"components" jsonschema:"required"`
}

type ExperimentalFrameStructureResponse struct {
	RoomName         string                   `json:"roomName" jsonschema:"required"`
	TargetModelID    string                   `json:"targetModelId" jsonschema:"required"`
	RootModelID      string                   `json:"rootModelId" jsonschema:"required"`
	ModelUnderTestID string                   `json:"modelUnderTestId" jsonschema:"required"`
	Models           []ExperimentalFrameModel `json:"models" jsonschema:"required"`
	Connections      []Connection             `json:"connections" jsonschema:"required"`
}

type GeneratedModelResponse struct {
	Code            string                   `json:"code" validate:"required"`
	Keywords        []string                 `json:"keywords,omitempty"`
	ReuseCandidates []ReuseCandidateResponse `json:"reuseCandidates,omitempty"`
	ReuseUsed       *ReuseCandidateResponse  `json:"reuseUsed,omitempty"`
	ReuseMode       string                   `json:"reuseMode,omitempty"`
}

type GeneratedModelLLMResponse struct {
	Code string `json:"code" validate:"required"`
}

type ReuseCandidateResponse struct {
	ModelID     string   `json:"modelId"`
	Name        string   `json:"name"`
	Score       float64  `json:"score"`
	Keywords    []string `json:"keywords,omitempty"`
	Description string   `json:"description,omitempty"`
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
