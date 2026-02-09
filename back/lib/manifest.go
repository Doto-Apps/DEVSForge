package lib

import (
	"devsforge/json"
	"devsforge/model"
	"errors"

	shared "devsforge-shared"
	sharedEnum "devsforge-shared/enum"
)

var ErrModelNotFound = errors.New("MODEL_NOT_FOUND")

// ============================================================================
// Flattening Types
// ============================================================================

// flatNode represents an atomic model instance in the flattened hierarchy
type flatNode struct {
	modelID    string       // The actual model ID (for code lookup)
	model      *model.Model // Reference to the model
	path       []string     // Path of instanceIDs from root to this node
	instanceID string       // Unique flattened instance ID (for connections)
}

// portEndpoint identifies a specific port on a specific instance
type portEndpoint struct {
	instancePath []string // Path of instanceIDs
	portName     string   // Port name (ID)
}

// ============================================================================
// Main Entry Point
// ============================================================================

// ModelToManifest converts a list of models from the database to a RunnableManifest
// that can be used by the simulator coordinator. It flattens multi-level coupled
// models into a flat list of atomic models with direct connections.
func ModelToManifest(models []model.Model, rootID string, simulationID string, maxTime float64) (*shared.RunnableManifest, error) {
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
	atomicNodes := collectFlattenedAtomics(rootModel, modelMap, []string{})

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
		runnableModel := buildRunnableModel(node, flatConnections)
		manifest.Models = append(manifest.Models, runnableModel)
	}

	return manifest, nil
}

// ============================================================================
// Step 1: Collect Flattened Atomics
// ============================================================================

// collectFlattenedAtomics recursively collects all atomic models with their hierarchy paths
func collectFlattenedAtomics(m *model.Model, modelMap map[string]*model.Model, currentPath []string) []*flatNode {
	result := make([]*flatNode, 0)

	if m.Type == "atomic" {
		// Use model ID as instance ID for atomics (they are unique)
		result = append(result, &flatNode{
			modelID:    m.ID,
			model:      m,
			path:       currentPath,
			instanceID: m.ID,
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

		result = append(result, collectFlattenedAtomics(childModel, modelMap, childPath)...)
	}

	return result
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

	if childModel.Type == "atomic" {
		// Direct atomic - we found our endpoint
		result = append(result, resolvedEndpoint{
			modelID: childModel.ID,
			port:    link.Port,
		})
		return result
	}

	// It's a coupled model - we need to follow the connection inside
	// Find connections that go from/to the coupled model's port
	if portDirection == "out" {
		// We're looking for the source of output: find what's connected to this output port inside
		result = append(result, traceOutputPortSources(childModel, link.Port, modelMap, childPath, pathToAtomic)...)
	} else {
		// We're looking for the destination of input: find what this input port connects to inside
		result = append(result, traceInputPortDestinations(childModel, link.Port, modelMap, childPath, pathToAtomic)...)
	}

	return result
}

// traceOutputPortSources finds all atomic sources that output to a coupled model's output port (EOC tracing)
func traceOutputPortSources(coupled *model.Model, outputPort string, modelMap map[string]*model.Model, currentPath []string, pathToAtomic map[string]*flatNode) []resolvedEndpoint {
	result := make([]resolvedEndpoint, 0)

	// Find connections where To is root (the coupled model) with the specified port
	for _, conn := range coupled.Connections {
		if conn.To.InstanceID == "root" && conn.To.Port == outputPort {
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

	// Find connections where From is root (the coupled model) with the specified port
	for _, conn := range coupled.Connections {
		if conn.From.InstanceID == "root" && conn.From.Port == inputPort {
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
func buildRunnableModel(node *flatNode, allConnections []flatConnection) *shared.RunnableModel {
	m := node.model

	// Convert ports
	ports := make([]shared.RunnableModelPort, 0, len(m.Ports))
	for _, p := range m.Ports {
		ports = append(ports, shared.RunnableModelPort{
			ID:   p.ID,
			Name: p.Name,
			Type: sharedEnum.ModelPortDirection(p.Type),
		})
	}

	// Convert parameters
	parameters := make([]shared.RunnableModelParameter, 0)
	if m.Metadata.Parameters != nil {
		for _, p := range m.Metadata.Parameters {
			parameters = append(parameters, shared.RunnableModelParameter{
				Name:        p.Name,
				Type:        shared.ParameterType(p.Type),
				Value:       p.Value,
				Description: p.Description,
			})
		}
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
