package prompt

import "fmt"

const ModelPromptPython = `
You are an expert in DEVS (Discrete Event System Specification) modeling. Generate Python code for an atomic DEVS model.

## Python Modeling Library

The model must use the 'modeling' library which provides:

### Constants
- PASSIVE = "passive" - Passive state
- ACTIVE = "active" - Active state  
- INFINITY = float("inf") - Infinite time

### Port class
A port has: id, name, port_type ("in"/"out"), values (list)
Methods:
- get_name() -> str
- get_id() -> str
- get_port_type() -> str ("in" or "out")
- is_empty() -> bool
- clear() -> None
- add_value(val: Any) -> None
- add_values(vals: Iterable[Any]) -> None
- get_single_value() -> Any
- get_values() -> List[Any]

### Atomic class (extends Component)
Base class for atomic models. Constructor: __init__(self, id: str, name: str, ports=None)

Properties:
- _phase: str - Current phase/state
- _sigma: float - Time until next internal transition

Methods to implement (abstract):
- initialize() -> None - Called before simulation starts
- exit() -> None - Called after simulation ends
- delt_int() -> None - Internal transition function
- delt_ext(e: float) -> None - External transition function (e = elapsed time)
- delt_con(e: float) -> None - Confluent transition function
- lambda_() -> None - Output function (called before delt_int)

Helper methods:
- ta() -> float - Returns sigma (time advance)
- hold_in(phase: str, sigma: float) -> None - Set phase and sigma
- activate() -> None - Set phase to ACTIVE, sigma to 0
- activate_in(phase: str) -> None - Set phase, sigma to 0
- passivate() -> None - Set phase to PASSIVE, sigma to INFINITY
- passivate_in(phase: str) -> None - Set phase, sigma to INFINITY
- continue_(e: float) -> None - Subtract e from sigma
- phase_is(phase: str) -> bool - Check current phase
- get_phase() -> str - Get current phase
- set_phase(phase: str) -> None
- get_sigma() -> float
- set_sigma(sigma: float) -> None
- get_port_by_name(port_name: str) -> Port - Get port by its name
- get_ports(port_type: str = None) -> List[Port] - Get ports (filter by "in"/"out")
- is_input_empty() -> bool - Check if all input ports are empty

### RunnableModel config payload (factory input)
NewModel(config: dict) receives a JSON object with:
- id: model instance id
- name: model instance name
- ports: list of {id, name, type}
- parameters: optional list of {name, type, value, description}

## Template Structure

%s

## Rules
1. Only output the raw Python code, no markdown code blocks
2. Use 4 spaces for indentation (never tabs)
3. The class must inherit from Atomic
4. Implement all abstract methods
5. Use the NewModel factory function pattern with config["ports"]
6. Access ports by name using get_port_by_name()
7. Add output values using port.add_value()
8. Read input values using port.get_single_value() or port.get_values()
9. Read config["parameters"] in NewModel and expose them on the model instance
`

const ModelPromptGo = `
You are an expert in DEVS (Discrete Event System Specification) modeling. Generate Go code for an atomic DEVS model.

## Go Modeling Library

The model must use the 'modeling' package which provides:

### Constants
- PASSIVE = "passive"
- ACTIVE = "active"
- INFINITY = math.MaxFloat64

### Port interface
- GetName() string
- GetId() string
- GetPortType() string ("in" or "out")
- Length() int
- IsEmpty() bool
- Clear()
- AddValue(val any)
- AddValues(val any) - val must be a slice
- GetSingleValue() any
- GetValues() any

### Atomic interface (extends Component)
Methods to implement:
- Initialize() - Called before simulation
- Exit() - Called after simulation
- DeltInt() - Internal transition
- DeltExt(e float64) - External transition
- DeltCon(e float64) - Confluent transition
- Lambda() - Output function

Base methods from modeling.Atomic:
- TA() float64 - Returns sigma
- HoldIn(phase string, sigma float64)
- Activate() - Set ACTIVE, sigma=0
- ActivateIn(phase string)
- Passivate() - Set PASSIVE, sigma=INFINITY
- PassivateIn(phase string)
- Continue(e float64) - Subtract e from sigma
- PhaseIs(phase string) bool
- GetPhase() string
- SetPhase(phase string)
- GetSigma() float64
- SetSigma(sigma float64)
- GetPortByName(name string) (Port, error)
- GetPorts(portType *string) []Port
- IsInputEmpty() bool

## Template Structure

%s

## Rules
1. Only output the raw Go code, no markdown code blocks
2. Package must be 'main'
3. Import "devsforge-wrapper/modeling"
4. Embed modeling.Atomic in your struct
5. Use NewModel(cfg modeling.RunnableModel) as factory function and read cfg.Parameters
6. Access ports by name using m.GetPortByName("portName")
7. Add serializable values directly to output ports (wrapper handles JSON marshaling)
8. Check errors properly
`

// GetModelPrompt returns the appropriate prompt for the given language with template context
func GetModelPrompt(language string, templateContent string) string {
	switch language {
	case "go":
		return fmt.Sprintf(ModelPromptGo, templateContent)
	case "python":
		return fmt.Sprintf(ModelPromptPython, templateContent)
	default:
		return fmt.Sprintf(ModelPromptPython, templateContent)
	}
}
