import { expect } from "vitest";
import type { components } from "@/api/v1";
import { DEFAULT_NODE_SIZE } from "@/constants";

// Ajouter components, ports, connections
export const mockApiModelWithoutAlpha: components["schemas"]["response.ModelResponse"][] =
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
			components: [],
			connections: [],
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

export const mockModelsToAdd: components["schemas"]["response.ModelResponse"][] =
	[
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
			userId: "",
		},
	];

// Ajouter components, ports, connections
export const mockAddModelResult: components["schemas"]["response.ModelResponse"][] =
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
					instanceId: expect.stringContaining("-"),
					instanceMetadata: {
						keyword: [],
						modelRole: "",
						position: {
							x: 0,
							y: 0,
						},
						style: {
							height: DEFAULT_NODE_SIZE,
							width: DEFAULT_NODE_SIZE,
						},
					},
					modelId: "63cc59b1-45e7-4861-8c1d-d35f22de4194",
				},
			],
			connections: [],
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
			userId: "",
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
