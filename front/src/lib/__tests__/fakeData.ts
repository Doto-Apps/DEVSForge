import { expect } from "vitest";
import type { components } from "@/api/v1";
import type { ReactFlowInput } from "@/types";

export const mockReactFlowModelLibrary: ReactFlowInput = {
	edges: [
		{
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:e75ed355-7100-45b9-a4ba-4433332e090e",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
		},
		{
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:3027641e-bb51-4798-834f-a0daedb048a0",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:291f2776-e585-479c-8c83-1b68bc72fad6",
		},
		{
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446:86af6923-c378-4b22-9436-f9eaa74b5f4b",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:acd4fc51-6314-4d2c-9bc2-f810f95c1bd8",
		},
		{
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea:c4df7805-8f07-4e30-b81e-aedf143fa1ab",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			targetHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
		},
		{
			data: {
				holderId:
					"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784->2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784:20eb3850-aaed-4450-8079-b010e92d7226",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			targetHandle:
				"internal-2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
		},
		{
			data: {
				holderId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			},
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451->2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			source:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			sourceHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451:ad7c4558-a937-47b4-8503-6ba1a298c971",
			target:
				"2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			targetHandle:
				"2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866:7b421cdf-e030-46db-8109-06dd509ac2e8",
		},
	],
	nodes: [
		{
			data: {
				code: "",
				description: "",
				id: "2fe58217-47ae-4527-8983-ac8b54754abf",
				inputPorts: [],
				keyword: [],
				label: "Root",
				modelRole: "",
				modelType: "coupled",
				outputPorts: [],
				parameters: undefined,
			},
			deletable: false,
			dragging: false,
			height: 927,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf",
			measured: {
				height: 927,
				width: 1028,
			},
			position: {
				x: -351.70230386436424,
				y: -423.311332070595,
			},
			selected: false,
			type: "resizer",
			width: 1028,
		},
		{
			data: {
				code: "",
				description: "",
				id: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
				inputPorts: [
					{
						id: "e75ed355-7100-45b9-a4ba-4433332e090e",
						name: "",
					},
				],
				keyword: [],
				label: "Beta",
				modelRole: "",
				modelType: "coupled",
				outputPorts: [
					{
						id: "ad7c4558-a937-47b4-8503-6ba1a298c971",
						name: "",
					},
				],
				parameters: undefined,
			},
			dragging: false,
			extent: "parent",
			height: 793,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			measured: {
				height: 793,
				width: 722,
			},
			parentId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			position: {
				x: 34.44565430186219,
				y: 71.43263248466263,
			},
			selected: false,
			type: "resizer",
			width: 722,
		},
		{
			data: {
				code: "",
				description: "",
				id: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
				inputPorts: [
					{
						id: "3027641e-bb51-4798-834f-a0daedb048a0",
						name: "",
					},
				],
				keyword: [],
				label: "Alpha",
				modelRole: "",
				modelType: "coupled",
				outputPorts: [
					{
						id: "20eb3850-aaed-4450-8079-b010e92d7226",
						name: "",
					},
				],
				parameters: undefined,
			},
			dragging: false,
			extent: "parent",
			height: 417,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			measured: {
				height: 417,
				width: 565,
			},
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451",
			position: {
				x: 65.13492069058077,
				y: 96.80682834164062,
			},
			selected: false,
			type: "resizer",
			width: 565,
		},
		{
			data: {
				code: "",
				description: "",
				id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
				inputPorts: [
					{
						id: "291f2776-e585-479c-8c83-1b68bc72fad6",
						name: "",
					},
				],
				keyword: [],
				label: "Charlie",
				modelRole: "",
				modelType: "atomic",
				outputPorts: [
					{
						id: "86af6923-c378-4b22-9436-f9eaa74b5f4b",
						name: "",
					},
				],
				parameters: undefined,
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
			measured: {
				height: 200,
				width: 200,
			},
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			position: {
				x: 55.337456432243016,
				y: 145.41475433229658,
			},
			selected: false,
			type: "resizer",
			width: 200,
		},
		{
			data: {
				code: "",
				description: "",
				id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
				inputPorts: [
					{
						id: "291f2776-e585-479c-8c83-1b68bc72fad6",
						name: "",
					},
				],
				keyword: [],
				label: "Charlie",
				modelRole: "",
				modelType: "atomic",
				outputPorts: [
					{
						id: "86af6923-c378-4b22-9436-f9eaa74b5f4b",
						name: "",
					},
				],
				parameters: undefined,
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784/ee55ad8a-122c-416b-a245-2beca2581dea",
			measured: {
				height: 200,
				width: 200,
			},
			parentId:
				"2fe58217-47ae-4527-8983-ac8b54754abf/c9474e1f-01ab-41f5-bd4a-510109d55451/af0d0800-75f1-4648-bada-2f516292e784",
			position: {
				x: 320.730800379744,
				y: 141.9414979094488,
			},
			selected: false,
			type: "resizer",
			width: 200,
		},
		{
			data: {
				code: "",
				description: "",
				id: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
				inputPorts: [
					{
						id: "7b421cdf-e030-46db-8109-06dd509ac2e8",
						name: "",
					},
				],
				keyword: [],
				label: "Delta",
				modelRole: "",
				modelType: "atomic",
				outputPorts: [],
				parameters: undefined,
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "2fe58217-47ae-4527-8983-ac8b54754abf/e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
			measured: {
				height: 200,
				width: 200,
			},
			parentId: "2fe58217-47ae-4527-8983-ac8b54754abf",
			position: {
				x: 817.7118582602075,
				y: 380.4702881565224,
			},
			selected: false,
			type: "resizer",
			width: 200,
		},
	],
};

// Ajouter components, ports, connections
export const mockApiModelResponse: components["schemas"]["response.ModelResponse"][] =
	[
		{
			code: "",
			components: [
				{
					instanceId: "c9474e1f-01ab-41f5-bd4a-510109d55451",
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 34.44565430186219,
							y: 71.43263248466263,
						},
						style: {
							height: 793,
							width: 722,
						},
					},
					modelId: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
				},
				{
					instanceId: "e78589e5-5dca-4d1f-a4bd-0dfc759a7866",
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 817.7118582602075,
							y: 380.4702881565224,
						},
						style: {
							height: 200,
							width: 200,
						},
					},
					modelId: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
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
			description: "",
			id: "2fe58217-47ae-4527-8983-ac8b54754abf",
			libId: undefined,
			metadata: {
				keyword: [],
				modelRole: "",
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
			userId: "",
		},
		{
			code: "",
			components: [
				{
					instanceId: "af0d0800-75f1-4648-bada-2f516292e784",
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 65.13492069058077,
							y: 96.80682834164062,
						},
						style: {
							height: 417,
							width: 565,
						},
					},
					modelId: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
				},
			],
			connections: [
				{
					from: {
						instanceId: "root",
						port: "e75ed355-7100-45b9-a4ba-4433332e090e",
					},
					to: {
						instanceId: "af0d0800-75f1-4648-bada-2f516292e784",
						port: "3027641e-bb51-4798-834f-a0daedb048a0",
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
			id: "47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
			libId: undefined,
			metadata: {
				keyword: [],
				modelRole: "",
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
					id: "e75ed355-7100-45b9-a4ba-4433332e090e",
					name: "",
					type: "in",
				},
				{
					id: "ad7c4558-a937-47b4-8503-6ba1a298c971",
					name: "",
					type: "out",
				},
			],
			type: "coupled",
			userId: "",
		},
		{
			code: "",
			components: [
				{
					instanceId: "5ef6d06f-ca1f-402d-a2c8-88c6d8d8b446",
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 55.337456432243016,
							y: 145.41475433229658,
						},
						style: {
							height: 200,
							width: 200,
						},
					},
					modelId: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
				},
				{
					instanceId: "ee55ad8a-122c-416b-a245-2beca2581dea",
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 320.730800379744,
							y: 141.9414979094488,
						},
						style: {
							height: 200,
							width: 200,
						},
					},
					modelId: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
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
			description: "",
			id: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
			libId: undefined,
			metadata: {
				keyword: [],
				modelRole: "",
				position: {
					x: 0,
					y: 0,
				},
				style: {
					height: 200,
					width: 200,
				},
			},
			name: "Alpha",
			ports: [
				{ id: "3027641e-bb51-4798-834f-a0daedb048a0", name: "", type: "in" },
				{ id: "20eb3850-aaed-4450-8079-b010e92d7226", name: "", type: "out" },
			],
			type: "coupled",
			userId: "",
		},
		{
			code: "",
			components: [],
			connections: [],
			description: "",
			id: "58c5fc0f-9c59-42ec-a2a6-90c99171be65",
			libId: undefined,
			metadata: {
				keyword: [],
				modelRole: "",
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
				{ id: "291f2776-e585-479c-8c83-1b68bc72fad6", name: "", type: "in" },
				{ id: "86af6923-c378-4b22-9436-f9eaa74b5f4b", name: "", type: "out" },
			],
			type: "atomic",
			userId: expect.anything(),
		},
		{
			code: "",
			components: [],
			connections: [],
			description: "",
			id: "5de4a9ed-bfbc-4764-8ab4-b93f634ae268",
			libId: undefined,
			metadata: {
				keyword: [],
				modelRole: "",
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
					name: "",
					type: "in",
				},
			],
			type: "atomic",
			userId: "",
		},
	];

// Ajouter components, ports, connections
export const mockApiModelRequest: components["schemas"]["request.ModelRequest"][] =
	mockApiModelResponse.map(({ userId, ...rest }) => rest);
