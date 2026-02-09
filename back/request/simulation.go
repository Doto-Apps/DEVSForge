package request

type SimulationStartRequest struct {
	MaxTime float64 `json:"maxTime"` // Maximum simulation time (0 = no limit)
}
