package lib

import (
	"devsforge/json"
	"devsforge/model"
	"errors"
	"fmt"
	"math"
	"strings"

	shared "devsforge-shared"
	sharedEnum "devsforge-shared/enum"
)

var ErrModelNotFound = errors.New("MODEL_NOT_FOUND")

// ============================================================================
// Flattening Types
// ============================================================================

// flatNode represents an atomic model instance in the flattened hierarchy
type flatNode struct {
	modelID          string              // The actual model ID (for code lookup)
	model            *model.Model        // Reference to the model
	path             []string            // Path of instanceIDs from root to this node
	instanceID       string              // Unique flattened instance ID (for connections)
	instanceMetadata *json.ModelMetadata // Optional instance override metadata
	runtimeOverrides []RuntimeParameterOverride
}

type RuntimeParameterOverride struct {
	Name  string
	Value any
}

type RuntimeInstanceOverride struct {
	InstanceModelID string
	OverrideParams  []RuntimeParameterOverride
}

// ============================================================================
// Main Entry Point
// ============================================================================

// ModelToManifest converts a list of models from the database to a RunnableManifest
// that can be used by the simulator coordinator. It flattens multi-level coupled
// models into a flat list of atomic models with direct connections.
func ModelToManifest(
	models []model.Model,
	rootID string,
	simulationID string,
	maxTime float64,
	runtimeOverrides []RuntimeInstanceOverride,
) (*shared.RunnableManifest, error) {
	rootModel := getModelWithId(models, rootID)
	if rootModel == nil {
		return nil, ErrModelNotFound
	}

	// Build model lookup map
	modelMap := make(map[string]*model.Model)
	for i := range models {
		modelMap[models[i].ID] = &models[i]
	}

	// Step 1: Collect all atomic instances with their paths
	atomicNodes := collectFlattenedAtomics(rootModel, modelMap, []string{}, nil)

	// Step 1.5: Apply optional runtime parameter overrides
	if err := applyRuntimeOverrides(rootID, atomicNodes, runtimeOverrides); err != nil {
		return nil, err
	}

	// Step 2: Resolve all connections to direct atomic-to-atomic
	flatConnections := resolveFlattenedConnections(rootModel, modelMap, []string{}, atomicNodes)

	// Step 3: Build the manifest
	manifest := &shared.RunnableManifest{
		SimulationID: simulationID,
		MaxTime:      maxTime,
		Models:       make([]*shared.RunnableModel, 0, len(atomicNodes)),
		Count:        1,
	}

	for _, node := range atomicNodes {
		runnableModel, err := buildRunnableModel(node, flatConnections)
		if err != nil {
			return nil, err
		}
		manifest.Models = append(manifest.Models, runnableModel)
	}

	return manifest, nil
}

// ============================================================================
// Step 1: Collect Flattened Atomics
// ============================================================================

// collectFlattenedAtomics recursively collects all atomic models with their hierarchy paths
func collectFlattenedAtomics(
	m *model.Model,
	modelMap map[string]*model.Model,
	currentPath []string,
	instanceMetadata *json.ModelMetadata,
) []*flatNode {
	result := make([]*flatNode, 0)

	if m.Type == "atomic" {
		// Use model ID as instance ID for atomics (they are unique)
		result = append(result, &flatNode{
			modelID:          m.ID,
			model:            m,
			path:             currentPath,
			instanceID:       m.ID,
			instanceMetadata: instanceMetadata,
		})
		return result
	}

	// For coupled models, recurse into components
	for _, comp := range m.Components {
		childModel := modelMap[comp.ModelID]
		if childModel == nil {
			continue
		}

		// Build path: parent path + this component's instanceID
		childPath := append(append([]string{}, currentPath...), comp.InstanceID)

		result = append(
			result,
			collectFlattenedAtomics(childModel, modelMap, childPath, comp.InstanceMetadata)...,
		)
	}

	return result
}

