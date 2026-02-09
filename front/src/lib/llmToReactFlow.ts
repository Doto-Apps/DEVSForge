import type { components } from "@/api/v1";
import { DEFAULT_NODE_SIZE, DEFAULT_POSITION } from "@/constants";
import type {
	EdgeData,
	GeneratedDiagram,
	GeneratedModelData,
	LLMDiagramResponse,
	ReactFlowInput,
} from "@/types";
import type { Edge } from "@xyflow/react";
import { v4 as uuid } from "uuid";

/**
 * Converts LLM response to GeneratedDiagram structure
 */
export const llmResponseToGeneratedDiagram = (
	response: LLMDiagramResponse,
	diagramName: string,
): GeneratedDiagram => {
	// Build dependency graph to determine order
	const dependencyGraph = buildDependencyGraph(response);

	const models: GeneratedModelData[] = response.models.map((model) => {
		// Convert new port format [{id, name, type}] to old format {in: [], out: []}
		const inPorts: string[] = [];
		const outPorts: string[] = [];
		for (const port of model.ports ?? []) {
			if (port.type === "in") {
				inPorts.push(port.name);
			} else if (port.type === "out") {
				outPorts.push(port.name);
			}
		}

		return {
			id: model.id,
			name: model.id, // Name is ID in LLM response
			type: model.type,
			ports: {
				in: inPorts,
				out: outPorts,
			},
			components: model.components,
			code: undefined,
			codeGenerated: false,
			dependencies: dependencyGraph.get(model.id) ?? [],
		};
	});

	// Sort models by topological order (models without dependencies first)
	const sortedModels = topologicalSort(models);

	return {
		name: diagramName,
		models: sortedModels,
		connections: response.connections,
		reactFlowData: undefined,
	};
};

/**
 * Converts EF structure response to GeneratedDiagram structure
 */
export const efStructureResponseToGeneratedDiagram = (
	response: components["schemas"]["response.ExperimentalFrameStructureResponse"],
): GeneratedDiagram => {
	const modelsRaw = response.models ?? [];
	const connectionsRaw = response.connections ?? [];

	const dependencyGraph = buildDependencyGraph({
		models: modelsRaw.map((model) => ({
			id: model.id ?? "",
			type: model.type ?? "atomic",
			ports: model.ports ?? [],
			components: model.components ?? [],
		})),
		connections: connectionsRaw,
	} as LLMDiagramResponse);

	const models: GeneratedModelData[] = modelsRaw.map((model) => {
		const inPorts: string[] = [];
		const outPorts: string[] = [];
		for (const port of model.ports ?? []) {
			if (port.type === "in" && port.name) inPorts.push(port.name);
			if (port.type === "out" && port.name) outPorts.push(port.name);
		}

		return {
			id: model.id ?? "",
			name: model.name ?? model.id ?? "Unnamed model",
			type: model.type ?? "atomic",
			role: model.role,
			ports: {
				in: inPorts,
				out: outPorts,
			},
			components: model.components ?? [],
			code: undefined,
			codeGenerated: false,
			dependencies: dependencyGraph.get(model.id ?? "") ?? [],
		};
	});

	return {
		name: response.roomName ?? "Room - EF",
		models: topologicalSort(models),
		connections: connectionsRaw,
		rootModelId: response.rootModelId ?? undefined,
		modelUnderTestId: response.modelUnderTestId ?? undefined,
		targetModelId: response.targetModelId ?? undefined,
		reactFlowData: undefined,
	};
};

const dedupeStrings = (values: string[]): string[] =>
	Array.from(new Set(values.filter((value) => value.trim().length > 0)));

const getTargetPortsByDirection = (
	targetModel: components["schemas"]["response.ModelResponse"],
): { inPorts: string[]; outPorts: string[] } => {
	const inPorts = dedupeStrings(
		(targetModel.ports ?? [])
			.filter((port) => port.type === "in")
			.map((port) => port.name || port.id),
	);
	const outPorts = dedupeStrings(
		(targetModel.ports ?? [])
			.filter((port) => port.type === "out")
			.map((port) => port.name || port.id),
	);

	return { inPorts, outPorts };
};

