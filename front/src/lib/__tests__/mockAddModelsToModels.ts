import type { components } from "@/api/v1";
import { DEFAULT_NODE_SIZE } from "@/constants";
import { expect } from "vitest";

// Ajouter components, ports, connections
export const mockApiModelWithoutAlpha: components["schemas"]["response.ModelResponse"][] =
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

export const mockModelsToAdd: components["schemas"]["response.ModelResponse"][] =
	[
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
			userId: "",
		},
	];

// Ajouter components, ports, connections
export const mockAddModelResult: components["schemas"]["response.ModelResponse"][] =
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
					instanceId: expect.stringContaining("-"),
					instanceMetadata: {
						position: {
							x: 0,
							y: 0,
						},
						style: {
							height: DEFAULT_NODE_SIZE,
							width: DEFAULT_NODE_SIZE,
						},
					},
				},
			],
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
			userId: "",
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
