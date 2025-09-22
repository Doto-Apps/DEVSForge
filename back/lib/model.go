package lib

import (
	"devsforge/back/json"
	"devsforge/back/model"
	"errors"
	"fmt"
)

func GetDevsSympyJSON(models []model.Model, rootId string) (res json.Diagram, err error) {

	var rootModel *model.Model
	rootModel = getModelWithId(models, rootId)

	if rootModel == nil {
		return res, errors.New("NOT_FOUND")
	}

	firstModelComponent := json.ModelComponent{
		InstanceID:       rootModel.ID,
		ModelID:          rootModel.ID,
		InstanceMetadata: &rootModel.Metadata,
	}
	res.Description = "Test for simulation on devsimpy"
	res.Cells = recursiveParser(models, firstModelComponent) // <--- ici, plus besoin de []
	return res, nil
}
func getModelWithId(models []model.Model, id string) *model.Model {
	for i := range models {
		if models[i].ID == id {
			return &models[i]
		}
	}
	return nil
}

func createSimulationModel(model model.Model, modelComponent json.ModelComponent) json.Cell {
	var cellType string
	var embeds []string
	if model.Type == "atomic" {
		cellType = "devs.Atomic"
	} else {
		cellType = "devs.Coupled"
		for _, childModel := range model.Components {
			embeds = append(embeds, childModel.InstanceID)
		}
	}

	inPorts := getSimulationPort("in", model.Ports)
	outPorts := getSimulationPort("out", model.Ports)

	return json.Cell{
		Type:     cellType,
		ID:       0,
		Label:    &modelComponent.InstanceID,
		InPorts:  &inPorts,
		OutPorts: &outPorts,
		Behavior: getSimulationBehaviour(model, modelComponent),
		Embeds:   &embeds,
	}
}

func getSimulationBehaviour(model model.Model, modelComponent json.ModelComponent) *json.Behavior {
	var behaviour json.Behavior
	behaviour.PythonPath = model.ID + ".py"
	behaviour.ModelPath = ""
	behaviour.Attrs = map[string]interface{}{
		"text": map[string]interface{}{
			"text": model.Name,
		},
	}

	if model.Type == "atomic" {
		var params []json.ModelParameter
		if modelComponent.InstanceMetadata != nil && len(modelComponent.InstanceMetadata.Parameters) > 0 {
			params = modelComponent.InstanceMetadata.Parameters
		} else if model.Metadata.Parameters != nil && len(model.Metadata.Parameters) > 0 {
			params = model.Metadata.Parameters
		}

		dataMap := make(map[string]interface{})
		for _, param := range params {
			switch param.Type {
			case json.ParameterTypeInt:
				if v, ok := param.Value.(float64); ok {
					dataMap[param.Name] = int(v)
				} else {
					dataMap[param.Name] = param.Value
				}
			case json.ParameterTypeFloat:
				if v, ok := param.Value.(float64); ok {
					dataMap[param.Name] = v
				} else {
					dataMap[param.Name] = param.Value
				}
			case json.ParameterTypeBool:
				if v, ok := param.Value.(bool); ok {
					dataMap[param.Name] = v
				} else {
					dataMap[param.Name] = param.Value
				}
			case json.ParameterTypeString:
				if v, ok := param.Value.(string); ok {
					dataMap[param.Name] = v
				} else {
					dataMap[param.Name] = param.Value
				}
			default:
				dataMap[param.Name] = param.Value
			}
		}

		behaviour.Prop = map[string]interface{}{
			"data": dataMap,
		}
	}
	return &behaviour
}

func getSimulationPort(portType string, ports []json.ModelPort) (res []string) {
	for _, port := range ports {
		if string(port.Type) == portType {
			res = append(res, port.ID)
		}
	}
	return res
}

func getSourceTarget(connection json.ModelConnection, component json.ModelComponent) (source string, target string) {
	source = connection.From.InstanceID
	target = connection.To.InstanceID

	if source == "root" {
		source = component.ModelID
	}
	if target == "root" {
		target = component.ModelID
	}

	return source, target
}

func getConnectionId(connection json.ModelConnection, component json.ModelComponent) string {
	source, target := getSourceTarget(connection, component)

	return fmt.Sprintf("%s:%s->%s:%s", source, connection.From.Port, target, connection.To.Port)
}

func getSimulationConnection(connection json.ModelConnection, model model.Model, component json.ModelComponent) json.Cell {
	source, target := getSourceTarget(connection, component)
	return json.Cell{
		Type:  "devs.Link",
		ID:    getConnectionId(connection, component),
		Z:     0,
		Attrs: map[string]any{},
		Source: &json.LinkEndpoint{
			ID:   source,
			Port: connection.From.Port,
		},
		Target: &json.LinkEndpoint{
			ID:   target,
			Port: connection.To.Port,
		},
		Prop: nil,
	}
}

func recursiveParser(models []model.Model, modelComponent json.ModelComponent) (res []json.Cell) {
	actualModel := getModelWithId(models, modelComponent.ModelID)
	if actualModel == nil {
		return res
	}

	for _, child := range actualModel.Components {
		res = append(res, recursiveParser(models, child)...)
	}

	// ajout des model link
	for _, conn := range actualModel.Connections {
		res = append(res, getSimulationConnection(conn, *actualModel, modelComponent))
	}

	//ajout des model atom ou coup
	res = append(res, createSimulationModel(*actualModel, modelComponent))

	return res
}
