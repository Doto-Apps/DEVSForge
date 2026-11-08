import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	ConnectionMode,
	type Edge,
	type EdgeChange,
	MiniMap,
	type NodeChange,
	ReactFlow,
	StepEdge,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import {
	type ComponentProps,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { client } from "@/api/client.ts";
import type { components } from "@/api/v1.js";
import BiDirectionalEdge from "@/components/custom/reactFlow/BiDirectionalEdge.tsx";
import { ZoomSlider } from "@/components/zoom-slider";
import { DEFAULT_NODE_SIZE } from "@/constants.ts";
import { useToast } from "@/hooks/use-toast.ts";
import { addModelsToModels } from "@/lib/addModelsToModels.ts";
import { findHolderId } from "@/lib/findHolderId.ts";
import { FindParentNodeId } from "@/lib/findParentNodeId.ts";
import { getLayoutedElements } from "@/lib/getLayoutedElements.ts";
import { modelToReactflow } from "@/lib/modelToReactflow.ts";
import { reactflowToModel } from "@/lib/reactflowToModel.ts";
import { useDnD } from "@/providers/DnDContext.tsx";
import type { EdgeData, ReactFlowInput } from "@/types";
import ModelNode from "./reactFlow/ModelNode.tsx";

const nodeTypes: NonNullable<ComponentProps<typeof ReactFlow>["nodeTypes"]> = {
	resizer: ModelNode,
};

const edgeTypes = {
	custom: StepEdge, // Compatibility with previously recovered generator drafts.
	bidirectional: BiDirectionalEdge,
};

const defaultEdgeOptions = {
	animated: true,
	style: { zIndex: 1000 },
	type: "step",
};

type Props = {
	models: ReactFlowInput;
	onChange: (structure: ReactFlowInput) => void;
	isLoadingNodes?: boolean;
	autoLayoutSignal?: number;
};

export function ModelViewEditor({
	models,
	onChange,
	isLoadingNodes,
	autoLayoutSignal,
}: Props) {
	const { fitView, screenToFlowPosition, getInternalNode } = useReactFlow();
	const [dragId] = useDnD();
	const { toast } = useToast();
	const needAutoFitView = useRef(!models.viewport);
	const lastAutoLayoutSignal = useRef<number | undefined>(undefined);
	const latestModels = useRef(models);
	latestModels.current = models;
	const layoutRequest = useRef(0);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			layoutRequest.current += 1;
		};
	}, []);

	const [copyModelId, setCopyModelId] = useState<string | undefined>(undefined);
	const { nodes, edges } = models;
	const selectedModel = nodes.find(({ selected }) => selected);

	useHotkeys(["ctrl+c", "meta+c"], (e) => {
		e.preventDefault();
		setCopyModelId(selectedModel?.data.id);
	});
	useHotkeys(["ctrl+v", "meta+v"], async (e) => {
		e.preventDefault();
		if (!copyModelId) return;

		const { data, error } = await client.GET("/model/{id}/recursive", {
			params: {
				path: {
					id: copyModelId,
				},
			},
		});

		if (error) {
			toast({
				description: "Can't load model data",
				title: "An error occured",
				variant: "destructive",
			});
			return;
		}

		if (!models?.nodes || !data || !selectedModel?.id) return;

		addModels(data, selectedModel?.id, {
			keyword: [],
			modelRole: "",
			position: {
				x: selectedModel.position.x + 20,
				y: selectedModel.position.y + 20,
			},
			style: {
				height: selectedModel.measured?.height ?? DEFAULT_NODE_SIZE,
				width: selectedModel.measured?.width ?? DEFAULT_NODE_SIZE,
			},
		});
	});

	const onNodesChange = useCallback(
		(changes: NodeChange<(typeof nodes)[number]>[]) => {
			const updatedNodes = applyNodeChanges(changes, nodes);

			const deletedNodeIds = new Set(
				changes
					.filter((change) => change.type === "remove")
					.map((change) => change.id),
			);

			const updatedEdges =
				deletedNodeIds.size === 0
					? edges
					: edges.filter(
							(edge) =>
								!deletedNodeIds.has(edge.source) &&
								!deletedNodeIds.has(edge.target),
						);

			const newState: ReactFlowInput = {
				...models,
				edges: updatedEdges,
				nodes: updatedNodes,
			};

			onChange(newState);
		},
		[models, nodes, edges, onChange],
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange<(typeof edges)[number]>[]) => {
			const updatedEdges = applyEdgeChanges<(typeof edges)[number]>(
				changes,
				edges,
			);

			const newState: ReactFlowInput = {
				...models,
				edges: updatedEdges,
			};

			onChange(newState);
		},
		[models, edges, onChange],
	);
	const onLayoutFn = async ({ direction = "RIGHT" }) => {
		const opts = direction;
		if (models) {
			const request = ++layoutRequest.current;
			const { nodes: layoutedNodes, edges: layoutedEdges } =
				await getLayoutedElements(models.nodes, models.edges, opts);
			if (
				!mounted.current ||
				request !== layoutRequest.current ||
				latestModels.current !== models
			)
				return;
			lastAutoLayoutSignal.current = autoLayoutSignal;
			onChange?.({
				...models,
				edges: layoutedEdges,
				nodes: layoutedNodes,
			});
			needAutoFitView.current = true;
		}
	};

	const onOrganizeClick = () => {
		onLayoutFn({ direction: "RIGHT" });
	};

	const onDragOver = useCallback<React.DragEventHandler<HTMLDivElement>>(
		(event) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
		},
		[],
	);

	const addModels = async (
		modelsToAdd: components["schemas"]["response.ModelResponse"][],
		modelIdToPut: string,
		metadata?: components["schemas"]["json.ModelMetadata"],
	) => {
		const parentNode = models.nodes.find((n) => n.id === modelIdToPut);
		if (parentNode?.parentId && parentNode.deletable === false) {
			toast({
				title: "Protected reference",
				description: "Add models to the parent of the model under test.",
				variant: "destructive",
			});
			return;
		}

		const actualModels = reactflowToModel(models);

		if (!modelIdToPut || !parentNode || !actualModels) {
			return;
		}
		let newModelIdToput = modelIdToPut;

		if (
			(parentNode && parentNode.data.modelType !== "coupled") ||
			modelIdToPut === parentNode.id
		) {
			newModelIdToput = newModelIdToput.split("/").shift() ?? "";
		}
		const newModels = addModelsToModels(
			actualModels,
			newModelIdToput,
			modelsToAdd,
			metadata,
		);
		const newReactFlowData = modelToReactflow(newModels);

		newReactFlowData.nodes.sort((a, b) => a.id.length - b.id.length);

		onChange(newReactFlowData);
	};

	const onDrop: NonNullable<
		ComponentProps<typeof ReactFlow>["onDrop"]
	> = async (event) => {
		event.preventDefault();

		// check if the dropped element is valid
		if (!dragId || !onChange || !models) {
			return;
		}

		const { data, error } = await client.GET("/model/{id}/recursive", {
			params: {
				path: {
					id: dragId,
				},
			},
		});

		if (error) {
			toast({
				description: "Can't load model data",
				title: "An error occured",
				variant: "destructive",
			});
			return;
		}

		if (!models?.nodes || !data) return;

		const position = screenToFlowPosition({
			x: event.clientX,
			y: event.clientY,
		});

		const targetId = FindParentNodeId(models?.nodes, position, getInternalNode);
		const parentNode = models.nodes.find((n) => n.id === targetId);
		if (parentNode?.parentId && parentNode.deletable === false) {
			toast({
				title: "Protected reference",
				description: "Add models to the parent of the model under test.",
				variant: "destructive",
			});
			return;
		}

		const actualModels = reactflowToModel(models);

		if (!targetId || !parentNode || !actualModels) {
			return;
		}

		const newModels = addModelsToModels(actualModels, targetId, data, {
			keyword: [],
			modelRole: "",
			position: {
				x: position.x - parentNode.position.x,
				y: position.y - parentNode.position.y,
			},
			style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
		});
		const newReactFlowData = modelToReactflow(newModels);

		newReactFlowData.nodes.sort((a, b) => a.id.length - b.id.length);

		onChange(newReactFlowData);
	};

	const onConnect: NonNullable<
		ComponentProps<typeof ReactFlow>["onConnect"]
	> = (connection) => {
		if (!onChange || !models) return;

		const holderId = findHolderId(connection.source, connection.target);
		const holder = models.nodes.find((n) => n.id === holderId);
		if (holder?.parentId && holder.deletable === false) {
			toast({
				title: "Protected reference",
				description: "The internals of the model under test are read-only.",
				variant: "destructive",
			});
			return;
		}
		if (holderId === null) {
			toast({
				description: "Only direct connection are allowed",
				title: "Invalid action",
				variant: "destructive",
			});
			return;
		}
		const newEdge: Edge<EdgeData> = {
			data: {
				holderId: holderId,
			},
			id: `${connection.source}:${connection.sourceHandle}->${connection.target}:${connection.targetHandle}`,
			source: connection.source,
			sourceHandle: connection.sourceHandle,
			target: connection.target,
			targetHandle: connection.targetHandle,
		};

		const updatedEdges = addEdge(newEdge, models.edges);
		onChange({
			...models,
			edges: updatedEdges,
		});
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: Wanted
	useEffect(() => {
		if (autoLayoutSignal === undefined) return;
		if (lastAutoLayoutSignal.current === autoLayoutSignal) return;
		if (!models?.nodes || models.nodes.length === 0) return;

		let cancelled = false;

		const runAutoLayoutThenFit = async () => {
			try {
				await onLayoutFn({ direction: "RIGHT" });
				if (cancelled) return;
				requestAnimationFrame(() => {
					if (cancelled) return;
					requestAnimationFrame(() => {
						if (cancelled) return;
						fitView({ duration: 300 });
					});
				});
			} catch (error) {
				console.error("Auto layout failed", error);
			}
		};

		void runAutoLayoutThenFit();

		return () => {
			cancelled = true;
		};
	}, [autoLayoutSignal, models, fitView]);

	useEffect(() => {
		if (
			needAutoFitView.current &&
			models &&
			edges &&
			!isLoadingNodes &&
			models.nodes.length > 0
		) {
			fitView();
			needAutoFitView.current = false;
		}
	}, [fitView, models, edges, isLoadingNodes]);

	return (
		<div className="h-full w-full flex flex-col">
			<ReactFlow
				connectionMode={ConnectionMode.Loose}
				defaultEdgeOptions={defaultEdgeOptions}
				edges={edges}
				edgeTypes={edgeTypes}
				fitView={!models.viewport}
				defaultViewport={models.viewport}
				onMoveEnd={(_, viewport) => onChange({ ...models, viewport })}
				minZoom={0.1}
				nodes={nodes}
				nodeTypes={nodeTypes}
				onConnect={onConnect}
				onDragOver={onDragOver}
				onDrop={onDrop}
				onEdgesChange={onEdgesChange}
				onInit={(instance) => {
					setTimeout(() => {
						if (!models.viewport) instance.fitView();
					});
				}}
				onNodesChange={onNodesChange}
			>
				<MiniMap pannable zoomable />
				<ZoomSlider onOrganizeClick={onOrganizeClick} />
				<Background />
			</ReactFlow>
		</div>
	);
}
