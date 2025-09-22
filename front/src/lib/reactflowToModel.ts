import type { components } from "@/api/v1";
import { DEFAULT_NODE_SIZE } from "@/constants";
import type { ReactFlowInput } from "@/types";

const cleanHandleId = (str: string | undefined | null) =>
	str?.replace(/^(in-internal-|out-internal-|out-|in-)/, "");

const getModelComponent = (
	parentNode: ReactFlowInput["nodes"][number],
	nodes: ReactFlowInput["nodes"],
): components["schemas"]["json.ModelComponent"][] => {
	return nodes
		.filter((nodeInNodes) => nodeInNodes.parentId === parentNode.id)
		.map((nodeInNodes) => ({
			instanceId: nodeInNodes.id.split("/").pop() ?? "",
			modelId: nodeInNodes.data.id,
			instanceMetadata: {
				position: { x: nodeInNodes.position.x, y: nodeInNodes.position.y },
				style: {
					height: nodeInNodes.measured?.height ?? DEFAULT_NODE_SIZE,
					width: nodeInNodes.measured?.width ?? DEFAULT_NODE_SIZE,
				},
				...(nodeInNodes.data.reactFlowModelGraphicalData
					? { modelColors: nodeInNodes.data.reactFlowModelGraphicalData }
					: {}),
				// parameters: nodeInNodes.data.parameters,
			},
		}));
};

const getModelConnection = (
	node: ReactFlowInput["nodes"][number],
	nodesAndEdges: ReactFlowInput,
): components["schemas"]["json.ModelConnection"][] => {
	const holdersEdge = nodesAndEdges.edges.filter(
		(edge) => edge.data?.holderId === node.id,
	);

	const modelConnection = holdersEdge.flatMap((anEdge) => [
		{
			from: {
				instanceId:
					anEdge.source === node.id
						? "root"
						: (anEdge.source.split("/").pop() ?? ""),
				port: cleanHandleId(anEdge.sourceHandle)?.split(":")[1] ?? "",
			},
			to: {
				instanceId:
					anEdge.target === node.id
						? "root"
						: (anEdge.target.split("/").pop() ?? ""),
				port: cleanHandleId(anEdge.targetHandle)?.split(":")[1] ?? "",
			},
		},
	]);

	return modelConnection;
};

const getModelPorts = (
	node: ReactFlowInput["nodes"][number],
): components["schemas"]["json.ModelPort"][] => {
	const portIn =
		node.data.inputPorts?.map<components["schemas"]["json.ModelPort"]>((p) => ({
			id: p.id,
			type: "in",
		})) ?? [];
	const portOut =
		node.data.outputPorts?.map<components["schemas"]["json.ModelPort"]>(
			(p) => ({ id: p.id, type: "out" }),
		) ?? [];

	return [...portIn, ...portOut];
};

const nodeToModel = (
	node: ReactFlowInput["nodes"][number],
	nodesAndEdges: ReactFlowInput,
): components["schemas"]["request.ModelRequest"] => {
	const comp = getModelComponent(node, nodesAndEdges.nodes);
	return {
		name: node.data.label,
		id: node.data.id,
		code: node.data.code,
		components: comp,
		ports: getModelPorts(node),
		description: "",
		type: node.data.modelType,
		metadata: {
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
			// parameters: node.data.parameters ?? undefined,
		},
		libId: undefined,
		connections:
			node.data.modelType === "coupled"
				? getModelConnection(node, nodesAndEdges)
				: [],
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