const recomputeGeneratedModelDependencies = (
	models: GeneratedModelData[],
	connections: components["schemas"]["response.Connection"][],
): GeneratedModelData[] => {
	const knownModelIDs = new Set(models.map((model) => model.id));
	const dependencyMap = new Map<string, string[]>();

	for (const model of models) {
		const deps = dedupeStrings(
			(model.components ?? []).filter(
				(componentID) =>
					componentID !== model.id && knownModelIDs.has(componentID),
			),
		);
		dependencyMap.set(model.id, deps);
	}

	for (const connection of connections) {
		const sourceModelID = connection.from?.model ?? "";
		const targetModelID = connection.to?.model ?? "";
		if (!sourceModelID || !targetModelID || sourceModelID === targetModelID) {
			continue;
		}
		if (
			!knownModelIDs.has(sourceModelID) ||
			!knownModelIDs.has(targetModelID)
		) {
			continue;
		}

		const currentDeps = dependencyMap.get(targetModelID) ?? [];
		dependencyMap.set(
			targetModelID,
			dedupeStrings([...currentDeps, sourceModelID]),
		);
	}

	return models.map((model) => ({
		...model,
		dependencies: dependencyMap.get(model.id) ?? [],
	}));
};

export const validateGeneratedMutConnections = (
	diagram: GeneratedDiagram,
	targetModel: components["schemas"]["response.ModelResponse"],
): string[] => {
	const errors: string[] = [];
	const modelUnderTestID = diagram.modelUnderTestId ?? targetModel.id;

	if (!modelUnderTestID) {
		return ["MUT validation failed: missing modelUnderTestId."];
	}

	const modelIDs = new Set(diagram.models.map((model) => model.id));
	if (!modelIDs.has(modelUnderTestID)) {
		errors.push(
			`MUT validation failed: model "${modelUnderTestID}" not found.`,
		);
	}

	const { inPorts, outPorts } = getTargetPortsByDirection(targetModel);
	const inPortSet = new Set(inPorts);
	const outPortSet = new Set(outPorts);

	diagram.connections.forEach((connection, index) => {
		const sourceModelID = connection.from?.model ?? "";
		const targetModelID = connection.to?.model ?? "";
		const sourcePort = connection.from?.port ?? "";
		const targetPort = connection.to?.port ?? "";
		const connectionLabel = `connection #${index + 1}`;

		if (sourceModelID && !modelIDs.has(sourceModelID)) {
			errors.push(
				`Invalid ${connectionLabel}: unknown source model "${sourceModelID}".`,
			);
		}
		if (targetModelID && !modelIDs.has(targetModelID)) {
			errors.push(
				`Invalid ${connectionLabel}: unknown target model "${targetModelID}".`,
			);
		}

		if (
			sourceModelID === modelUnderTestID &&
			(!sourcePort || !outPortSet.has(sourcePort))
		) {
			errors.push(
				`Invalid ${connectionLabel}: MUT output port "${sourcePort}" does not exist on "${targetModel.name}".`,
			);
		}
		if (
			targetModelID === modelUnderTestID &&
			(!targetPort || !inPortSet.has(targetPort))
		) {
			errors.push(
				`Invalid ${connectionLabel}: MUT input port "${targetPort}" does not exist on "${targetModel.name}".`,
			);
		}
	});

	return dedupeStrings(errors);
};

