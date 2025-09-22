import { type Node, Position } from "@xyflow/react";
import type { ReactFlowModelData } from "../types";

const position = { x: 0, y: 0 };

export const initialNodes: Node<ReactFlowModelData>[] = [
	{
		id: "1",
		type: "resizer",
		data: {
			modelType: "atomic",
			label: "Model",
			inputPorts: [{ id: "test" }],
			outputPorts: [],
			toolbarPosition: Position.Top,
			toolbarVisible: true,
			id: "Unique model",
		},
		style: { width: 300, height: 300 },
		position: position,
	},
];
