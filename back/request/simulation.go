package request

type SimulationParameterOverrideRequest struct {
	Name  string `json:"name"`
	Value any    `json:"value"`
}

type SimulationModelOverrideRequest struct {
	InstanceModelID string                               `json:"instanceModelId"`
	OverrideParams  []SimulationParameterOverrideRequest `json:"overrideParams"`
}

type SimulationStartRequest struct {
	MaxTime   float64                          `json:"maxTime"`
	Overrides []SimulationModelOverrideRequest `json:"overrides,omitempty"`
}
