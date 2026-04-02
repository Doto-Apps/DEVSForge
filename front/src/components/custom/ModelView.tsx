import {
	Background,
	ConnectionMode,
	ReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import BiDirectionalEdge from "@/components/custom/reactFlow/BiDirectionalEdge.tsx";
import type { ReactFlowInput } from "@/types";
import ModelNode from "./reactFlow/ModelNode.tsx";

const nodeTypes = {
	resizer: ModelNode,
};

const edgeTypes = {
	bidirectional: BiDirectionalEdge,
};

const defaultEdgeOptions = {
	animated: true,
	style: { zIndex: 1000 },
	type: "step",
};

type Props = {
	models: ReactFlowInput;
};

export function ModelView({ models }: Props) {
	const nodes = models?.nodes || [];
	const edges = models?.edges || [];

	return (
		<div className="h-full w-full flex flex-col">
			<ReactFlowProvider>
				<ReactFlow
					connectionMode={ConnectionMode.Loose}
					defaultEdgeOptions={defaultEdgeOptions}
					edges={edges}
					edgeTypes={edgeTypes}
					fitView
					minZoom={0.1}
					nodes={nodes}
					nodeTypes={nodeTypes}
					onInit={(instance) => {
						setTimeout(() => {
							instance.fitView();
						});
					}}
				>
					<Background />
				</ReactFlow>
			</ReactFlowProvider>
		</div>
	);
}
