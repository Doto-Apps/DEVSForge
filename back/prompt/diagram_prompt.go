package prompt

const DiagramPrompt = `
Generate a strictly structured JSON representing a DEVS (Discrete Event System Specification) model, adhering to the following schema:

### 1. Models Definition (models array)
- Each object in "models" represents a DEVS model.
- Keys:
  - "id": Unique identifier of the model.
  - "type": Either "atomic" or "coupled".
  - "ports": An array of port objects where each port has:
    - "id": Unique identifier of the port (use the pattern "modelId-portName" or similar).
    - "name": Logical name of the port (e.g., "input", "output", "signal").
    - "type": Either "in" for input ports or "out" for output ports.
  - If "type" is "coupled", the model can also have:
    - "components": An array listing the IDs of sub-models.

### 2. Connections Definition (connections array)
For connection between models inside coupled, direct connections are allowed. It's easier for you to connect models directly.
- **By default, all connections must be direct**, meaning:
- Keys:
  - "from": Defines the source model and port.
    - "model": The id of the source model.
    - "port": The name of the output port of the source model.
  - "to": Defines the destination model and port.
    - "model": The id of the destination model.
    - "port": The name of the input port of the destination model.

### 3. Constraints (Must be strictly followed)
- Schema adherence: No missing, extra, or misnamed fields.
- Compact JSON output: No line breaks (\n), indentation, or whitespace.
- Valid DEVS structure:
  - "atomic" models must have "ports", but cannot have "components".
  - "coupled" models must have "components", and can have "ports".
- **System encapsulation:** Do not automatically generate a top-level coupled model unless explicitly specified by the user.
- **Connections must be strictly direct** by default, unless the user explicitly requests indirect connections via coupled models.
- **No cyclic dependencies** (e.g., Model A → Model B → Model A), unless explicitly requested by the user.
- Meaningful IDs: No arbitrary names; IDs should be relevant to the DEVS logic.
- No redundant data: The JSON should be minimalistic yet complete.

### Expected JSON Example
{
	"models": [
		{
			"id": "coupled_switch",
			"type": "coupled",
			"components": ["switch_kitchen"],
			"ports": []
		},
		{
			"id": "switch_kitchen",
			"type": "atomic",
			"ports": [
				{"id": "switch_kitchen-signal", "name": "signal", "type": "out"},
				{"id": "switch_kitchen-signal2", "name": "signal2", "type": "out"}
			],
			"components": []
		},
		{
			"id": "switch_bedroom",
			"type": "atomic",
			"ports": [
				{"id": "switch_bedroom-signal", "name": "signal", "type": "out"}
			],
			"components": []
		},
		{
			"id": "light_kitchen_1",
			"type": "atomic",
			"ports": [
				{"id": "light_kitchen_1-switch_signal", "name": "switch_signal", "type": "in"}
			],
			"components": []
		},
		{
			"id": "light_kitchen_2",
			"type": "atomic",
			"ports": [
				{"id": "light_kitchen_2-switch_signal", "name": "switch_signal", "type": "in"}
			],
			"components": []
		},
		{
			"id": "light_bedroom",
			"type": "atomic",
			"ports": [
				{"id": "light_bedroom-switch_signal", "name": "switch_signal", "type": "in"}
			],
			"components": []
		},
		{
			"id": "coupled_kitchen",
			"type": "coupled",
			"components": ["light_kitchen_1", "light_kitchen_2"],
			"ports": []
		}
	],
	"connections": [
		{
			"from": {
				"model": "switch_kitchen",
				"port": "signal"
			},
			"to": {
				"model": "light_kitchen_1",
				"port": "switch_signal"
			}
		},
		{
			"from": {
				"model": "switch_kitchen",
				"port": "signal"
			},
			"to": {
				"model": "light_kitchen_2",
				"port": "switch_signal"
			}
		},
		{
			"from": {
				"model": "switch_bedroom",
				"port": "signal"
			},
			"to": {
				"model": "light_bedroom",
				"port": "switch_signal"
			}
		}
	]
}
	
### Output Instructions
- Return only the compact JSON as a single line, without any additional text.

`
