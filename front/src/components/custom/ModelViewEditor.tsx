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
import { useDebouncedCallback } from "use-debounce";
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
	const needAutoFitView = useRef(true);
	const lastAutoLayoutSignal = useRef<number | undefined>(undefined);
	const [internalStructure, setInternalStructure] = useState(models);

	const [copyModelId, setCopyModelId] = useState<string | undefined>(undefined);
	const { nodes, edges } = internalStructure;
	const selectedModel = nodes.find(({ selected }) => selected);
	const debouncedChange = useDebouncedCallback(
		(params: ReactFlowInput) => onChange(params),
		250,
	);

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
			if (!onChange || !models) return;

			const updatedNodes = applyNodeChanges(changes, nodes);
			const newState = {
				...models,
				nodes: updatedNodes,
			};
			setInternalStructure(newState);
			debouncedChange(newState);
		},
		[models, onChange, nodes, debouncedChange],
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange<(typeof edges)[number]>[]) => {
			if (!onChange || !models) return;

			const updatedEdges = applyEdgeChanges<(typeof edges)[number]>(
				changes,
				edges,
			);
			onChange({
				...models,
				edges: updatedEdges,
			});
		},
		[models, onChange, edges],
	);

	const onLayoutFn = async ({ direction = "RIGHT" }) => {
		const opts = direction;
		if (models) {
			const { nodes: layoutedNodes, edges: layoutedEdges } =
				await getLayoutedElements(models.nodes, models.edges, opts);
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
			id: `${connection.source}->${connection.target}`,
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

		lastAutoLayoutSignal.current = autoLayoutSignal;
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

	useEffect(() => {
		setInternalStructure(models);
	}, [models]);

	return (
		<div className="h-full w-full flex flex-col">
			<ReactFlow
				connectionMode={ConnectionMode.Loose}
				defaultEdgeOptions={defaultEdgeOptions}
				edges={edges}
				edgeTypes={edgeTypes}
				fitView
				minZoom={0.1}
				nodes={nodes}
				nodeTypes={nodeTypes}
				onConnect={onConnect}
				onDragOver={onDragOver}
				onDrop={onDrop}
				onEdgesChange={onEdgesChange}
				onInit={(instance) => {
					setTimeout(() => {
						instance.fitView();
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