func applyRuntimeOverrides(
	rootID string,
	atomicNodes []*flatNode,
	runtimeOverrides []RuntimeInstanceOverride,
) error {
	if len(runtimeOverrides) == 0 {
		return nil
	}

	byIdentifier := make(map[string]*flatNode)
	for _, node := range atomicNodes {
		identifiers := buildRuntimeIdentifiers(rootID, node)
		for _, identifier := range identifiers {
			if identifier == "" {
				continue
			}
			if existing, exists := byIdentifier[identifier]; exists && existing != node {
				return fmt.Errorf("ambiguous runtime identifier %q", identifier)
			}
			byIdentifier[identifier] = node
		}
	}

	for _, override := range runtimeOverrides {
		ref := normalizeRuntimeIdentifier(override.InstanceModelID)
		if ref == "" {
			return fmt.Errorf("invalid runtime override: empty instanceModelId")
		}

		target, exists := byIdentifier[ref]
		if !exists {
			return fmt.Errorf("unknown runtime override instanceModelId %q", override.InstanceModelID)
		}

		target.runtimeOverrides = append(target.runtimeOverrides, override.OverrideParams...)
	}

	return nil
}

func buildRuntimeIdentifiers(rootID string, node *flatNode) []string {
	identifiers := make([]string, 0, 3)
	path := normalizeRuntimeIdentifier(pathToString(node.path))
	root := normalizeRuntimeIdentifier(rootID)

	if path == "" {
		if root != "" {
			identifiers = append(identifiers, root)
		}
		if node.modelID != "" {
			identifiers = append(identifiers, normalizeRuntimeIdentifier(node.modelID))
		}
		return uniqueStrings(identifiers)
	}

	identifiers = append(identifiers, path)
	if root != "" {
		identifiers = append(identifiers, normalizeRuntimeIdentifier(root+"/"+path))
	}
	return uniqueStrings(identifiers)
}

func normalizeRuntimeIdentifier(raw string) string {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.Trim(trimmed, "/")
	return trimmed
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	res := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		res = append(res, value)
	}
	return res
}

// ============================================================================
// Step 2: Resolve Flattened Connections
// ============================================================================

// flatConnection represents a resolved direct connection between two atomics
type flatConnection struct {
	fromModelID string
	fromPort    string
	toModelID   string
	toPort      string
}

// resolveFlattenedConnections resolves all connections through the hierarchy
func resolveFlattenedConnections(rootModel *model.Model, modelMap map[string]*model.Model, rootPath []string, atomicNodes []*flatNode) []flatConnection {
	result := make([]flatConnection, 0)

	// Build a map of path -> atomic node for quick lookup
	pathToAtomic := make(map[string]*flatNode)
	for _, node := range atomicNodes {
		pathKey := pathToString(node.path)
		pathToAtomic[pathKey] = node
	}

	// Process all connections starting from root
	result = append(result, processModelConnections(rootModel, modelMap, rootPath, pathToAtomic)...)

	return result
}

// processModelConnections processes connections in a model and its children recursively
func processModelConnections(m *model.Model, modelMap map[string]*model.Model, currentPath []string, pathToAtomic map[string]*flatNode) []flatConnection {
	result := make([]flatConnection, 0)

	if m.Type == "atomic" {
		return result // Atomics don't have internal connections
	}

	// Process each connection in this coupled model
	for _, conn := range m.Connections {
		// Resolve from endpoint to atomic(s)
		fromEndpoints := resolveEndpointToAtomics(conn.From, m, modelMap, currentPath, pathToAtomic, "out")
		// Resolve to endpoint to atomic(s)
		toEndpoints := resolveEndpointToAtomics(conn.To, m, modelMap, currentPath, pathToAtomic, "in")

		// Create direct connections
		for _, from := range fromEndpoints {
			for _, to := range toEndpoints {
				result = append(result, flatConnection{
					fromModelID: from.modelID,
					fromPort:    from.port,
					toModelID:   to.modelID,
					toPort:      to.port,
				})
			}
		}
	}

	// Recurse into child coupled models
	for _, comp := range m.Components {
		childModel := modelMap[comp.ModelID]
		if childModel != nil && childModel.Type == "coupled" {
			childPath := append(append([]string{}, currentPath...), comp.InstanceID)
			result = append(result, processModelConnections(childModel, modelMap, childPath, pathToAtomic)...)
		}
	}

	return result
}

