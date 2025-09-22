import type { components } from "@/api/v1";
import type { ReactFlowInput } from "@/types";
import { expect } from "vitest";

export const mockReactFlowModelLibrary: ReactFlowInput = {
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
				parameters: undefined,
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
			deletable: false,
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
				parameters: undefined,
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
				parameters: undefined,
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
				parameters: undefined,
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
						id: "291f2776-e585-479c-8c83-1b68bc72fad6",
					},
				],
				outputPorts: [
					{
						id: "86af6923-c378-4b22-9436-f9eaa74b5f4b",
					},
				],
				parameters: undefined,
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
				parameters: undefined,
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
			selected: false,
			dragging: false,
		},
	],
	edges: [
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:e75ed355-7100-45b9-a4ba-4433332e090e",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:291f2776-e585-479c-8c83-1b68bc72fad6",
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:86af6923-c378-4b22-9436-f9eaa74b5f4b",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:acd4fc51-6314-4d2c-9bc2-f810f95c1bd8",
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:c4df7805-8f07-4e30-b81e-aedf143fa1ab",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			targetHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			},
		},
		{
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866:7b421cdf-e030-46db-8109-06dd509ac2e8",
			data: {
				holderId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			},
		},
	],
};

// Ajouter components, ports, connections
export const mockApiModelResponse: components["schemas"]["response.ModelResponse"][] =
	[
		{
			code: "",
			description: "",
			metadata: {
				position: {
					x: -351.70230386436424,
					y: -423.311332070595,
				},
				style: {
					height: 927,
					width: 1028,
				},
			},
			name: "Root",
			ports: [],
			type: "coupled",
			id: "2fe58217-47ae-4527-8983-ac8b54754abf",
			libId: undefined,
			components: [
				{
					instanceId: "c9474e1f-01ab-41f5-bd4a-510109d55451",
					modelId: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
					instanceMetadata: {
						style: {
							height: 793,
							width: 722,
						},
						position: {
							x: 34.44565430186219,
							y: 71.43263248466263,
						},
					},
				},
				{
					instanceId: "e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
					modelId: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
					instanceMetadata: {
						style: {
							height: 200,
							width: 200,
						},
						position: {
							x: 817.7118582602075,
							y: 380.4702881565224,
						},
					},
				},
			],
			connections: [
				{
					from: {
						instanceId: "c9474e1f-01ab-41f5-bd4a-510109d55451",
						port: "ad7c4558-a937-47b4-8503-6ba1a298c971",
					},
					to: {
						instanceId: "e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
						port: "7b421cdf-e030-46db-8109-06dd509ac2e8",
					},
				},
			],
			userId: "",
		},
		{
			id: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
			code: "",
			components: [
				{
					modelId: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
					instanceId: "af0d0800-75f1-4648-bada-2f516292e784",
					instanceMetadata: {
						position: {
							x: 65.13492069058077,
							y: 96.80682834164062,
						},
						style: {
							height: 417,
							width: 565,
						},
					},
				},
			],
			connections: [
				{
					from: {
						port: "e75ed355-7100-45b9-a4ba-4433332e090e",
						instanceId: "root",
					},
					to: {
						port: "3027641e-bb51-4798-834f-a0daedb048a0",
						instanceId: "af0d0800-75f1-4648-bada-2f516292e784",
					},
				},
				{
					from: {
						instanceId: "af0d0800-75f1-4648-bada-2f516292e784",
						port: "20eb3850-aaed-4450-8079-b010e92d7226",
					},
					to: {
						instanceId: "root",
						port: "ad7c4558-a937-47b4-8503-6ba1a298c971",
					},
				},
			],
			description: "",
			metadata: {
				position: {
					x: 0,
					y: 0,
				},
				style: {
					height: 200,
					width: 200,
				},
			},
			name: "Beta",
			ports: [
				{
					type: "in",
					id: "e75ed355-7100-45b9-a4ba-4433332e090e",
				},
				{
					type: "out",
					id: "ad7c4558-a937-47b4-8503-6ba1a298c971",
				},
			],
			type: "coupled",
			libId: undefined,
			userId: "",
		},
		{
			code: "",
			id: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
			type: "coupled",
			name: "Alpha",
			description: "",
			libId: undefined,
			metadata: {
				position: {
					x: 0,
					y: 0,
				},
				style: {
					height: 200,
					width: 200,
				},
			},
			ports: [
				{ id: "3027641e-bb51-4798-834f-a0daedb048a0", type: "in" },
				{ id: "20eb3850-aaed-4450-8079-b010e92d7226", type: "out" },
			],
			components: [
				{
					instanceId: "5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
					modelId: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
					instanceMetadata: {
						position: {
							x: 55.337456432243016,
							y: 145.41475433229658,
						},
						style: {
							height: 200,
							width: 200,
						},
					},
				},
				{
					instanceId: "ee55ad8a-122c-416b-a245-2beca2581dea",
					modelId: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
					instanceMetadata: {
						position: {
							x: 320.730800379744,
							y: 141.9414979094488,
						},
						style: {
							height: 200,
							width: 200,
						},
					},
				},
			],
			connections: [
				{
					from: {
						instanceId: "root",
						port: "3027641e-bb51-4798-834f-a0daedb048a0",
					},
					to: {
						instanceId: "5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
						port: "291f2776-e585-479c-8c83-1b68bc72fad6",
					},
				},
				{
					from: {
						instanceId: "5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
						port: "86af6923-c378-4b22-9436-f9eaa74b5f4b",
					},
					to: {
						instanceId: "ee55ad8a-122c-416b-a245-2beca2581dea",
						port: "acd4fc51-6314-4d2c-9bc2-f810f95c1bd8",
					},
				},
				{
					from: {
						instanceId: "ee55ad8a-122c-416b-a245-2beca2581dea",
						port: "c4df7805-8f07-4e30-b81e-aedf143fa1ab",
					},
					to: {
						instanceId: "root",
						port: "20eb3850-aaed-4450-8079-b010e92d7226",
					},
				},
			],
			userId: "",
		},
		{
			code: "",
			id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
			components: [],
			connections: [],
			description: "",
			metadata: {
				position: {
					x: 0,
					y: 0,
				},
				style: {
					height: 200,
					width: 200,
				},
			},
			name: "Charlie",
			ports: [
				{ id: "291f2776-e585-479c-8c83-1b68bc72fad6", type: "in" },
				{ id: "86af6923-c378-4b22-9436-f9eaa74b5f4b", type: "out" },
			],
			type: "atomic",
			libId: undefined,
			userId: expect.anything(),
		},
		{
			code: "",
			components: [],
			connections: [],
			description: "",
			metadata: {
				position: {
					x: 0,
					y: 0,
				},
				style: {
					height: 200,
					width: 200,
				},
			},
			name: "Delta",
			ports: [
				{
					id: "7b421cdf-e030-46db-8109-06dd509ac2e8",
					type: "in",
				},
			],
			type: "atomic",
			id: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
			libId: undefined,
			userId: "",
		},
	];

// Ajouter components, ports, connections
export const mockApiModelRequest: components["schemas"]["request.ModelRequest"][] =
	mockApiModelResponse.map(({ userId, ...rest }) => rest);
