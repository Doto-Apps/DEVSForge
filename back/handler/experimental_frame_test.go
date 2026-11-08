package handler

import (
	"reflect"
	"testing"

	"devsforge/enum"
	"devsforge/json"
	"devsforge/model"
	"devsforge/request"
)

func TestBuildCoupledConnectionsKeepsRootCouplingsWithModelNames(t *testing.T) {
	rootSpec := request.AssistedExperimentalFrameModel{
		ID:         "system-id",
		Name:       "System",
		Type:       enum.Coupled,
		Components: []string{"sensor-id"},
	}

	modelByID := map[string]request.AssistedExperimentalFrameModel{
		rootSpec.ID: rootSpec,
		"sensor-id": {
			ID:   "sensor-id",
			Name: "Sensor",
			Type: enum.Atomic,
		},
	}

	got := buildCoupledConnections(
		rootSpec,
		modelByID,
		map[string]string{"sensor-id": "sensor-instance"},
		[]request.AssistedExperimentalFrameConnection{
			{
				From: request.AssistedExperimentalFrameEndpoint{Model: "System", Port: "tick"},
				To:   request.AssistedExperimentalFrameEndpoint{Model: "Sensor", Port: "tick"},
			},
			{
				From: request.AssistedExperimentalFrameEndpoint{Model: "Sensor", Port: "value"},
				To:   request.AssistedExperimentalFrameEndpoint{Model: "System", Port: "value"},
			},
			{
				From: request.AssistedExperimentalFrameEndpoint{Model: "root", Port: "reset"},
				To:   request.AssistedExperimentalFrameEndpoint{Model: "Sensor", Port: "reset"},
			},
		},
	)

	want := []json.ModelConnection{
		{
			From: json.ModelLink{InstanceID: "root", Port: "tick"},
			To:   json.ModelLink{InstanceID: "sensor-instance", Port: "tick"},
		},
		{
			From: json.ModelLink{InstanceID: "sensor-instance", Port: "value"},
			To:   json.ModelLink{InstanceID: "root", Port: "value"},
		},
		{
			From: json.ModelLink{InstanceID: "root", Port: "reset"},
			To:   json.ModelLink{InstanceID: "sensor-instance", Port: "reset"},
		},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected connections:\nwant: %#v\n got: %#v", want, got)
	}
}

func TestNestedExperimentalFrameKeepsCoupledTargetOpaque(t *testing.T) {
	target := model.Model{ID: "existing-mut", Name: "Existing coupled model", Type: enum.Coupled, Components: []json.ModelComponent{{InstanceID: "old-instance", ModelID: "existing-child"}}}
	req := request.ExperimentalFrameRequest{TargetModelID: target.ID, ModelUnderTestID: target.ID, RootModelID: "room", Models: []request.AssistedExperimentalFrameModel{
		{ID: "room", Name: "Room", Type: enum.Coupled, Components: []string{"middle"}},
		{ID: "middle", Name: "Middle", Type: enum.Coupled, Components: []string{"inner"}},
		{ID: "inner", Name: "Inner", Type: enum.Coupled, Components: []string{target.ID}},
		{ID: target.ID, Name: target.Name, Type: enum.Coupled, Components: []string{"existing-child"}},
	}}
	before := append([]json.ModelComponent{}, target.Components...)
	if _, err := validateAssistedExperimentalFrameRequest(&req, target); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, target.Components) {
		t.Fatal("target components changed")
	}
	req.Models[2].Components = []string{"room"}
	if _, err := validateAssistedExperimentalFrameRequest(&req, target); err == nil {
		t.Fatal("accepted containment cycle or missing target")
	}
}