// resolvedEndpoint is an atomic endpoint (model ID + port)
type resolvedEndpoint struct {
	modelID string
	port    string
}

// resolveEndpointToAtomics resolves a connection endpoint to atomic model(s)
// portDirection is "in" or "out" to determine which way to follow the hierarchy
func resolveEndpointToAtomics(link json.ModelLink, context *model.Model, modelMap map[string]*model.Model, currentPath []string, pathToAtomic map[string]*flatNode, portDirection string) []resolvedEndpoint {
	result := make([]resolvedEndpoint, 0)

	if link.InstanceID == "root" {
		// Connection to/from the coupled model's own port
		// This means we need to look at the parent level (handled by parent's connections)
		// For now, if we're at root level, this is an external port - skip it
		return result
	}

	// Find the component
	var comp *json.ModelComponent
	for i := range context.Components {
		if context.Components[i].InstanceID == link.InstanceID {
			comp = &context.Components[i]
			break
		}
	}
	if comp == nil {
		return result
	}

	childModel := modelMap[comp.ModelID]
	if childModel == nil {
		return result
	}

	childPath := append(append([]string{}, currentPath...), comp.InstanceID)
	normalizedLinkPort := normalizePortIdentifier(childModel, link.Port)

	if childModel.Type == "atomic" {
		// Direct atomic - we found our endpoint
		result = append(result, resolvedEndpoint{
			modelID: childModel.ID,
			port:    normalizedLinkPort,
		})
		return result
	}

	// It's a coupled model - we need to follow the connection inside
	// Find connections that go from/to the coupled model's port
	if portDirection == "out" {
		// We're looking for the source of output: find what's connected to this output port inside
		result = append(result, traceOutputPortSources(childModel, normalizedLinkPort, modelMap, childPath, pathToAtomic)...)
	} else {
		// We're looking for the destination of input: find what this input port connects to inside
		result = append(result, traceInputPortDestinations(childModel, normalizedLinkPort, modelMap, childPath, pathToAtomic)...)
	}

	return result
}

// traceOutputPortSources finds all atomic sources that output to a coupled model's output port (EOC tracing)
func traceOutputPortSources(coupled *model.Model, outputPort string, modelMap map[string]*model.Model, currentPath []string, pathToAtomic map[string]*flatNode) []resolvedEndpoint {
	result := make([]resolvedEndpoint, 0)
	normalizedOutputPort := normalizePortIdentifier(coupled, outputPort)

	// Find connections where To is root (the coupled model) with the specified port
	for _, conn := range coupled.Connections {
		if conn.To.InstanceID == "root" &&
			normalizePortIdentifier(coupled, conn.To.Port) == normalizedOutputPort {
			// Found an EOC: From connects to this output port
			fromEndpoints := resolveEndpointToAtomics(conn.From, coupled, modelMap, currentPath, pathToAtomic, "out")
			result = append(result, fromEndpoints...)
		}
	}

	return result
}

