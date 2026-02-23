package lib

import (
	jsonModel "devsforge/json"
	"devsforge/model"
	"fmt"
	"sort"
	"strings"
)

func BuildWebAppContract(models []model.Model, rootID string) (jsonModel.WebAppContract, error) {
	rootModel := getModelWithId(models, rootID)
	if rootModel == nil {
		return jsonModel.WebAppContract{}, ErrModelNotFound
	}

	modelMap := make(map[string]*model.Model, len(models))
	for i := range models {
		modelMap[models[i].ID] = &models[i]
	}

	atomicNodes := collectFlattenedAtomics(rootModel, modelMap, []string{}, nil)
	parameterBindings := make([]jsonModel.WebAppParameterBinding, 0)
	seenParameterBindingKeys := make(map[string]struct{})

	for _, node := range atomicNodes {
		runnableParameters, err := buildRunnableParameters(node)
		if err != nil {
			return jsonModel.WebAppContract{}, err
		}

		instancePath := pathToString(node.path)
		instanceModelID := toRuntimeInstanceModelID(rootID, instancePath)
		modelName := strings.TrimSpace(node.model.Name)
		if modelName == "" {
			modelName = node.model.ID
		}

		for _, runnableParameter := range runnableParameters {
			parameterName := strings.TrimSpace(runnableParameter.Name)
			if parameterName == "" {
				return jsonModel.WebAppContract{}, fmt.Errorf(
					"invalid parameter: empty name in instance %s",
					instanceModelID,
				)
			}

			parameterType := strings.TrimSpace(string(runnableParameter.Type))
			if parameterType == "" {
				parameterType = string(jsonModel.ParameterTypeObject)
			}

			bindingKey := makeParameterBindingKey(instanceModelID, parameterName)
			if _, exists := seenParameterBindingKeys[bindingKey]; exists {
				return jsonModel.WebAppContract{}, fmt.Errorf("duplicate parameter binding key %q", bindingKey)
			}
			seenParameterBindingKeys[bindingKey] = struct{}{}

			parameterBindings = append(parameterBindings, jsonModel.WebAppParameterBinding{
				BindingKey:      bindingKey,
				InstanceModelID: instanceModelID,
				InstancePath:    instancePath,
				ModelID:         node.model.ID,
				ModelName:       modelName,
				Name:            parameterName,
				Type:            jsonModel.ParameterType(parameterType),
				DefaultValue:    runnableParameter.Value,
				Description:     runnableParameter.Description,
			})
		}
	}

	sort.Slice(parameterBindings, func(i, j int) bool {
		if parameterBindings[i].InstanceModelID == parameterBindings[j].InstanceModelID {
			return parameterBindings[i].Name < parameterBindings[j].Name
		}
		return parameterBindings[i].InstanceModelID < parameterBindings[j].InstanceModelID
	})

	inputPortBindings := make([]jsonModel.WebAppPortBinding, 0)
	outputPortBindings := make([]jsonModel.WebAppPortBinding, 0)
	seenPortBindingKeys := make(map[string]struct{})
	for _, port := range rootModel.Ports {
		portID := strings.TrimSpace(port.ID)
		portName := strings.TrimSpace(port.Name)
		if portName == "" {
			portName = portID
		}
		if portID == "" {
			portID = portName
		}

		if portName == "" {
			return jsonModel.WebAppContract{}, fmt.Errorf("invalid root port: missing id/name")
		}

		bindingKey := makePortBindingKey(string(port.Type), portName)
		if _, exists := seenPortBindingKeys[bindingKey]; exists {
			return jsonModel.WebAppContract{}, fmt.Errorf("duplicate port binding key %q", bindingKey)
		}
		seenPortBindingKeys[bindingKey] = struct{}{}

		binding := jsonModel.WebAppPortBinding{
			BindingKey: bindingKey,
			PortID:     portID,
			Name:       portName,
			Direction:  port.Type,
		}
		if port.Type == "in" {
			inputPortBindings = append(inputPortBindings, binding)
		} else if port.Type == "out" {
			outputPortBindings = append(outputPortBindings, binding)
		}
	}

	sort.Slice(inputPortBindings, func(i, j int) bool {
		return inputPortBindings[i].Name < inputPortBindings[j].Name
	})
	sort.Slice(outputPortBindings, func(i, j int) bool {
		return outputPortBindings[i].Name < outputPortBindings[j].Name
	})

	return jsonModel.WebAppContract{
		ModelID:            rootModel.ID,
		ModelName:          rootModel.Name,
		ModelDescription:   rootModel.Description,
		ParameterBindings:  parameterBindings,
		InputPortBindings:  inputPortBindings,
		OutputPortBindings: outputPortBindings,
	}, nil
}