export const replaceGeneratedMutPlaceholder = (
	diagram: GeneratedDiagram,
	targetModel: components["schemas"]["response.ModelResponse"],
): { diagram: GeneratedDiagram; errors: string[] } => {
	const targetModelID = targetModel.id;
	if (!targetModelID) {
		return {
			diagram,
			errors: ["Unable to replace MUT: target model id is missing."],
		};
	}

	const mutPlaceholderID = diagram.modelUnderTestId;
	if (!mutPlaceholderID) {
		return {
			diagram,
			errors: [
				"Unable to replace MUT: modelUnderTestId is missing in AI output.",
			],
		};
	}

	const mutExists = diagram.models.some(
		(model) => model.id === mutPlaceholderID,
	);
	if (!mutExists) {
		return {
			diagram,
			errors: [
				`Unable to replace MUT: placeholder model "${mutPlaceholderID}" not found.`,
			],
		};
	}

	const collidesWithExistingModel = diagram.models.some(
		(model) => model.id === targetModelID && model.id !== mutPlaceholderID,
	);
	if (collidesWithExistingModel) {
		return {
			diagram,
			errors: [
				`Unable to replace MUT: target model id "${targetModelID}" already exists in AI structure.`,
			],
		};
	}

	const remapModelID = (modelID: string): string =>
		modelID === mutPlaceholderID ? targetModelID : modelID;

	const knownModelIDs = new Set(
		diagram.models.map((model) => remapModelID(model.id)),
	);
	const targetScopedComponents = dedupeStrings(
		(targetModel.components ?? [])
			.map((component) => remapModelID(component.modelId))
			.filter(
				(componentModelID) =>
					knownModelIDs.has(componentModelID) &&
					componentModelID !== targetModelID,
			),
	);

	const { inPorts, outPorts } = getTargetPortsByDirection(targetModel);

	const remappedModels: GeneratedModelData[] = diagram.models.map((model) => {
		const modelID = remapModelID(model.id);
		const components = dedupeStrings(
			(model.components ?? [])
				.map(remapModelID)
				.filter((componentID) => componentID !== modelID),
		);

		if (model.id !== mutPlaceholderID) {
			return {
				...model,
				id: modelID,
				components,
				dependencies: model.dependencies.map(remapModelID),
			};
		}

		return {
			...model,
			id: targetModelID,
			name: targetModel.name ?? model.name,
			type: targetModel.type ?? model.type,
			role: "model-under-test",
			ports: {
				in: inPorts,
				out: outPorts,
			},
			components: targetScopedComponents,
			code: targetModel.code ?? "",
			codeGenerated: Boolean(targetModel.code),
			dependencies: model.dependencies.map(remapModelID),
		};
	});

	const remappedConnections: components["schemas"]["response.Connection"][] =
		diagram.connections.map((connection) => ({
			...connection,
			from: connection.from
				? {
						...connection.from,
						model: connection.from.model
							? remapModelID(connection.from.model)
							: connection.from.model,
					}
				: connection.from,
			to: connection.to
				? {
						...connection.to,
						model: connection.to.model
							? remapModelID(connection.to.model)
							: connection.to.model,
					}
				: connection.to,
		}));

	const withUpdatedDependencies = recomputeGeneratedModelDependencies(
		remappedModels,
		remappedConnections,
	);

	const nextDiagram: GeneratedDiagram = {
		...diagram,
		targetModelId: targetModelID,
		modelUnderTestId: targetModelID,
		models: topologicalSort(withUpdatedDependencies),
		connections: remappedConnections,
	};

	return {
		diagram: nextDiagram,
		errors: validateGeneratedMutConnections(nextDiagram, targetModel),
	};
};

/**
 * Builds the dependency graph between models
 * Model A depends on B if B is a component of A or if B sends messages to A
 */
const buildDependencyGraph = (
	response: LLMDiagramResponse,
): Map<string, string[]> => {
	const deps = new Map<string, string[]>();

	for (const model of response.models) {
		deps.set(model.id, []);

		// Components are dependencies
		if (model.components) {
			deps.set(model.id, [...(deps.get(model.id) ?? []), ...model.components]);
		}
	}

	// Connections also indicate dependencies (source -> target)
	for (const conn of response.connections) {
		const currentDeps = deps.get(conn.to.model) ?? [];
		if (!currentDeps.includes(conn.from.model)) {
			deps.set(conn.to.model, [...currentDeps, conn.from.model]);
		}
	}

	return deps;
};

/**
 * Topological sort to determine code generation order
 * Atomic models without dependencies are generated first
 */
