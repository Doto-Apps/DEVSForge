package handler

import (
	"devsforge/response"
	"testing"
)

func TestHierarchicalCouplingsAndContainmentCycles(t *testing.T) {
	ports := []response.PortResponse{{Name: "in", Type: response.PortDirectionIn}, {Name: "out", Type: response.PortDirectionOut}}
	models := []response.Model{{ID: "root", Type: response.ModelTypeCoupled, Ports: ports, Components: []string{"sub"}}, {ID: "sub", Type: response.ModelTypeCoupled, Ports: ports, Components: []string{"leaf"}}, {ID: "leaf", Type: response.ModelTypeAtomic, Ports: ports}}
	links := []response.Connection{{Owner: "sub", From: response.Endpoint{Model: "sub", Port: "in"}, To: response.Endpoint{Model: "leaf", Port: "in"}}, {Owner: "sub", From: response.Endpoint{Model: "leaf", Port: "out"}, To: response.Endpoint{Model: "sub", Port: "out"}}, {Owner: "sub", From: response.Endpoint{Model: "leaf", Port: "out"}, To: response.Endpoint{Model: "leaf", Port: "in"}}}
	if issues := validateDiagram(models, links, ""); len(issues) > 0 {
		t.Fatal(issues)
	}
	links[0].Owner = "root"
	if len(validateDiagram(models, links, "")) == 0 {
		t.Fatal("cross-level connection accepted")
	}
	models[1].Components = append(models[1].Components, "root")
	if len(validateDiagram(models, nil, "")) == 0 {
		t.Fatal("containment cycle accepted")
	}
}
