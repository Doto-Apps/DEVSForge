package lib

import (
	"devsforge/enum"
	"devsforge/json"
	"devsforge/model"
	"strings"
	"testing"
)

func TestModelToManifest_UsesBaseParametersWithoutOverride(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)

	manifest, err := ModelToManifest(
		[]model.Model{atomic},
		atomic.ID,
		"sim-1",
		100,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(manifest.Models) != 1 {
		t.Fatalf("expected 1 runnable model, got %d", len(manifest.Models))
	}

	params := manifest.Models[0].Parameters
	if len(params) != 1 {
		t.Fatalf("expected 1 parameter, got %d", len(params))
	}
	if params[0].Name != "threshold" {
		t.Fatalf("expected parameter name threshold, got %s", params[0].Name)
	}
	if v, ok := params[0].Value.(float64); !ok || v != 3 {
		t.Fatalf("expected threshold value 3, got %#v", params[0].Value)
	}
}

func TestModelToManifest_AppliesInstanceParameterOverride(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)
	root := buildCoupledRoot(
		"root-1",
		atomic.ID,
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(7),
			},
		},
	)

	manifest, err := ModelToManifest(
		[]model.Model{root, atomic},
		root.ID,
		"sim-1",
		100,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(manifest.Models) != 1 {
		t.Fatalf("expected 1 runnable model, got %d", len(manifest.Models))
	}

	params := manifest.Models[0].Parameters
	if len(params) != 1 {
		t.Fatalf("expected 1 parameter, got %d", len(params))
	}
	if v, ok := params[0].Value.(float64); !ok || v != 7 {
		t.Fatalf("expected overridden threshold value 7, got %#v", params[0].Value)
	}
}

func TestModelToManifest_FailsOnUnknownOverrideParameter(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)
	root := buildCoupledRoot(
		"root-1",
		atomic.ID,
		[]json.ModelParameter{
			{
				Name:  "unknownParam",
				Type:  json.ParameterTypeInt,
				Value: float64(7),
			},
		},
	)

	_, err := ModelToManifest(
		[]model.Model{root, atomic},
		root.ID,
		"sim-1",
		100,
		nil,
	)
	if err == nil {
		t.Fatalf("expected error for unknown override parameter")
	}
	if !strings.Contains(err.Error(), "unknown override parameter") {
		t.Fatalf("expected unknown override parameter error, got: %v", err)
	}
}

func TestModelToManifest_FailsOnOverrideTypeMismatch(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)
	root := buildCoupledRoot(
		"root-1",
		atomic.ID,
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeString,
				Value: "abc",
			},
		},
	)

	_, err := ModelToManifest(
		[]model.Model{root, atomic},
		root.ID,
		"sim-1",
		100,
		nil,
	)
	if err == nil {
		t.Fatalf("expected error for type mismatch")
	}
	if !strings.Contains(err.Error(), "type mismatch") {
		t.Fatalf("expected type mismatch error, got: %v", err)
	}
}

func TestModelToManifest_AppliesRuntimeOverride(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)
	root := buildCoupledRoot("root-1", atomic.ID, nil)

	manifest, err := ModelToManifest(
		[]model.Model{root, atomic},
		root.ID,
		"sim-1",
		100,
		[]RuntimeInstanceOverride{
			{
				InstanceModelID: "root-1/child-instance-1",
				OverrideParams: []RuntimeParameterOverride{
					{Name: "threshold", Value: float64(11)},
				},
			},
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(manifest.Models) != 1 {
		t.Fatalf("expected 1 runnable model, got %d", len(manifest.Models))
	}
	if v, ok := manifest.Models[0].Parameters[0].Value.(float64); !ok || v != 11 {
		t.Fatalf("expected runtime overridden threshold value 11, got %#v", manifest.Models[0].Parameters[0].Value)
	}
}

func TestModelToManifest_FailsOnUnknownRuntimeInstance(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-1",
		[]json.ModelParameter{
			{
				Name:  "threshold",
				Type:  json.ParameterTypeInt,
				Value: float64(3),
			},
		},
	)
	root := buildCoupledRoot("root-1", atomic.ID, nil)

	_, err := ModelToManifest(
		[]model.Model{root, atomic},
		root.ID,
		"sim-1",
		100,
		[]RuntimeInstanceOverride{
			{
				InstanceModelID: "root-1/unknown-instance",
				OverrideParams: []RuntimeParameterOverride{
					{Name: "threshold", Value: float64(11)},
				},
			},
		},
	)
	if err == nil {
		t.Fatalf("expected unknown runtime instance error")
	}
	if !strings.Contains(err.Error(), "unknown runtime override instanceModelId") {
		t.Fatalf("expected unknown runtime instance error, got: %v", err)
	}
}

func buildAtomicModel(modelID string, parameters []json.ModelParameter) model.Model {
	return model.Model{
		ID:       modelID,
		Name:     modelID,
		Type:     enum.Atomic,
		Language: enum.ModelLanguagePython,
		Code:     "print('atomic')",
		Ports: []json.ModelPort{
			{ID: "in1", Name: "in1", Type: enum.ModelPortDirectionIn},
			{ID: "out1", Name: "out1", Type: enum.ModelPortDirectionOut},
		},
		Metadata: json.ModelMetadata{
			Position:   json.ModelPosition{X: 0, Y: 0},
			Style:      json.ModelStyle{Width: 100, Height: 100},
			Keyword:    []string{},
			ModelRole:  strPtr("atomic"),
			Parameters: parameters,
		},
	}
}

func buildCoupledRoot(rootID string, childModelID string, overrideParams []json.ModelParameter) model.Model {
	return model.Model{
		ID:       rootID,
		Name:     rootID,
		Type:     enum.Coupled,
		Language: enum.ModelLanguagePython,
		Code:     "print('coupled')",
		Components: []json.ModelComponent{
			{
				InstanceID: "child-instance-1",
				ModelID:    childModelID,
				InstanceMetadata: &json.ModelMetadata{
					Position:   json.ModelPosition{X: 10, Y: 10},
					Style:      json.ModelStyle{Width: 100, Height: 100},
					Keyword:    []string{},
					ModelRole:  strPtr("atomic"),
					Parameters: overrideParams,
				},
			},
		},
		Metadata: json.ModelMetadata{
			Position:  json.ModelPosition{X: 0, Y: 0},
			Style:     json.ModelStyle{Width: 100, Height: 100},
			Keyword:   []string{},
			ModelRole: strPtr("coupled"),
		},
	}
}

func strPtr(v string) *string {
	return &v
}