func BuildWebAppSkeleton(contract jsonModel.WebAppContract, _ string) jsonModel.WebAppUISchema {
	runButtonLabel := "Run simulation"
	layout := "two-column"

	sections := make([]jsonModel.WebAppUISection, 0, 4)

	if len(contract.ParameterBindings) > 0 {
		parameterKeys := make([]string, 0, len(contract.ParameterBindings))
		for _, binding := range contract.ParameterBindings {
			parameterKeys = append(parameterKeys, binding.BindingKey)
		}

		sections = append(sections, jsonModel.WebAppUISection{
			ID:                   "parameters",
			Kind:                 jsonModel.WebAppUISectionKindParameters,
			Title:                "Parameters",
			Description:          "Edit runtime parameters before starting the simulation.",
			ParameterBindingKeys: parameterKeys,
			PortBindingKeys:      []string{},
		})
	}

	if len(contract.InputPortBindings) > 0 {
		portKeys := make([]string, 0, len(contract.InputPortBindings))
		for _, binding := range contract.InputPortBindings {
			portKeys = append(portKeys, binding.BindingKey)
		}

		sections = append(sections, jsonModel.WebAppUISection{
			ID:                   "inputs",
			Kind:                 jsonModel.WebAppUISectionKindInputs,
			Title:                "Input ports",
			Description:          "Model input interface exposed by the contract.",
			ParameterBindingKeys: []string{},
			PortBindingKeys:      portKeys,
		})
	}

	if len(contract.OutputPortBindings) > 0 {
		portKeys := make([]string, 0, len(contract.OutputPortBindings))
		for _, binding := range contract.OutputPortBindings {
			portKeys = append(portKeys, binding.BindingKey)
		}

		sections = append(sections, jsonModel.WebAppUISection{
			ID:                   "outputs",
			Kind:                 jsonModel.WebAppUISectionKindOutputs,
			Title:                "Output ports",
			Description:          "Observe messages produced by the model.",
			ParameterBindingKeys: []string{},
			PortBindingKeys:      portKeys,
		})
	}

	sections = append(sections, jsonModel.WebAppUISection{
		ID:                   "run",
		Kind:                 jsonModel.WebAppUISectionKindRun,
		Title:                "Run",
		Description:          "Start the simulation and inspect runtime events.",
		ParameterBindingKeys: []string{},
		PortBindingKeys:      []string{},
	})

	return jsonModel.WebAppUISchema{
		Version:        1,
		Layout:         layout,
		RunButtonLabel: runButtonLabel,
		Sections:       sections,
	}
}

