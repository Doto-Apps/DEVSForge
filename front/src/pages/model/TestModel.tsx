import { ConnectionMode, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import BiDirectionalEdge from "@/components/custom/reactFlow/BiDirectionalEdge.tsx";
import type { ReactFlowInput } from "@/types";
import { type ComponentProps, useState } from "react";
import ModelNode from "../../components/custom/reactFlow/ModelNode";

const nodeTypes = {
	resizer: ModelNode,
};

const edgeTypes: ComponentProps<typeof ReactFlow>["edgeTypes"] = {
	bidirectional: BiDirectionalEdge,
};

const defaultEdgeOptions: ComponentProps<
	typeof ReactFlow
>["defaultEdgeOptions"] = {
	type: "step",
	animated: true,
	style: { zIndex: 1000 },
};

const reactFlowModelLibrary: ReactFlowInput = {
	nodes: [
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf",
			type: "resizer",
			measured: {
				height: 927,
				width: 1028,
			},
			data: {
				id: "2fe58217-47ae-4527-8983-ac8b54754abf",
				modelType: "coupled",
				label: "Root",
				inputPorts: [],
				outputPorts: [],
				code: "",
			},
			position: {
				x: -351.70230386436424,
				y: -423.311332070595,
			},
			height: 927,
			width: 1028,
			dragging: false,
			selected: false,
			resizing: false,
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			type: "resizer",
			measured: {
				height: 793,
				width: 722,
			},
			data: {
				id: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
				modelType: "coupled",
				label: "Beta",
				inputPorts: [
					{
						id: "e75ed355-7100-45b9-a4ba-4433332e090e",
					},
				],
				outputPorts: [
					{
						id: "ad7c4558-a937-47b4-8503-6ba1a298c971",
					},
				],
				code: "",
			},
			position: {
				x: 34.44565430186219,
				y: 71.43263248466263,
			},
			height: 793,
			width: 722,
			parentId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			extent: "parent",
			selected: false,
			dragging: false,
			resizing: false,
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			type: "resizer",
			measured: {
				height: 417,
				width: 565,
			},
			data: {
				id: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
				modelType: "coupled",
				label: "Alpha",
				inputPorts: [
					{
						id: "3027641e-bb51-4798-834f-a0daedb048a0",
					},
				],
				outputPorts: [
					{
						id: "20eb3850-aaed-4450-8079-b010e92d7226",
					},
				],
				code: "",
			},
			position: {
				x: 65.13492069058077,
				y: 96.80682834164062,
			},
			height: 417,
			width: 565,
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			extent: "parent",
			selected: false,
			dragging: false,
			resizing: false,
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			type: "resizer",
			measured: {
				height: 200,
				width: 200,
			},
			data: {
				id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
				modelType: "atomic",
				label: "Charlie",
				inputPorts: [
					{
						id: "291f2776-e585-479c-8c83-1b68bc72fad6",
					},
				],
				outputPorts: [
					{
						id: "86af6923-c378-4b22-9436-f9eaa74b5f4b",
					},
				],
				code: "",
			},
			position: {
				x: 55.337456432243016,
				y: 145.41475433229658,
			},
			height: 200,
			width: 200,
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			extent: "parent",
			selected: false,
			dragging: false,
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			type: "resizer",
			measured: {
				height: 200,
				width: 200,
			},
			data: {
				id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
				modelType: "atomic",
				label: "Charlie",
				inputPorts: [
					{
						id: "acd4fc51-6314-4d2c-9bc2-f810f95c1bd8",
					},
				],
				outputPorts: [
					{
						id: "c4df7805-8f07-4e30-b81e-aedf143fa1ab",
					},
				],
				code: "",
			},
			position: {
				x: 320.730800379744,
				y: 141.9414979094488,
			},
			height: 200,
			width: 200,
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			extent: "parent",
			selected: false,
			dragging: false,
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			type: "resizer",
			measured: {
				height: 200,
				width: 200,
			},
			data: {
				id: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
				modelType: "atomic",
				label: "Delta",
				inputPorts: [
					{
						id: "7b421cdf-e030-46db-8109-06dd509ac2e8",
					},
				],
				outputPorts: [],
				code: "",
			},
			position: {
				x: 817.7118582602075,
				y: 380.4702881565224,
			},
			height: 200,
			width: 200,
			parentId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			extent: "parent",
			selected: true,
			dragging: false,
		},
	],
	edges: [
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"in-internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:e75ed355-7100-45b9-a4ba-4433332e090e",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"in-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
			data: {
				holderId:
					"c9474e1f-01ab-41f5-bd4a-510109d55451/2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"in-internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			targetHandle:
				"in-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:291f2776-e585-479c-8c83-1b68bc72fad6",
			data: {
				holderId:
					"af0d0800-75f1-4648-bada-2f516292e784/c9474e1f-01ab-41f5-bd4a-510109d55451/2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			sourceHandle:
				"out-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:86af6923-c378-4b22-9436-f9eaa74b5f4b",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			targetHandle:
				"in-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:acd4fc51-6314-4d2c-9bc2-f810f95c1bd8",
			data: {
				holderId:
					"af0d0800-75f1-4648-bada-2f516292e784/c9474e1f-01ab-41f5-bd4a-510109d55451/2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			sourceHandle:
				"out-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:c4df7805-8f07-4e30-b81e-aedf143fa1ab",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"out-internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
			data: {
				holderId:
					"af0d0800-75f1-4648-bada-2f516292e784/c9474e1f-01ab-41f5-bd4a-510109d55451/2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"out-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			targetHandle:
				"out-internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
			data: {
				holderId:
					"c9474e1f-01ab-41f5-bd4a-510109d55451/2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866}",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"out-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			targetHandle:
				"in-2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866:7b421cdf-e030-46db-8109-06dd509ac2e8",
			data: {
				holderId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
	],
};

export function TestModel() {
	// État pour stocker les données ReactFlow
	const [nodes, _setNodes] = useState(reactFlowModelLibrary.nodes);
	const [edges, _setEdges] = useState(reactFlowModelLibrary.edges);

	return (
		<div className="h-full w-full flex flex-col">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				fitView
				minZoom={0.1}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				defaultEdgeOptions={defaultEdgeOptions}
				connectionMode={ConnectionMode.Loose}
			/>
		</div>
	);
}
