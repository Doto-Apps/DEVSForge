import type { ReactFlowModelData } from "@/types";
import type { InternalNode, Node, XYPosition } from "@xyflow/react";

export const FindParentNodeId = (
	nodes: Node<ReactFlowModelData>[],
	dropPosition: XYPosition,
	getInternalNode: (id: string) => InternalNode<Node> | undefined,
) => {
	let final = null;

	for (const node of nodes) {
		if (node.data?.modelType === "atomic") continue;

		const width = Number(node.measured?.width) || 200;
		const height = Number(node.measured?.height) || 200;
		const internalNode = getInternalNode(node.id)?.internals.positionAbsolute;

		const left = internalNode?.x ?? 0;
		const top = internalNode?.y ?? 0;
		const right = left + width;
		const bottom = top + height;

		if (
			dropPosition.x >= left &&
			dropPosition.x <= right &&
			dropPosition.y >= top &&
			dropPosition.y <= bottom
		) {
			final = node.id;
		}
	}

	return final;
};