// traceInputPortDestinations finds all atomic destinations from a coupled model's input port (EIC tracing)
func traceInputPortDestinations(coupled *model.Model, inputPort string, modelMap map[string]*model.Model, currentPath []string, pathToAtomic map[string]*flatNode) []resolvedEndpoint {
	result := make([]resolvedEndpoint, 0)
	normalizedInputPort := normalizePortIdentifier(coupled, inputPort)

	// Find connections where From is root (the coupled model) with the specified port
	for _, conn := range coupled.Connections {
		if conn.From.InstanceID == "root" &&
			normalizePortIdentifier(coupled, conn.From.Port) == normalizedInputPort {
			// Found an EIC: this input port connects To something
			toEndpoints := resolveEndpointToAtomics(conn.To, coupled, modelMap, currentPath, pathToAtomic, "in")
			result = append(result, toEndpoints...)
		}
	}

	return result
}

// ============================================================================
// Step 3: Build Runnable Models
// ============================================================================

// buildRunnableModel creates a RunnableModel from a flat node and its connections
func buildRunnableModel(node *flatNode, allConnections []flatConnection) (*shared.RunnableModel, error) {
	m := node.model

	// Convert ports
	ports := make([]shared.RunnableModelPort, 0, len(m.Ports))
	for _, p := range m.Ports {
		portID := strings.TrimSpace(p.ID)
		portName := strings.TrimSpace(p.Name)
		if portName == "" {
			portName = portID
		}
		if portID == "" {
			portID = portName
		}
		ports = append(ports, shared.RunnableModelPort{
			ID:   portID,
			Name: portName,
			Type: sharedEnum.ModelPortDirection(p.Type),
		})
	}

	// Convert parameters with instance overrides (if any)
	parameters, err := buildRunnableParameters(node)
	if err != nil {
		return nil, err
	}

	// Collect connections where this model is the source
	connections := make([]shared.RunnableModelConnection, 0)
	for _, conn := range allConnections {
		if conn.fromModelID == node.modelID {
			connections = append(connections, shared.RunnableModelConnection{
				From: shared.ModelLink{
					ID:   conn.fromModelID,
					Port: conn.fromPort,
				},
				To: shared.ModelLink{
					ID:   conn.toModelID,
					Port: conn.toPort,
				},
			})
		}
	}

	return &shared.RunnableModel{
		ID:          m.ID,
		Name:        m.Name,
		Code:        m.Code,
		Language:    shared.CodeLanguage(m.Language),
		Ports:       ports,
		Parameters:  parameters,
		Connections: connections,
	}, nil
}

