// @ts-nocheck

import type { Edge } from "@xyflow/react";
import { v4 as uuid } from "uuid";
import type { components } from "@/api/v1";
import {
	DEFAULT_NODE_SIZE,
	DEFAULT_POSITION,
	INTERNAL_PREFIX,
} from "@/constants";
import type {
	EdgeData,
	GeneratedDiagram,
	GeneratedModelData,
	GeneratedModelLanguage,
	LLMDiagramResponse,
	ReactFlowInput,
} from "@/types";

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
			code: undefined,
			codeGenerated: false,
			components: model.components,
			dependencies: dependencyGraph.get(model.id) ?? [],
			id: model.id,
			name: model.id, // Name is ID in LLM response
			ports: {
				in: inPorts,
				out: outPorts,
			},
			type: model.type,
		};
	});

	// Sort models by topological order (models without dependencies first)
	const sortedModels = topologicalSort(models);

	return {
		connections: response.connections,
		models: sortedModels,
		name: diagramName,
		validationErrors: response.validationErrors,
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
		connections: connectionsRaw,
		models: modelsRaw.map((model) => ({
			components: model.components ?? [],
			id: model.id ?? "",
			ports: model.ports ?? [],
			type: model.type ?? "atomic",
		})),
	} as LLMDiagramResponse);

	const models: GeneratedModelData[] = modelsRaw.map((model) => {
		const inPorts: string[] = [];
		const outPorts: string[] = [];
		for (const port of model.ports ?? []) {
			if (port.type === "in" && port.name) inPorts.push(port.name);
			if (port.type === "out" && port.name) outPorts.push(port.name);
		}

		return {
			code: undefined,
			codeGenerated: false,
			components: model.components ?? [],
			dependencies: dependencyGraph.get(model.id ?? "") ?? [],
			id: model.id ?? "",
			name: model.name ?? model.id ?? "Unnamed model",
			ports: {
				in: inPorts,
				out: outPorts,
			},
			role: model.role,
			type: model.type ?? "atomic",
		};
	});

	return {
		connections: connectionsRaw,
		models: topologicalSort(models),
		modelUnderTestId: response.modelUnderTestId ?? undefined,
		name: response.roomName ?? "Room - EF",
		validationErrors: response.validationErrors,
		reactFlowData: undefined,
		rootModelId: response.rootModelId ?? undefined,
		targetModelId: response.targetModelId ?? undefined,
	};
};

const dedupeStrings = (values: string[]): string[] =>
	Array.from(new Set(values.filter((value) => value.trim().length > 0)));

const getGeneratedModelByLogicalID = (
	diagram: GeneratedDiagram,
	logicalModelID: string,
): GeneratedModelData | undefined =>
	diagram.models.find((model) => {
		const trimmedLogicalID = logicalModelID.trim();
		return model.id === trimmedLogicalID || model.name === trimmedLogicalID;
	});

const isRootModelReference = (
	modelReference: string,
	rootModel: GeneratedModelData,
): boolean => {
	const trimmedReference = modelReference.trim();
	return (
		trimmedReference.toLowerCase() === "root" ||
		trimmedReference === rootModel.id ||
		trimmedReference === rootModel.name
	);
};

const getGeneratedModelIDFromReference = (
	diagram: GeneratedDiagram,
	modelReference: string,
): string | undefined =>
	getGeneratedModelByLogicalID(diagram, modelReference)?.id;

const getCreatedModelDatabaseID = (
	diagram: GeneratedDiagram,
	createdModelIDByName: Map<string, string>,
	logicalModelID: string,
): string | undefined => {
	const trimmedLogicalID = logicalModelID.trim();
	const directID = createdModelIDByName.get(trimmedLogicalID);
	if (directID) return directID;

	const generatedModel = getGeneratedModelByLogicalID(
		diagram,
		trimmedLogicalID,
	);
	if (!generatedModel) return undefined;

	return (
		createdModelIDByName.get(generatedModel.name) ??
		createdModelIDByName.get(generatedModel.id)
	);
};

