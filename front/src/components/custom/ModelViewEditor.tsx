import {
	Background,
	ConnectionMode,
	type Edge,
	type EdgeChange,
	MiniMap,
	type NodeChange,
	ReactFlow,
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import BiDirectionalEdge from "@/components/custom/reactFlow/BiDirectionalEdge.tsx";
import { ZoomSlider } from "@/components/zoom-slider";
import { getLayoutedElements } from "@/lib/getLayoutedElements.ts";
import { useDnD } from "@/providers/DnDContext.tsx";
import type { EdgeData, ReactFlowInput } from "@/types";
import {
	type ComponentProps,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import ModelNode from "./reactFlow/ModelNode.tsx";

import { client } from "@/api/client.ts";
import type { components } from "@/api/v1.js";
import { DEFAULT_NODE_SIZE } from "@/constants.ts";
import { useToast } from "@/hooks/use-toast.ts";
import { addModelsToModels } from "@/lib/addModelsToModels.ts";
import { findHolderId } from "@/lib/findHolderId.ts";
import { FindParentNodeId } from "@/lib/findParentNodeId.ts";
import { modelToReactflow } from "@/lib/modelToReactflow.ts";
import { reactflowToModel } from "@/lib/reactflowToModel.ts";
import { useHotkeys } from "react-hotkeys-hook";
import { useDebouncedCallback } from "use-debounce";

const nodeTypes: NonNullable<ComponentProps<typeof ReactFlow>["nodeTypes"]> = {
	resizer: ModelNode,
};

const edgeTypes = {
	bidirectional: BiDirectionalEdge,
};

const defaultEdgeOptions = {
	type: "step",
	animated: true,
	style: { zIndex: 1000 },
};

type Props = {
	models: ReactFlowInput;
	onChange: (structure: ReactFlowInput) => void;
	isLoadingNodes?: boolean;
};

export function ModelViewEditor({ models, onChange, isLoadingNodes }: Props) {
	const { fitView, screenToFlowPosition, getInternalNode } = useReactFlow();
	const [dragId] = useDnD();
	const { toast } = useToast();
	const needAutoFitView = useRef(true);
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
				title: "An error occured",
				description: "Can't load model data",
				variant: "destructive",
			});
			return;
		}

		if (!models?.nodes || !data || !selectedModel?.id) return;

		addModels(data, selectedModel?.id, {
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
				nodes: layoutedNodes,
				edges: layoutedEdges,
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
		console.log(modelIdToPut);

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
				title: "An error occured",
				description: "Can't load model data",
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
			console.log("pute");
			return;
		}

		const newModels = addModelsToModels(actualModels, targetId, data, {
			position: {
				x: position.x - parentNode.position.x,
				y: position.y - parentNode.position.y,
			},
			style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
		});
		console.log(newModels);
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
				title: "Invalid action",
				description: "Only direct connection are allowed",
				variant: "destructive",
			});
			return;
		}
		const newEdge: Edge<EdgeData> = {
			id: `${connection.source}->${connection.target}`,
			source: connection.source,
			sourceHandle: connection.sourceHandle,
			target: connection.target,
			targetHandle: connection.targetHandle,
			data: {
				holderId: holderId,
			},
		};

		const updatedEdges = addEdge(newEdge, models.edges);
		onChange({
			...models,
			edges: updatedEdges,
		});
	};

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
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				minZoom={0.1}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				defaultEdgeOptions={defaultEdgeOptions}
				connectionMode={ConnectionMode.Loose}
				onConnect={onConnect}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onInit={(instance) => {
					setTimeout(() => {
						instance.fitView();
					});
				}}
			>
				<MiniMap zoomable pannable />
				<ZoomSlider onOrganizeClick={onOrganizeClick} />
				<Background />
			</ReactFlow>
		</div>
	);
}