func ValidateWebAppUISchemaAgainstContract(schema jsonModel.WebAppUISchema, contract jsonModel.WebAppContract) error {
	if schema.Version <= 0 {
		return fmt.Errorf("ui schema version must be greater than zero")
	}
	if strings.TrimSpace(schema.RunButtonLabel) == "" {
		return fmt.Errorf("ui schema runButtonLabel cannot be empty")
	}
	if len(schema.Sections) == 0 {
		return fmt.Errorf("ui schema sections cannot be empty")
	}

	requiredParamKeys := make(map[string]struct{}, len(contract.ParameterBindings))
	for _, binding := range contract.ParameterBindings {
		requiredParamKeys[binding.BindingKey] = struct{}{}
	}
	requiredInputPortKeys := make(map[string]struct{}, len(contract.InputPortBindings))
	for _, binding := range contract.InputPortBindings {
		requiredInputPortKeys[binding.BindingKey] = struct{}{}
	}
	requiredOutputPortKeys := make(map[string]struct{}, len(contract.OutputPortBindings))
	for _, binding := range contract.OutputPortBindings {
		requiredOutputPortKeys[binding.BindingKey] = struct{}{}
	}

	seenParamKeys := make(map[string]struct{}, len(requiredParamKeys))
	seenInputPortKeys := make(map[string]struct{}, len(requiredInputPortKeys))
	seenOutputPortKeys := make(map[string]struct{}, len(requiredOutputPortKeys))
	seenSections := make(map[string]struct{}, len(schema.Sections))
	hasRunSection := false

	for _, section := range schema.Sections {
		sectionID := strings.TrimSpace(section.ID)
		if sectionID == "" {
			return fmt.Errorf("ui schema section id cannot be empty")
		}
		if _, exists := seenSections[sectionID]; exists {
			return fmt.Errorf("duplicate ui schema section id %q", sectionID)
		}
		seenSections[sectionID] = struct{}{}

		switch section.Kind {
		case jsonModel.WebAppUISectionKindParameters:
			if len(section.PortBindingKeys) > 0 {
				return fmt.Errorf("section %q cannot include portBindingKeys for parameters kind", sectionID)
			}
		case jsonModel.WebAppUISectionKindInputs:
			if len(section.ParameterBindingKeys) > 0 {
				return fmt.Errorf("section %q cannot include parameterBindingKeys for inputs kind", sectionID)
			}
		case jsonModel.WebAppUISectionKindOutputs:
			if len(section.ParameterBindingKeys) > 0 {
				return fmt.Errorf("section %q cannot include parameterBindingKeys for outputs kind", sectionID)
			}
		case jsonModel.WebAppUISectionKindRun:
			hasRunSection = true
			if len(section.ParameterBindingKeys) > 0 || len(section.PortBindingKeys) > 0 {
				return fmt.Errorf("section %q of kind run cannot include binding keys", sectionID)
			}
		case jsonModel.WebAppUISectionKindCustom:
			// custom sections can be layout-only and do not bind contract fields.
		default:
			return fmt.Errorf("section %q has unknown kind %q", sectionID, section.Kind)
		}

		for _, key := range section.ParameterBindingKeys {
			normalizedKey := strings.TrimSpace(key)
			if normalizedKey == "" {
				return fmt.Errorf("section %q contains empty parameter binding key", sectionID)
			}
			if _, exists := requiredParamKeys[normalizedKey]; !exists {
				return fmt.Errorf("section %q references unknown parameter binding key %q", sectionID, normalizedKey)
			}
			if _, exists := seenParamKeys[normalizedKey]; exists {
				return fmt.Errorf("duplicate parameter binding key %q in ui schema", normalizedKey)
			}
			seenParamKeys[normalizedKey] = struct{}{}
		}

		for _, key := range section.PortBindingKeys {
			normalizedKey := strings.TrimSpace(key)
			if normalizedKey == "" {
				return fmt.Errorf("section %q contains empty port binding key", sectionID)
			}
			if _, exists := requiredInputPortKeys[normalizedKey]; exists {
				if section.Kind == jsonModel.WebAppUISectionKindOutputs {
					return fmt.Errorf("section %q is outputs but references input port key %q", sectionID, normalizedKey)
				}
				if _, duplicate := seenInputPortKeys[normalizedKey]; duplicate {
					return fmt.Errorf("duplicate input port binding key %q in ui schema", normalizedKey)
				}
				seenInputPortKeys[normalizedKey] = struct{}{}
				continue
			}
			if _, exists := requiredOutputPortKeys[normalizedKey]; exists {
				if section.Kind == jsonModel.WebAppUISectionKindInputs {
					return fmt.Errorf("section %q is inputs but references output port key %q", sectionID, normalizedKey)
				}
				if _, duplicate := seenOutputPortKeys[normalizedKey]; duplicate {
					return fmt.Errorf("duplicate output port binding key %q in ui schema", normalizedKey)
				}
				seenOutputPortKeys[normalizedKey] = struct{}{}
				continue
			}
			return fmt.Errorf("section %q references unknown port binding key %q", sectionID, normalizedKey)
		}
	}

	if !hasRunSection {
		return fmt.Errorf("ui schema must include one run section")
	}
	if len(seenParamKeys) != len(requiredParamKeys) {
		return fmt.Errorf("ui schema must include all parameter bindings")
	}
	if len(seenInputPortKeys) != len(requiredInputPortKeys) {
		return fmt.Errorf("ui schema must include all input port bindings")
	}
	if len(seenOutputPortKeys) != len(requiredOutputPortKeys) {
		return fmt.Errorf("ui schema must include all output port bindings")
	}

	return nil
}

func toRuntimeInstanceModelID(rootID string, instancePath string) string {
	normalizedRootID := strings.Trim(strings.TrimSpace(rootID), "/")
	normalizedPath := strings.Trim(strings.TrimSpace(instancePath), "/")

	if normalizedPath == "" {
		return normalizedRootID
	}
	if normalizedRootID == "" {
		return normalizedPath
	}
	return normalizedRootID + "/" + normalizedPath
}

func makeParameterBindingKey(instanceModelID string, parameterName string) string {
	return strings.TrimSpace(instanceModelID) + "::" + strings.TrimSpace(parameterName)
}

func makePortBindingKey(direction string, portName string) string {
	return "root::" + strings.TrimSpace(direction) + "::" + strings.TrimSpace(portName)
}