const getCoupledConnectionEndpointInstanceID = (
	coupledModel: GeneratedModelData,
	logicalModelID: string,
	instanceIDByLogicalModelID: Map<string, string>,
): string | undefined => {
	const trimmedLogicalID = logicalModelID.trim();
	if (isRootModelReference(trimmedLogicalID, coupledModel)) {
		return "root";
	}
	return instanceIDByLogicalModelID.get(trimmedLogicalID);
};

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
				components,
				dependencies: model.dependencies.map(remapModelID),
				id: modelID,
			};
		}

		return {
			...model,
			code: targetModel.code ?? "",
			codeGenerated: Boolean(targetModel.code),
			components: targetScopedComponents,
			externalModelId: targetModelID,
			dependencies: model.dependencies.map(remapModelID),
			id: targetModelID,
			language: targetModel.language,
			integrationId: targetModel.integrationId,
			integrationVersion: targetModel.integrationVersion,
			name: targetModel.name ?? model.name,
			ports: {
				in: inPorts,
				out: outPorts,
			},
			role: "model-under-test",
			type: targetModel.type ?? model.type,
		};
	});

	const remappedConnections: components["schemas"]["response.Connection"][] =
		diagram.connections.map((connection) => ({
			...connection,
			owner: connection.owner ? remapModelID(connection.owner) : undefined,
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
		connections: remappedConnections,
		models: topologicalSort(withUpdatedDependencies),
		modelUnderTestId: targetModelID,
		targetModelId: targetModelID,
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
export const validateGeneratedStructure = (
	diagram: GeneratedDiagram,
): string[] => {
	const errors: string[] = [...(diagram.validationErrors ?? [])];
	const byId = new Map<string, GeneratedModelData>();
	for (const m of diagram.models) {
		if (!m.id || /[/:]/.test(m.id))
			errors.push(`Invalid model identifier ${m.id}`);
		if (byId.has(m.id)) errors.push(`Duplicate model ${m.id}`);
		byId.set(m.id, m);
		if (m.type === "atomic" && m.components?.length)
			errors.push(`Atomic model ${m.name} cannot contain components`);
		const ports = [...m.ports.in, ...m.ports.out];
		if (new Set(ports).size !== ports.length)
			errors.push(`Duplicate port on ${m.name}`);
	}
	if (diagram.modelUnderTestId && !byId.has(diagram.modelUnderTestId))
		errors.push("The protected model under test is missing");
	const root =
		diagram.rootModelId ??
		diagram.models.find(
			(m) =>
				m.type === "coupled" &&
				!diagram.models.some((p) => p.components?.includes(m.id)),
		)?.id;
	const resolve = (ref: string | undefined) =>
		byId.has(ref ?? "")
			? ref
			: ref === "root"
				? root
				: diagram.models.find((m) => m.name === ref)?.id;
	const visited = new Set<string>();
	const pending = new Set<string>();
	const walk = (id: string) => {
		if (pending.has(id)) {
			errors.push(`Containment cycle at ${id}`);
			return;
		}
		if (visited.has(id)) return;
		pending.add(id);
		const m = byId.get(id);
		if (m?.externalModelId) {
			pending.delete(id);
			visited.add(id);
			return;
		}
		if (new Set(m?.components ?? []).size !== (m?.components ?? []).length)
			errors.push(`Duplicate component in ${id}`);
		for (const ref of m?.components ?? []) {
			const child = resolve(ref);
			if (!child) {
				errors.push(`Unknown component ${ref} in ${id}`);
				continue;
			}
			walk(child);
		}
		pending.delete(id);
		visited.add(id);
	};
	for (const m of diagram.models) walk(m.id);
	for (const [index, c] of diagram.connections.entries()) {
		const from = resolve(c.from?.model),
			to = resolve(c.to?.model);
		if (!from || !to) {
			errors.push(`Connection ${index + 1}: unknown model`);
			continue;
		}
		c.from = { ...c.from, model: from };
		c.to = { ...c.to, model: to };
		const candidates = diagram.models.filter(
			(m) =>
				m.type === "coupled" &&
				!m.externalModelId &&
				(m.id === from || m.components?.some((x) => resolve(x) === from)) &&
				(m.id === to || m.components?.some((x) => resolve(x) === to)) &&
				!(m.id === from && m.id === to),
		);
		const owner = c.owner
			? candidates.find((m) => m.id === resolve(c.owner))
			: candidates.length === 1
				? candidates[0]
				: undefined;
		if (!owner) {
			errors.push(
				`Connection ${index + 1}: specify an unambiguous coupled owner; connections cannot cross hierarchy levels`,
			);
			continue;
		}
		c.owner = owner.id;
		const source = byId.get(from),
			target = byId.get(to);
		const sourcePorts =
			owner.id === from ? source?.ports.in : source?.ports.out;
		const targetPorts = owner.id === to ? target?.ports.out : target?.ports.in;
		if (
			!sourcePorts?.includes(c.from.port ?? "") ||
			!targetPorts?.includes(c.to.port ?? "")
		)
			errors.push(`Connection ${index + 1}: invalid port or direction`);
	}
	return [...new Set(errors)];
};

export const generatedDiagramToReactFlow = (
	diagram: GeneratedDiagram,
): ReactFlowInput => {
	const nodes: ReactFlowInput["nodes"] = [],
		edges: ReactFlowInput["edges"] = [];
	const byId = new Map(diagram.models.map((m) => [m.id, m]));
	const resolve = (ref: string) =>
		byId.get(ref) ?? diagram.models.find((m) => m.name === ref);
	const roots = diagram.models.filter(
		(m) =>
			!diagram.models.some((p) =>
				p.components?.some((c) => resolve(c)?.id === m.id),
			),
	);
	validateGeneratedStructure(diagram);
	const expand = (
		model: GeneratedModelData,
		path: string,
		parentId: string | undefined,
		index: number,
		ancestors: Set<string>,
	): { width: number; height: number } => {
		if (ancestors.has(model.id)) return { width: 200, height: 200 };
		const seen = new Set([...ancestors, model.id]);
		const position = diagram.reactFlowData?.nodes.find((n) => n.id === path)
			?.position ?? {
			x: parentId ? 40 + (index % 3) * 280 : index * 300,
			y: parentId ? 70 + Math.floor(index / 3) * 280 : 0,
		};
		const node = {
			id: path,
			type: "resizer",
			deletable: !model.externalModelId,
			position,
			data: {
				id: model.id,
				label: model.name,
				modelType: model.type,
				code: model.code ?? "",
				integrationId: model.integrationId,
				integrationVersion: model.integrationVersion,
				language: model.language,
				inputPorts: model.ports.in.map((p) => ({ id: p, name: p })),
				outputPorts: model.ports.out.map((p) => ({ id: p, name: p })),
				parameters: [],
				description: "",
				modelRole: model.role ?? "",
				keyword: [],
			},
			selected: false,
			dragging: false,
			width: 200,
			height: 200,
			measured: { width: 200, height: 200 },
			...(parentId
				? { parentId, extent: "parent" as const }
				: { deletable: false }),
		};
		if (model.externalModelId) node.deletable = false;
		nodes.push(node);
		let width = 200,
			height = 200;
		let cursorX = 40;
		for (const [i, ref] of (model.components ?? []).entries()) {
			const child = resolve(ref);
			if (!child) continue;
			const childPath = `${path}/${child.id}`;
			const size = expand(child, childPath, path, i, seen);
			const childNode = nodes.find((n) => n.id === childPath);
			if (childNode) {
				childNode.position = {
					x: cursorX,
					y: 70,
				};
				cursorX += size.width + 40;
				width = Math.max(width, (childNode?.position.x ?? 0) + size.width + 40);
				height = Math.max(
					height,
					(childNode?.position.y ?? 0) + size.height + 40,
				);
			}
		}
		node.width = width;
		node.height = height;
		node.measured = { width, height };
		for (const [i, c] of diagram.connections.entries()) {
			if (c.owner !== model.id || !c.from || !c.to) continue;
			const source =
				c.from.model === model.id
					? path
					: `${path}/${resolve(c.from.model ?? "")?.id}`;
			const target =
				c.to.model === model.id
					? path
					: `${path}/${resolve(c.to.model ?? "")?.id}`;
			edges.push({
				id: `${path}:connection:${i}`,
				source,
				target,
				sourceHandle: `${source === path ? INTERNAL_PREFIX : ""}${source}:${c.from.port}`,
				targetHandle: `${target === path ? INTERNAL_PREFIX : ""}${target}:${c.to.port}`,
				data: { holderId: path },
				type: "custom",
			});
		}
		return { width, height };
	};
	for (const [i, root] of roots.entries())
		expand(root, root.id, undefined, i, new Set());
	return { nodes, edges };
};

export const syncGeneratedStructure = (
	diagram: GeneratedDiagram,
	graph: ReactFlowInput,
): GeneratedDiagram => {
	if (validateGeneratedStructure(diagram).length)
		return { ...diagram, reactFlowData: graph };
	const models = diagram.models
		.filter(
			(m) => graph.nodes.some((n) => n.data.id === m.id) || m.externalModelId,
		)
		.map((m) => {
			if (m.externalModelId) return m;
			const node = graph.nodes.find((n) => n.data.id === m.id);
			if (!node) return m;
			return {
				...m,
				name: node.data.label,
				ports: {
					in: (node.data.inputPorts ?? []).map((p) => p.name || p.id),
					out: (node.data.outputPorts ?? []).map((p) => p.name || p.id),
				},
				components: graph.nodes
					.filter((n) => n.parentId === node.id)
					.map((n) => n.data.id),
			};
		});
	for (const node of graph.nodes) {
		if (models.some((m) => m.id === node.data.id)) continue;
		models.push({
			id: node.data.id,
			name: node.data.label,
			type: node.data.modelType,
			ports: {
				in: (node.data.inputPorts ?? []).map((p) => p.name || p.id),
				out: (node.data.outputPorts ?? []).map((p) => p.name || p.id),
			},
			components: graph.nodes
				.filter((n) => n.parentId === node.id)
				.map((n) => n.data.id),
			code: node.data.code,
			codeGenerated: !!node.data.code,
			dependencies: [],
			language: node.data.language,
			integrationId: node.data.integrationId,
			integrationVersion: node.data.integrationVersion,
		});
	}
	const connections = [];
	const seen = new Set<string>();
	for (const edge of graph.edges) {
		const source = graph.nodes.find((n) => n.id === edge.source),
			target = graph.nodes.find((n) => n.id === edge.target);
		const owner =
			graph.nodes.find((n) => n.id === edge.data?.holderId) ??
			graph.nodes.find(
				(n) =>
					n.id ===
					(source?.parentId === target?.id
						? target.id
						: target?.parentId === source?.id
							? source.id
							: source?.parentId),
			);
		if (!source || !target || !owner) continue;
		const port = (node, handle, root, direction) => {
			const id = handle?.split(":").pop() ?? "";
			const ports = root
				? direction === "source"
					? node.data.inputPorts
					: node.data.outputPorts
				: direction === "source"
					? node.data.outputPorts
					: node.data.inputPorts;
			return ports?.find((p) => p.id === id)?.name ?? id;
		};
		const c = {
			owner: owner.data.id,
			from: {
				model: source.data.id,
				port: port(source, edge.sourceHandle, source.id === owner.id, "source"),
			},
			to: {
				model: target.data.id,
				port: port(target, edge.targetHandle, target.id === owner.id, "target"),
			},
		};
		const key = JSON.stringify(c);
		if (!seen.has(key)) {
			connections.push(c);
			seen.add(key);
		}
	}
	return {
		...diagram,
		models,
		connections,
		reactFlowData: graph,
		validationErrors: [],
	};
};

export const mergeStructureProposal = (
	current: GeneratedDiagram,
	proposal: GeneratedDiagram,
): GeneratedDiagram => ({
	...proposal,
	models: proposal.models.map((model) => {
		const previous = current.models.find((m) => m.id === model.id);
		if (!previous?.code) return model;
		const changed =
			JSON.stringify(previous.ports) !== JSON.stringify(model.ports) ||
			previous.type !== model.type;
		return {
			...model,
			code: previous.code,
			language: previous.language,
			integrationId: previous.integrationId,
			integrationVersion: previous.integrationVersion,
			codeGenerated: changed ? false : previous.codeGenerated,
			needsRevalidation: changed || previous.needsRevalidation,
		};
	}),
});

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
			code: model.code ?? "",
			components: [],
			connections: [],
			description: `Generated atomic model for ${diagram.name}`,
			id: modelId,
			integrationId: model.integrationId,
			integrationVersion: model.integrationVersion,
			libId: libraryId,
			metadata: {
				position: DEFAULT_POSITION,
				style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
			},
			name: model.name,
			ports: [
				...model.ports.in.map((p) => ({ id: p, name: p, type: "in" as const })),
				...model.ports.out.map((p) => ({
					id: p,
					name: p,
					type: "out" as const,
				})),
			],
			type: model.type,
		};
		requests.push(request);
	}

	return { idMap, requests };
};

