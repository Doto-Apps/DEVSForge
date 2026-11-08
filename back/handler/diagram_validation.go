package handler

import (
	"devsforge/response"
	"fmt"
	"strings"
)

// Validate containment separately from DEVS feedback connections.
func validateDiagram(models []response.Model, connections []response.Connection, external string) []string {
	issues := []string{}
	byID := map[string]response.Model{}
	for _, m := range models {
		if m.ID == "" || strings.ContainsAny(m.ID, "/:") {
			issues = append(issues, "model identifiers cannot be empty or contain / or :")
		}
		if _, ok := byID[m.ID]; ok {
			issues = append(issues, "duplicate model "+m.ID)
		}
		byID[m.ID] = m
		if m.Type != response.ModelTypeAtomic && m.Type != response.ModelTypeCoupled {
			issues = append(issues, "invalid model type for "+m.ID)
		}
		if m.Type == response.ModelTypeAtomic && len(m.Components) > 0 {
			issues = append(issues, "atomic model has components: "+m.ID)
		}
	}
	pending, visited := map[string]bool{}, map[string]bool{}
	var walk func(string)
	walk = func(id string) {
		if pending[id] {
			issues = append(issues, "containment cycle at "+id)
			return
		}
		if visited[id] || id == external {
			return
		}
		visited[id] = true
		pending[id] = true
		seen := map[string]bool{}
		for _, child := range byID[id].Components {
			if seen[child] {
				issues = append(issues, "duplicate component in "+id)
			}
			seen[child] = true
			if _, ok := byID[child]; !ok {
				issues = append(issues, "unknown component "+child)
			} else {
				walk(child)
			}
		}
		delete(pending, id)
	}
	for _, m := range models {
		walk(m.ID)
	}
	for i := range connections {
		c := &connections[i]
		source, fromOK := byID[c.From.Model]
		target, toOK := byID[c.To.Model]
		if !fromOK || !toOK {
			issues = append(issues, fmt.Sprintf("connection %d references an unknown model", i+1))
			continue
		}
		candidates := []string{}
		for _, m := range models {
			if m.Type != response.ModelTypeCoupled || m.ID == external {
				continue
			}
			from := m.ID == source.ID || containsString(m.Components, source.ID)
			to := m.ID == target.ID || containsString(m.Components, target.ID)
			if from && to && (m.ID != source.ID || m.ID != target.ID) {
				candidates = append(candidates, m.ID)
			}
		}
		owner := c.Owner
		if owner == "" && len(candidates) == 1 {
			owner = candidates[0]
		}
		if !containsString(candidates, owner) {
			issues = append(issues, fmt.Sprintf("connection %d needs a coupled owner and cannot cross hierarchy levels", i+1))
			continue
		}
		c.Owner = owner
		sourceDirection, targetDirection := response.PortDirectionOut, response.PortDirectionIn
		if source.ID == owner {
			sourceDirection = response.PortDirectionIn
		}
		if target.ID == owner {
			targetDirection = response.PortDirectionOut
		}
		if !hasPortByNameAndDirection(source.Ports, c.From.Port, sourceDirection) || !hasPortByNameAndDirection(target.Ports, c.To.Port, targetDirection) {
			issues = append(issues, fmt.Sprintf("connection %d has an invalid port or direction", i+1))
		}
	}
	return issues
}

func descendant(root, child string, components map[string][]string) bool {
	seen := map[string]bool{}
	var visit func(string) bool
	visit = func(id string) bool {
		if id == child {
			return true
		}
		if seen[id] {
			return false
		}
		seen[id] = true
		for _, next := range components[id] {
			if visit(next) {
				return true
			}
		}
		return false
	}
	return visit(root)
}