const topologicalSort = (
	models: GeneratedModelData[],
): GeneratedModelData[] => {
	const visited = new Set<string>();
	const result: GeneratedModelData[] = [];
	const modelMap = new Map(models.map((m) => [m.id, m]));

	const visit = (model: GeneratedModelData) => {
		if (visited.has(model.id)) return;
		visited.add(model.id);

		// Visit dependencies first
		for (const depId of model.dependencies) {
			const dep = modelMap.get(depId);
			if (dep) visit(dep);
		}

		result.push(model);
	};

	// D'abord les atomic, puis les coupled
	const atomicModels = models.filter((m) => m.type === "atomic");
	const coupledModels = models.filter((m) => m.type === "coupled");

	for (const model of atomicModels) {
		visit(model);
	}
	for (const model of coupledModels) {
		visit(model);
	}

	return result;
};

/**
 * Convertit une GeneratedDiagram en ReactFlowInput pour l'affichage
 */
export const generatedDiagramToReactFlow = (
	diagram: GeneratedDiagram,
): ReactFlowInput => {
	const nodes: ReactFlowInput["nodes"] = [];
	const edges: ReactFlowInput["edges"] = [];

	// Trouver le modèle racine (coupled principal ou le premier si tous atomic)
	const rootModel =
		diagram.models.find(
			(m) =>
				m.type === "coupled" &&
				!diagram.models.some((other) => other.components?.includes(m.id)),
		) ?? diagram.models[0];

	if (!rootModel) {
		return { nodes: [], edges: [] };
	}

	// Calculer les positions en grille
	const gridSize = Math.ceil(Math.sqrt(diagram.models.length));
	const spacing = DEFAULT_NODE_SIZE + 50;

	// Créer les nœuds
	diagram.models.forEach((model, index) => {
		const isRoot = model.id === rootModel.id;
		const row = Math.floor(index / gridSize);
		const col = index % gridSize;

		// Pour le root, position 0,0; sinon position dans la grille
		const position = isRoot
			? DEFAULT_POSITION
			: { x: (col + 1) * spacing, y: (row + 1) * spacing };

		const nodeId = isRoot ? model.id : `${rootModel.id}/${model.id}`;

		nodes.push({
			id: nodeId,
			type: "resizer",
			position,
			measured: {
				height: isRoot ? spacing * (gridSize + 1) : DEFAULT_NODE_SIZE,
				width: isRoot ? spacing * (gridSize + 1) : DEFAULT_NODE_SIZE,
			},
			height: isRoot ? spacing * (gridSize + 1) : DEFAULT_NODE_SIZE,
			width: isRoot ? spacing * (gridSize + 1) : DEFAULT_NODE_SIZE,
			data: {
				id: model.id,
				modelType: model.type,
				label: model.name,
				inputPorts: model.ports.in.map((p) => ({ id: p })),
				outputPorts: model.ports.out.map((p) => ({ id: p })),
				code: model.code ?? "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			...(isRoot
				? { deletable: false }
				: { extent: "parent", parentId: rootModel.id }),
		});
	});

	// Créer les edges à partir des connexions
	for (const conn of diagram.connections) {
		const sourceId =
			conn.from.model === rootModel.id
				? rootModel.id
				: `${rootModel.id}/${conn.from.model}`;
		const targetId =
			conn.to.model === rootModel.id
				? rootModel.id
				: `${rootModel.id}/${conn.to.model}`;

		const edge: Edge<EdgeData> = {
			id: `${sourceId}->${targetId}`,
			source: sourceId,
			target: targetId,
			sourceHandle: `${sourceId}:${conn.from.port}`,
			targetHandle: `${targetId}:${conn.to.port}`,
			data: {
				holderId: rootModel.id,
			},
		};
		edges.push(edge);
	}

	return {
		nodes: nodes.sort((a, b) => a.id.length - b.id.length),
		edges,
	};
};

/**
 * Creates atomic model requests (they have code)
 */
