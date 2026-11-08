import {
	Background,
	ConnectionMode,
	ReactFlow,
	ReactFlowProvider,
	StepEdge,
	useNodesInitialized,
	useReactFlow,
} from "@xyflow/react";
import { type ComponentProps, useEffect } from "react";
import "@xyflow/react/dist/base.css";
import BiDirectionalEdge from "@/components/custom/reactFlow/BiDirectionalEdge.tsx";
import type { ReactFlowInput } from "@/types";
import ModelNode from "./reactFlow/ModelNode.tsx";

function PreviewNode(props: ComponentProps<typeof ModelNode>) {
	const { data } = props;
	return (
		<div className="relative h-full w-full">
			<ModelNode {...props} />
			{data.modelType === "atomic" && (
				<div className="pointer-events-none absolute inset-x-4 bottom-3 top-14 overflow-hidden text-xs">
					<p className="mb-3 font-mono text-[10px] uppercase tracking-wider opacity-60">
						{data.integrationId?.replace("xdevs-", "xDEVS ") ||
							data.language ||
							"Atomic model"}
					</p>
					{data.inputPorts?.map((port) => (
						<p className="truncate leading-5" key={`in-${port.id}`}>
							<span className="mr-2 opacity-50">in</span>
							{port.name}
						</p>
					))}
					{data.outputPorts?.map((port) => (
						<p className="truncate leading-5" key={`out-${port.id}`}>
							<span className="mr-2 opacity-50">out</span>
							{port.name}
						</p>
					))}
					{data.parameters?.slice(0, 2).map((parameter) => (
						<p
							className="mt-2 truncate font-mono text-[10px] opacity-60"
							key={parameter.name}
						>
							{parameter.name} = {JSON.stringify(parameter.value)}
						</p>
					))}
					{!data.inputPorts?.length && !data.outputPorts?.length && (
						<p className="leading-5 opacity-60">
							{data.description || "No ports declared"}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

const nodeTypes = { resizer: PreviewNode };

const edgeTypes = {
	bidirectional: BiDirectionalEdge,
	custom: StepEdge, // Compatibility with previously recovered generator drafts.
};

const defaultEdgeOptions = {
	animated: true,
	style: { zIndex: 1000 },
	type: "step",
};

type Props = {
	models: ReactFlowInput;
	onInspect?: (id: string) => void;
	focusId?: string;
};

function PreviewViewport({ focusId }: { focusId?: string }) {
	const ready = useNodesInitialized();
	const { fitView } = useReactFlow();
	useEffect(() => {
		if (!ready) return;
		void fitView({
			duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? 0
				: 200,
			maxZoom: 0.9,
			nodes: focusId ? [{ id: focusId }] : undefined,
			padding: 0.12,
		});
	}, [ready, focusId, fitView]);
	return null;
}

export function ModelView({ models, onInspect, focusId }: Props) {
	const nodes = models?.nodes || [];
	const edges = models?.edges || [];

	return (
		<div className="h-full w-full flex flex-col">
			<ReactFlowProvider>
				<ReactFlow
					connectionMode={ConnectionMode.Loose}
					defaultEdgeOptions={defaultEdgeOptions}
					deleteKeyCode={null}
					edges={edges}
					edgeTypes={edgeTypes}
					elementsSelectable={false}
					fitView
					fitViewOptions={{ maxZoom: 0.9, padding: 0.12 }}
					minZoom={0.1}
					nodes={nodes}
					nodesConnectable={false}
					nodesDraggable={false}
					nodeTypes={nodeTypes}
					onNodeClick={(_, node) => onInspect?.(node.data.id)}
					preventScrolling={false}
					zoomOnScroll={false}
				>
					<PreviewViewport focusId={focusId} />
					<Background />
				</ReactFlow>
			</ReactFlowProvider>
		</div>
	);
}
