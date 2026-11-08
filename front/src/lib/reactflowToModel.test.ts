import { assert, describe, it } from "vitest";
import type { ReactFlowInput } from "@/types";
import {
	mockApiModelRequest,
	mockReactFlowModelLibrary,
} from "./__tests__/fakeData";
import { modelToReactflow } from "./modelToReactflow";
import { reactflowToModel } from "./reactflowToModel";

describe("reactflowToModel", () => {
	it("should convert a model library to api request", () => {
		assert.deepEqual(
			reactflowToModel(mockReactFlowModelLibrary),
			mockApiModelRequest,
		);
	});

	it("preserves the integration and version through graph editing", () => {
		const response = mockApiModelRequest.map((m) =>
			m.type === "atomic"
				? { ...m, integrationId: "xdevs-go", integrationVersion: "1.0.0" }
				: m,
		);
		const models = reactflowToModel(modelToReactflow(response));
		for (const m of models) {
			assert.equal(
				m.integrationId,
				m.type === "atomic" ? "xdevs-go" : undefined,
			);
			assert.equal(
				m.integrationVersion,
				m.type === "atomic" ? "1.0.0" : undefined,
			);
		}
	});

	it("should keep root couplings even when edge holderId is missing", () => {
		const flow = {
			edges: [
				{
					id: "System:tick->System/Sensor:tick",
					source: "System",
					sourceHandle: "internal-System:tick",
					target: "System/Sensor",
					targetHandle: "System/Sensor:tick",
				},
				{
					id: "System/Sensor:value->System:value",
					source: "System/Sensor",
					sourceHandle: "System/Sensor:value",
					target: "System",
					targetHandle: "internal-System:value",
				},
			],
			nodes: [
				{
					data: {
						code: "",
						description: "",
						id: "System",
						inputPorts: [{ id: "value", name: "value" }],
						keyword: [],
						label: "System",
						modelRole: "",
						modelType: "coupled",
						outputPorts: [{ id: "tick", name: "tick" }],
					},
					id: "System",
					position: { x: 0, y: 0 },
				},
				{
					data: {
						code: "",
						description: "",
						id: "sensor-db",
						inputPorts: [{ id: "tick", name: "tick" }],
						keyword: [],
						label: "Sensor",
						modelRole: "",
						modelType: "atomic",
						outputPorts: [{ id: "value", name: "value" }],
					},
					id: "System/Sensor",
					parentId: "System",
					position: { x: 10, y: 10 },
				},
			],
		} as ReactFlowInput;

		const systemModel = reactflowToModel(flow).find(
			(model) => model.id === "System",
		);

		assert.deepEqual(systemModel?.connections, [
			{
				from: { instanceId: "root", port: "tick" },
				to: { instanceId: "Sensor", port: "tick" },
			},
			{
				from: { instanceId: "Sensor", port: "value" },
				to: { instanceId: "root", port: "value" },
			},
		]);
	});
	it("resolves boundary port IDs using the coupled input/output direction", () => {
		const flow = {
			edges: [
				{
					data: { holderId: "root" },
					id: "in",
					source: "root",
					sourceHandle: "in-internal-root:root-in",
					target: "root/child",
					targetHandle: "root/child:child-in",
				},
				{
					data: { holderId: "root" },
					id: "out",
					source: "root/child",
					sourceHandle: "root/child:child-out",
					target: "root",
					targetHandle: "out-internal-root:root-out",
				},
			],
			nodes: [
				{
					data: {
						id: "root",
						inputPorts: [{ id: "root-in", name: "request" }],
						label: "Root",
						modelType: "coupled",
						outputPorts: [{ id: "root-out", name: "reply" }],
					},
					id: "root",
					position: { x: 0, y: 0 },
				},
				{
					data: {
						id: "child",
						inputPorts: [{ id: "child-in", name: "accept" }],
						label: "Child",
						modelType: "atomic",
						outputPorts: [{ id: "child-out", name: "answer" }],
					},
					id: "root/child",
					parentId: "root",
					position: { x: 20, y: 30 },
				},
			],
		} as ReactFlowInput;
		assert.deepEqual(
			reactflowToModel(flow).find((m) => m.id === "root")?.connections,
			[
				{
					from: { instanceId: "root", port: "request" },
					to: { instanceId: "child", port: "accept" },
				},
				{
					from: { instanceId: "child", port: "answer" },
					to: { instanceId: "root", port: "reply" },
				},
			],
		);
	});
});
