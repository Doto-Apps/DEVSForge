// Package exchange defines the stable import core, independent of source formats and storage.
package exchange

import (
	modeljson "devsforge/json"
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

type Model struct {
	ID                 string                      `json:"id"`
	Name               string                      `json:"name"`
	Type               string                      `json:"type"`
	Language           string                      `json:"language"`
	Framework          string                      `json:"framework"`
	IntegrationID      string                      `json:"integrationId"`
	IntegrationVersion string                      `json:"integrationVersion"`
	RunnerID           string                      `json:"runnerId"`
	Code               string                      `json:"code"`
	Description        string                      `json:"description"`
	Ports              []modeljson.ModelPort       `json:"ports"`
	Parameters         []modeljson.ModelParameter  `json:"parameters"`
	Components         []Component                 `json:"components"`
	Connections        []modeljson.ModelConnection `json:"connections"`
	Files              map[string]string           `json:"files"`
	Missing            []string                    `json:"missing"`
	Evidence           []string                    `json:"evidence"`
	Dependencies       []string                    `json:"dependencies"`
	Original           map[string]any              `json:"original"`
	BlockedReason      string                      `json:"blockedReason,omitempty"`
}
type Component struct {
	InstanceID         string         `json:"instanceId"`
	ModelID            string         `json:"modelId"`
	ParameterOverrides map[string]any `json:"parameterOverrides"`
}
type Package struct {
	Version string         `json:"version"`
	Roots   []string       `json:"roots"`
	Models  []Model        `json:"models"`
	Assets  map[string]any `json:"assets"`
}

func (p Package) Validate() error {
	if p.Version != "1" || len(p.Models) == 0 || len(p.Models) > 1000 || len(p.Roots) == 0 {
		return fmt.Errorf("invalid exchange package")
	}
	models := map[string]Model{}
	for _, m := range p.Models {
		if m.ID == "" || models[m.ID].ID != "" || strings.TrimSpace(m.Name) == "" || (m.Type != "atomic" && m.Type != "coupled") {
			return fmt.Errorf("missing or duplicate model identity/type")
		}
		models[m.ID] = m
		ports := map[string]bool{}
		for _, port := range m.Ports {
			if port.Name == "" || ports[port.Name] || (port.Type != "in" && port.Type != "out") {
				return fmt.Errorf("%s: invalid or duplicate ports", m.Name)
			}
			ports[port.Name] = true
		}
		params := map[string]bool{}
		for _, param := range m.Parameters {
			if param.Name == "" || params[param.Name] || !parameterValue(param.Type, param.Value) {
				return fmt.Errorf("%s: invalid or duplicate parameter", m.Name)
			}
			params[param.Name] = true
		}
		if m.Type == "atomic" && (len(m.Components) > 0 || len(m.Connections) > 0) {
			return fmt.Errorf("atomic model has a composition")
		}
	}
	for _, m := range p.Models {
		children := map[string]Model{"root": m}
		for _, c := range m.Components {
			child, ok := models[c.ModelID]
			if !ok || c.InstanceID == "" || children[c.InstanceID].ID != "" {
				return fmt.Errorf("invalid component reference")
			}
			children[c.InstanceID] = child
			for key, value := range c.ParameterOverrides {
				found := false
				for _, param := range child.Parameters {
					if param.Name == key && parameterValue(param.Type, value) {
						found = true
					}
				}
				if !found {
					return fmt.Errorf("unknown parameter override %s", key)
				}
			}
		}
		for _, c := range m.Connections {
			for i, end := range []modeljson.ModelLink{c.From, c.To} {
				child, ok := children[end.InstanceID]
				if !ok {
					return fmt.Errorf("unresolved connection")
				}
				direction := "out"
				if i == 1 {
					direction = "in"
				}
				if end.InstanceID == "root" {
					if direction == "out" {
						direction = "in"
					} else {
						direction = "out"
					}
				}
				found := false
				for _, port := range child.Ports {
					if port.Name == end.Port && string(port.Type) == direction {
						found = true
					}
				}
				if !found {
					return fmt.Errorf("invalid connection port/direction")
				}
			}
		}
	}
	active, done := map[string]bool{}, map[string]bool{}
	var visit func(string, int) error
	visit = func(id string, depth int) error {
		if active[id] || depth > 64 {
			return fmt.Errorf("cyclic or excessively nested composition")
		}
		if done[id] {
			return nil
		}
		m, ok := models[id]
		if !ok {
			return fmt.Errorf("unresolved root/model")
		}
		active[id] = true
		for _, c := range m.Components {
			if err := visit(c.ModelID, depth+1); err != nil {
				return err
			}
		}
		active[id] = false
		done[id] = true
		return nil
	}
	for _, id := range p.Roots {
		if err := visit(id, 0); err != nil {
			return err
		}
	}
	if len(done) != len(models) {
		return fmt.Errorf("unreachable model definitions")
	}
	counts := map[string]int{}
	var count func(string) (int, error)
	count = func(id string) (int, error) {
		if n, ok := counts[id]; ok {
			return n, nil
		}
		total := 1
		for _, c := range models[id].Components {
			n, err := count(c.ModelID)
			if err != nil {
				return 0, err
			}
			total += n
			if total > 10000 {
				return 0, fmt.Errorf("expanded hierarchy exceeds 10000 occurrences")
			}
		}
		counts[id] = total
		return total, nil
	}
	total := 0
	roots := map[string]bool{}
	for _, id := range p.Roots {
		if roots[id] {
			return fmt.Errorf("duplicate root")
		}
		roots[id] = true
		n, err := count(id)
		if err != nil {
			return err
		}
		total += n
		if total > 10000 {
			return fmt.Errorf("expanded hierarchy exceeds 10000 occurrences")
		}
	}
	return nil
}

func parameterValue(kind modeljson.ParameterType, value any) bool {
	switch kind {
	case modeljson.ParameterTypeString:
		_, ok := value.(string)
		return ok
	case modeljson.ParameterTypeBool:
		_, ok := value.(bool)
		return ok
	case modeljson.ParameterTypeObject:
		switch value.(type) {
		case map[string]any, []any:
			return true
		}
		return false
	case modeljson.ParameterTypeInt, modeljson.ParameterTypeFloat:
		var n float64
		switch v := value.(type) {
		case float64:
			n = v
		case int:
			n = float64(v)
		case json.Number:
			parsed, err := v.Float64()
			if err != nil {
				return false
			}
			n = parsed
		default:
			return false
		}
		return !math.IsNaN(n) && !math.IsInf(n, 0) && (kind != modeljson.ParameterTypeInt || math.Trunc(n) == n)
	}
	return false
}