/**
 * Creates coupled model requests with references to existing atomic models
 * Must be called after atomic models have been created in the database
 */
export const createCoupledModelRequests = (
	diagram: GeneratedDiagram,
	libraryId: string,
	createdModelIDByName: Map<string, string>, // Map from generated model id/name to database ID
): components["schemas"]["request.ModelRequest"][] => {
	return diagram.models
		.filter((model) => model.type === "coupled")
		.map((model) =>
			createCoupledModelRequest(
				diagram,
				libraryId,
				createdModelIDByName,
				model,
			),
		);
};

export const createCoupledModelRequest = (
	diagram: GeneratedDiagram,
	libraryId: string,
	createdModelIDByName: Map<string, string>,
	model: GeneratedModelData,
): components["schemas"]["request.ModelRequest"] => {
	const issues = validateGeneratedStructure(diagram);
	if (issues.length) throw new Error(issues.join("; "));
	const ownerNode = diagram.reactFlowData?.nodes.find(
		(n) => n.data.id === model.id,
	);
	const modelComponents: components["schemas"]["json.ModelComponent"][] = [];
	const instanceIDByLogicalModelID = new Map<string, string>();

	if (model.components) {
		for (const componentName of model.components) {
			const componentId = getCreatedModelDatabaseID(
				diagram,
				createdModelIDByName,
				componentName,
			);
			if (!componentId) throw new Error(`Unknown component ${componentName}`);
			if (componentId) {
				const instanceId = uuid();
				instanceIDByLogicalModelID.set(componentName, instanceId);

				const componentModel = getGeneratedModelByLogicalID(
					diagram,
					componentName,
				);
				if (componentModel) {
					instanceIDByLogicalModelID.set(componentModel.id, instanceId);
					instanceIDByLogicalModelID.set(componentModel.name, instanceId);
				}

				const occurrence = diagram.reactFlowData?.nodes.find(
					(n) =>
						n.parentId === ownerNode?.id &&
						n.data.id === (componentModel?.id ?? componentName),
				);
				modelComponents.push({
					instanceId,
					...(occurrence
						? {
								instanceMetadata: {
									position: occurrence.position,
									style: {
										width:
											occurrence.measured?.width ??
											occurrence.width ??
											DEFAULT_NODE_SIZE,
										height:
											occurrence.measured?.height ??
											occurrence.height ??
											DEFAULT_NODE_SIZE,
									},
								},
							}
						: {}),
					modelId: componentId,
				});
			}
		}
	}

	const modelConnections: components["schemas"]["json.ModelConnection"][] = [];
	for (const conn of diagram.connections) {
		if (conn.owner !== model.id) continue;
		const fromInstanceId = getCoupledConnectionEndpointInstanceID(
			model,
			conn.from.model,
			instanceIDByLogicalModelID,
		);
		const toInstanceId = getCoupledConnectionEndpointInstanceID(
			model,
			conn.to.model,
			instanceIDByLogicalModelID,
		);

		if (!fromInstanceId || !toInstanceId)
			throw new Error(`Cannot resolve connection owned by ${model.id}`);
		if (
			fromInstanceId &&
			toInstanceId &&
			!(fromInstanceId === "root" && toInstanceId === "root")
		) {
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

	return {
		code: "",
		components: modelComponents,
		connections: modelConnections,
		description: `Generated coupled model for ${diagram.name}`,
		id: uuid(),

		libId: libraryId,
		metadata: {
			position: ownerNode?.position ?? DEFAULT_POSITION,
			style: {
				height: ownerNode?.measured?.height ?? DEFAULT_NODE_SIZE * 2,
				width: ownerNode?.measured?.width ?? DEFAULT_NODE_SIZE * 2,
			},
		},
		name: model.name,
		ports: [
			...model.ports.in.map((p) => ({ id: p, name: p, type: "in" as const })),
			...model.ports.out.map((p) => ({
				id: p,
				name: p,
				type: "out" as const,
			})),
		],
		type: model.type,
	};
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
