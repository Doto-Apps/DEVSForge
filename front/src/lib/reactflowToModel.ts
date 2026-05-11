import type { components } from "@/api/v1";
import { DEFAULT_NODE_SIZE } from "@/constants";
import type { ReactFlowInput } from "@/types";

const cleanHandleId = (str: string | undefined | null) =>
	str?.replace(/^(in-internal-|out-internal-|out-|in-)/, "");

const getPortIdentifierFromHandle = (handle: string | undefined | null) =>
	cleanHandleId(handle)?.split(":")[1] ?? "";

const resolvePortNameFromNode = (
	node: ReactFlowInput["nodes"][number] | undefined,
	rawPortIdentifier: string,
	direction: "in" | "out",
): string => {
	if (!node || !rawPortIdentifier) return rawPortIdentifier;

	const ports =
		direction === "in"
			? (node.data.inputPorts ?? [])
			: (node.data.outputPorts ?? []);

	const byName = ports.find(
		(port) => (port.name?.trim() || port.id) === rawPortIdentifier,
	);
	if (byName) {
		return byName.name?.trim() || byName.id;
	}

	const byID = ports.find((port) => port.id === rawPortIdentifier);
	if (byID) {
		return byID.name?.trim() || byID.id;
	}

	return rawPortIdentifier;
};

const getModelComponent = (
	parentNode: ReactFlowInput["nodes"][number],
	nodes: ReactFlowInput["nodes"],
): components["schemas"]["json.ModelComponent"][] => {
	return nodes
		.filter((nodeInNodes) => nodeInNodes.parentId === parentNode.id)
		.map((nodeInNodes) => ({
			instanceId: nodeInNodes.id.split("/").pop() ?? "",
			instanceMetadata: {
				keyword: nodeInNodes.data.keyword,
				modelRole: nodeInNodes.data.modelRole,
				position: { x: nodeInNodes.position.x, y: nodeInNodes.position.y },
				style: {
					height: nodeInNodes.measured?.height ?? DEFAULT_NODE_SIZE,
					width: nodeInNodes.measured?.width ?? DEFAULT_NODE_SIZE,
				},
				...(nodeInNodes.data.reactFlowModelGraphicalData
					? { modelColors: nodeInNodes.data.reactFlowModelGraphicalData }
					: {}),
				parameters: nodeInNodes.data.parameters ?? undefined,
			},
			modelId: nodeInNodes.data.id,
		}));
};

const getModelConnection = (
	node: ReactFlowInput["nodes"][number],
	nodesAndEdges: ReactFlowInput,
): components["schemas"]["json.ModelConnection"][] => {
	const nodesById = new Map(nodesAndEdges.nodes.map((n) => [n.id, n]));

	const isValidEndpoint = (endpointId: string) => {
		if (endpointId === node.id) return true;

		const endpointNode = nodesById.get(endpointId);
		if (!endpointNode) return false;

		return endpointNode.parentId === node.id;
	};

	const getInstanceId = (endpointId: string) => {
		if (endpointId === node.id) return "root";
		return endpointId.split("/").pop() ?? "";
	};

	return nodesAndEdges.edges
		.filter((edge) => edge.data?.holderId === node.id)
		.filter(
			(edge) => isValidEndpoint(edge.source) && isValidEndpoint(edge.target),
		)
		.map((edge) => {
			const sourceNode = nodesById.get(edge.source);
			const targetNode = nodesById.get(edge.target);

			const sourcePort = resolvePortNameFromNode(
				sourceNode,
				getPortIdentifierFromHandle(edge.sourceHandle),
				"out",
			);

			const targetPort = resolvePortNameFromNode(
				targetNode,
				getPortIdentifierFromHandle(edge.targetHandle),
				"in",
			);

			return {
				from: {
					instanceId: getInstanceId(edge.source),
					port: sourcePort,
				},
				to: {
					instanceId: getInstanceId(edge.target),
					port: targetPort,
				},
			};
		})
		.filter((connection) => {
			return (
				connection.from.instanceId &&
				connection.to.instanceId &&
				connection.from.port &&
				connection.to.port
			);
		});
};

const getModelPorts = (
	node: ReactFlowInput["nodes"][number],
): components["schemas"]["json.ModelPort"][] => {
	const portIn =
		node.data.inputPorts?.map<components["schemas"]["json.ModelPort"]>((p) => ({
			id: p.id,
			name: p.name?.trim() || p.id,
			type: "in",
		})) ?? [];
	const portOut =
		node.data.outputPorts?.map<components["schemas"]["json.ModelPort"]>(
			(p) => ({ id: p.id, name: p.name?.trim() || p.id, type: "out" }),
		) ?? [];

	return [...portIn, ...portOut];
};

const nodeToModel = (
	node: ReactFlowInput["nodes"][number],
	nodesAndEdges: ReactFlowInput,
): components["schemas"]["request.ModelRequest"] => {
	const comp = getModelComponent(node, nodesAndEdges.nodes);
	return {
		code: node.data.code,
		components: comp,
		connections:
			node.data.modelType === "coupled"
				? getModelConnection(node, nodesAndEdges)
				: [],
		description: node.data.description,
		id: node.data.id,
		libId: undefined,
		metadata: {
			keyword: node.data.keyword,
			modelRole: node.data.modelRole,
			position: !node.id.includes("/")
				? { x: node.position.x, y: node.position.y }
				: { x: 0, y: 0 },
			style: !node.id.includes("/")
				? {
						height: node.measured?.height ?? DEFAULT_NODE_SIZE,
						width: node.measured?.width ?? DEFAULT_NODE_SIZE,
					}
				: {
						height: DEFAULT_NODE_SIZE,
						width: DEFAULT_NODE_SIZE,
					},
			...(node.data.reactFlowModelGraphicalData && !node.id.includes("/")
				? { modelColors: node.data.reactFlowModelGraphicalData }
				: {}),
			parameters: node.data.parameters ?? undefined,
		},
		name: node.data.label,
		ports: getModelPorts(node),
		type: node.data.modelType,
	};
};

export const reactflowToModel = (
	res: ReactFlowInput,
): components["schemas"]["request.ModelRequest"][] => {
	const models = res.nodes.map((n) => nodeToModel(n, res));
	const uniqueModels = models.filter(
		(model, index, self) => index === self.findIndex((m) => m.id === model.id),
	);
	return uniqueModels;
};