func buildRunnableParameters(node *flatNode) ([]shared.RunnableModelParameter, error) {
	base := node.model.Metadata.Parameters

	overrides := make([]json.ModelParameter, 0)
	if node.instanceMetadata != nil && node.instanceMetadata.Parameters != nil {
		overrides = node.instanceMetadata.Parameters
	}

	context := fmt.Sprintf(
		"model=%s instancePath=%s",
		node.modelID,
		pathToString(node.path),
	)

	finalParams := make([]json.ModelParameter, len(base))
	copy(finalParams, base)

	indexByName := make(map[string]int, len(finalParams))
	for idx := range finalParams {
		name := strings.TrimSpace(finalParams[idx].Name)
		if name == "" {
			return nil, fmt.Errorf("invalid parameter: empty name in %s", context)
		}
		if _, exists := indexByName[name]; exists {
			return nil, fmt.Errorf("duplicate base parameter name %q in %s", name, context)
		}
		indexByName[name] = idx
	}

	seenOverrideNames := make(map[string]struct{}, len(overrides))
	for _, override := range overrides {
		name := strings.TrimSpace(override.Name)
		if name == "" {
			return nil, fmt.Errorf("invalid override parameter: empty name in %s", context)
		}
		if _, exists := seenOverrideNames[name]; exists {
			return nil, fmt.Errorf("duplicate override parameter name %q in %s", name, context)
		}
		seenOverrideNames[name] = struct{}{}

		baseIdx, exists := indexByName[name]
		if !exists {
			return nil, fmt.Errorf("unknown override parameter %q in %s", name, context)
		}

		baseParam := finalParams[baseIdx]
		if override.Type != "" && override.Type != baseParam.Type {
			return nil, fmt.Errorf(
				"type mismatch for override parameter %q in %s: expected=%s got=%s",
				name,
				context,
				baseParam.Type,
				override.Type,
			)
		}
		if !isParameterValueCompatible(baseParam.Type, override.Value) {
			return nil, fmt.Errorf(
				"invalid value for override parameter %q in %s: expected type %s",
				name,
				context,
				baseParam.Type,
			)
		}

		baseParam.Value = override.Value
		baseParam.Description = override.Description
		finalParams[baseIdx] = baseParam
	}

	seenRuntimeNames := make(map[string]struct{}, len(node.runtimeOverrides))
	for _, runtimeOverride := range node.runtimeOverrides {
		name := strings.TrimSpace(runtimeOverride.Name)
		if name == "" {
			return nil, fmt.Errorf("invalid runtime override parameter: empty name in %s", context)
		}
		if _, exists := seenRuntimeNames[name]; exists {
			return nil, fmt.Errorf("duplicate runtime override parameter name %q in %s", name, context)
		}
		seenRuntimeNames[name] = struct{}{}

		baseIdx, exists := indexByName[name]
		if !exists {
			return nil, fmt.Errorf("unknown runtime override parameter %q in %s", name, context)
		}

		baseParam := finalParams[baseIdx]
		if !isParameterValueCompatible(baseParam.Type, runtimeOverride.Value) {
			return nil, fmt.Errorf(
				"invalid value for runtime override parameter %q in %s: expected type %s",
				name,
				context,
				baseParam.Type,
			)
		}

		baseParam.Value = runtimeOverride.Value
		finalParams[baseIdx] = baseParam
	}

	res := make([]shared.RunnableModelParameter, 0, len(finalParams))
	for _, p := range finalParams {
		if !isParameterValueCompatible(p.Type, p.Value) {
			return nil, fmt.Errorf(
				"invalid value for base parameter %q in %s: expected type %s",
				p.Name,
				context,
				p.Type,
			)
		}
		res = append(res, shared.RunnableModelParameter{
			Name:        p.Name,
			Type:        shared.ParameterType(p.Type),
			Value:       p.Value,
			Description: p.Description,
		})
	}

	return res, nil
}

func isParameterValueCompatible(parameterType json.ParameterType, value any) bool {
	switch parameterType {
	case json.ParameterTypeInt:
		switch v := value.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			return true
		case float64:
			return math.Trunc(v) == v
		case float32:
			fv := float64(v)
			return math.Trunc(fv) == fv
		default:
			return false
		}
	case json.ParameterTypeFloat:
		switch value.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float64, float32:
			return true
		default:
			return false
		}
	case json.ParameterTypeBool:
		_, ok := value.(bool)
		return ok
	case json.ParameterTypeString:
		_, ok := value.(string)
		return ok
	case json.ParameterTypeObject:
		if value == nil {
			return true
		}
		switch value.(type) {
		case map[string]any, []any:
			return true
		default:
			return false
		}
	default:
		return false
	}
}

// ============================================================================
// Helpers
// ============================================================================

// pathToString converts a path slice to a unique string key
func pathToString(path []string) string {
	if len(path) == 0 {
		return ""
	}
	result := path[0]
	for i := 1; i < len(path); i++ {
		result += "/" + path[i]
	}
	return result
}

func normalizePortIdentifier(m *model.Model, rawPort string) string {
	port := strings.TrimSpace(rawPort)
	if m == nil || port == "" {
		return port
	}

	for _, candidate := range m.Ports {
		candidateID := strings.TrimSpace(candidate.ID)
		candidateName := strings.TrimSpace(candidate.Name)

		if candidateName != "" && candidateName == port {
			return candidateName
		}
		if candidateID != "" && candidateID == port {
			if candidateName != "" {
				return candidateName
			}
			return candidateID
		}
	}

	return port
}
