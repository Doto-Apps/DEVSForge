import type { components } from "@/api/v1";
import type { ReactFlowInput } from "@/types";
import { modelToReactflow } from "./modelToReactflow";

type Model = components["schemas"]["response.ModelResponse"];

// Keep each definition's descendants, positions and colors. Namespace the copies:
// the same definition can appear both on the shelf and inside a coupled model.
export function libraryPreview(
	roots: Model[],
	models: Model[],
): ReactFlowInput {
	const byId = new Map(models.map((model) => [model.id, model]));
	const graphs = roots.map((root) => {
		const collected = new Map<string, Model>();
		let occurrences = 0;
		function visit(model: Model, ancestors: Set<string>): boolean {
			if (++occurrences > 500 || ancestors.size > 32 || ancestors.has(model.id))
				return false;
			collected.set(model.id, model);
			const path = new Set(ancestors).add(model.id);
			return model.components.every((component) => {
				const child = byId.get(component.modelId);
				return child ? visit(child, path) : false;
			});
		}
		const complete = visit(root, new Set());
		// Incomplete or cyclic data still has a useful boundary preview.
		const graph = modelToReactflow(
			complete
				? [...collected.values()]
				: [{ ...root, components: [], connections: [] }],
		);
		const prefix = `${root.id}::`;
		return {
			edges: graph.edges.map((edge) => ({
				...edge,
				id: prefix + edge.id,
				source: prefix + edge.source,
				sourceHandle: edge.sourceHandle?.startsWith("internal-")
					? edge.sourceHandle.replace("internal-", `internal-${prefix}`)
					: prefix + edge.sourceHandle,
				target: prefix + edge.target,
				targetHandle: edge.targetHandle?.startsWith("internal-")
					? edge.targetHandle.replace("internal-", `internal-${prefix}`)
					: prefix + edge.targetHandle,
			})),
			nodes: graph.nodes.map((node) => ({
				...node,
				data: {
					...node.data,
					description:
						!complete && !node.parentId
							? "Some components are unavailable in this overview. Open the model to inspect it."
							: node.data.description,
				},
				id: prefix + node.id,
				parentId: node.parentId ? prefix + node.parentId : undefined,
			})),
		};
	});
	const width = Math.max(
		200,
		...graphs.flatMap((g) =>
			g.nodes.filter((n) => !n.parentId).map((n) => n.width ?? 200),
		),
	);
	const height = Math.max(
		200,
		...graphs.flatMap((g) =>
			g.nodes.filter((n) => !n.parentId).map((n) => n.height ?? 200),
		),
	);
	return {
		edges: graphs.flatMap((graph) => graph.edges),
		nodes: graphs
			.flatMap((graph, i) =>
				graph.nodes.map((node) =>
					node.parentId
						? node
						: {
								...node,
								position: {
									x: (i % 2) * (width + 100),
									y: Math.floor(i / 2) * (height + 100),
								},
							},
				),
			)
			.sort((a, b) => a.id.split("/").length - b.id.split("/").length),
	};
}
