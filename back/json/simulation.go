// Package json provides JSON data structures and serialization helpers.
package json

type Diagram struct {
	Cells       []Cell `json:"cells"`
	Description string `json:"description"`
}

type Cell struct {
	Type     string         `json:"type"`
	ID       any            `json:"id"`
	Label    *string        `json:"label,omitempty"`
	InPorts  *[]string      `json:"inPorts,omitempty"`
	OutPorts *[]string      `json:"outPorts,omitempty"`
	Behavior *Behavior      `json:"behavior,omitempty"`
	Embeds   *[]string      `json:"embeds,omitempty"`
	Source   *LinkEndpoint  `json:"source,omitempty"`
	Target   *LinkEndpoint  `json:"target,omitempty"`
	Attrs    map[string]any `json:"attrs,omitempty"`
	Prop     *CellProp      `json:"prop,omitempty"`
	Z        int            `json:"z,omitempty"`
}

type LinkEndpoint struct {
	ID   string `json:"id"`
	Port any    `json:"port"`
}

type Behavior struct {
	PythonPath string         `json:"python_path"`
	ModelPath  string         `json:"model_path"`
	Attrs      map[string]any `json:"attrs,omitempty"`
	Prop       map[string]any `json:"prop,omitempty"`
}

type CellProp struct {
	Data map[string]any `json:"data"`
}
