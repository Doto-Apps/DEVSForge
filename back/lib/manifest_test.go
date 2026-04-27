package lib

import (
	"devsforge/enum"
	"devsforge/json"
	"devsforge/model"
	"slices"
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
	if manifest.Models[0].ID != "root-1/child-instance-1" {
		t.Fatalf("expected runnable ID root-1/child-instance-1, got %q", manifest.Models[0].ID)
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

func TestModelToManifest_UsesCanonicalRootAtomicInstanceID(t *testing.T) {
	atomic := buildAtomicModel(
		"atomic-root",
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

	if manifest.Models[0].ID != atomic.ID {
		t.Fatalf("expected runnable model ID %q, got %q", atomic.ID, manifest.Models[0].ID)
	}
}

func TestModelToManifest_UsesInstanceIDsAndRoutesDistinctInstances(t *testing.T) {
	reusedAtomic := buildAtomicModel("atomic-reused", nil)
	sinkAtomic := buildAtomicModel("atomic-sink", nil)

	root := buildCoupledRootWithConnections(
		"root-1",
		[]json.ModelComponent{
			{InstanceID: "gen-a", ModelID: reusedAtomic.ID},
			{InstanceID: "gen-b", ModelID: reusedAtomic.ID},
			{InstanceID: "sink", ModelID: sinkAtomic.ID},
		},
		[]json.ModelConnection{
			{
				From: json.ModelLink{InstanceID: "gen-a", Port: "out1"},
				To:   json.ModelLink{InstanceID: "sink", Port: "in1"},
			},
			{
				From: json.ModelLink{InstanceID: "gen-b", Port: "out1"},
				To:   json.ModelLink{InstanceID: "sink", Port: "in1"},
			},
		},
	)

	manifest, err := ModelToManifest(
		[]model.Model{root, reusedAtomic, sinkAtomic},
		root.ID,
		"sim-1",
		100,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(manifest.Models) != 3 {
		t.Fatalf("expected 3 runnable models, got %d", len(manifest.Models))
	}

	ids := make([]string, 0, len(manifest.Models))
	runnableIndexByID := make(map[string]int)
	for idx, runnable := range manifest.Models {
		ids = append(ids, runnable.ID)
		runnableIndexByID[runnable.ID] = idx
	}
	slices.Sort(ids)
	expectedIDs := []string{
		"root-1/gen-a",
		"root-1/gen-b",
		"root-1/sink",
	}
	for _, expectedID := range expectedIDs {
		if _, ok := runnableIndexByID[expectedID]; !ok {
			t.Fatalf("missing runnable model %q, got IDs: %v", expectedID, ids)
		}
	}

	genAConnections := manifest.Models[runnableIndexByID["root-1/gen-a"]].Connections
	if len(genAConnections) != 1 {
		t.Fatalf("expected gen-a to have 1 connection, got %d", len(genAConnections))
	}
	if genAConnections[0].From.ID != "root-1/gen-a" || genAConnections[0].To.ID != "root-1/sink" {
		t.Fatalf("unexpected gen-a connection: %#v", genAConnections[0])
	}

	genBConnections := manifest.Models[runnableIndexByID["root-1/gen-b"]].Connections
	if len(genBConnections) != 1 {
		t.Fatalf("expected gen-b to have 1 connection, got %d", len(genBConnections))
	}
	if genBConnections[0].From.ID != "root-1/gen-b" || genBConnections[0].To.ID != "root-1/sink" {
		t.Fatalf("unexpected gen-b connection: %#v", genBConnections[0])
	}

	if len(manifest.Models[runnableIndexByID["root-1/sink"]].Connections) != 0 {
		t.Fatalf("expected sink to have no outgoing connections")
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

func buildCoupledRootWithConnections(
	rootID string,
	components []json.ModelComponent,
	connections []json.ModelConnection,
) model.Model {
	return model.Model{
		ID:          rootID,
		Name:        rootID,
		Type:        enum.Coupled,
		Language:    enum.ModelLanguagePython,
		Code:        "print('coupled')",
		Components:  components,
		Connections: connections,
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
