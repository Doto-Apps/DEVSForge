package handler

import (
	"devsforge/enum"
	"devsforge/request"
	"testing"
)

func TestModelIntegrationCompatibilityAndValidation(t *testing.T) {
	id, version := "xdevs-java", "1.0.0"
	legacy := request.ModelRequest{Type: enum.Atomic, Language: "java"}
	if err := normalizeModelRequest(&legacy); err != nil || legacy.IntegrationID == nil || *legacy.IntegrationID != id || *legacy.IntegrationVersion != version {
		t.Fatalf("legacy mapping: %+v", legacy)
	}
	conflict := request.ModelRequest{Type: enum.Atomic, Language: "python", IntegrationID: &id, IntegrationVersion: &version}
	if normalizeModelRequest(&conflict) == nil {
		t.Fatal("contradictory integration accepted")
	}
	unknown := "missing"
	invalid := request.ModelRequest{Type: enum.Atomic, IntegrationID: &unknown, IntegrationVersion: &version}
	if normalizeModelRequest(&invalid) == nil {
		t.Fatal("unknown integration accepted")
	}
	coupled := request.ModelRequest{Type: enum.Coupled, Language: "java", IntegrationID: &id, IntegrationVersion: &version}
	if err := normalizeModelRequest(&coupled); err != nil || coupled.IntegrationID != nil || coupled.IntegrationVersion != nil || coupled.Language != "" {
		t.Fatalf("coupled integration retained: %+v", coupled)
	}
}