export const createAtomicModelRequests = (
	diagram: GeneratedDiagram,
	libraryId: string,
): {
	requests: components["schemas"]["request.ModelRequest"][];
	idMap: Map<string, string>;
} => {
	const requests: components["schemas"]["request.ModelRequest"][] = [];
	const idMap = new Map<string, string>(); // Map from original model name to generated UUID

	const atomicModels = diagram.models.filter((m) => m.type === "atomic");

	for (const model of atomicModels) {
		const modelId = uuid();
		idMap.set(model.name, modelId);

		const request: components["schemas"]["request.ModelRequest"] = {
			id: modelId,
			name: model.name,
			type: model.type,
			code: model.code ?? "",
			description: `Generated atomic model for ${diagram.name}`,
			libId: libraryId,
			ports: [
				...model.ports.in.map((p) => ({ id: p, type: "in" as const })),
				...model.ports.out.map((p) => ({ id: p, type: "out" as const })),
			],
			components: [],
			connections: [],
			metadata: {
				position: DEFAULT_POSITION,
				style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
			},
		};
		requests.push(request);
	}

	return { requests, idMap };
};

/**
 * Creates coupled model requests with references to existing atomic models
 * Must be called after atomic models have been created in the database
 */
export const createCoupledModelRequests = (
	diagram: GeneratedDiagram,
	libraryId: string,
	atomicIdMap: Map<string, string>, // Map from model name to database ID
): components["schemas"]["request.ModelRequest"][] => {
	const requests: components["schemas"]["request.ModelRequest"][] = [];
	const coupledModels = diagram.models.filter((m) => m.type === "coupled");

	for (const model of coupledModels) {
		// Build components array with references to the created atomic models
		// Also build a map from component name to instanceId for connection mapping
		const modelComponents: components["schemas"]["json.ModelComponent"][] = [];
		const nameToInstanceId = new Map<string, string>(); // Map component name to instanceId

		if (model.components) {
			for (const componentName of model.components) {
				const componentId = atomicIdMap.get(componentName);
				if (componentId) {
					const instanceId = uuid(); // Unique instance ID for this component
					nameToInstanceId.set(componentName, instanceId);
					modelComponents.push({
						instanceId,
						modelId: componentId, // Reference to the atomic model in database
					});
				}
			}
		}

		// Map connections from diagram to model connections format
		// Filter connections that are relevant to this coupled model's components
		const modelConnections: components["schemas"]["json.ModelConnection"][] =
			[];

		for (const conn of diagram.connections) {
			const fromInstanceId = nameToInstanceId.get(conn.from.model);
			const toInstanceId = nameToInstanceId.get(conn.to.model);

			// Only include connections between components of this coupled model
			if (fromInstanceId && toInstanceId) {
				modelConnections.push({
					from: {
						instanceId: fromInstanceId,
						port: conn.from.port,
					},
					to: {
						instanceId: toInstanceId,
						port: conn.to.port,
					},
				});
			}
		}

		const request: components["schemas"]["request.ModelRequest"] = {
			id: uuid(),
			name: model.name,
			type: model.type,
			code: "", // Coupled models don't have code
			description: `Generated coupled model for ${diagram.name}`,
			libId: libraryId,
			ports: [
				...model.ports.in.map((p) => ({ id: p, type: "in" as const })),
				...model.ports.out.map((p) => ({ id: p, type: "out" as const })),
			],
			components: modelComponents,
			connections: modelConnections,
			metadata: {
				position: DEFAULT_POSITION,
				style: { height: DEFAULT_NODE_SIZE * 2, width: DEFAULT_NODE_SIZE * 2 }, // Larger for coupled
			},
		};
		requests.push(request);
	}

	return requests;
};

/**
 * @deprecated Use createAtomicModelRequests and createCoupledModelRequests instead
 */
export const generatedDiagramToModelRequests = (
	diagram: GeneratedDiagram,
	libraryId: string,
): components["schemas"]["request.ModelRequest"][] => {
	const { requests } = createAtomicModelRequests(diagram, libraryId);
	return requests;
};
