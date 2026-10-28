import { assert, describe, it } from "vitest";
import type { ReactFlowInput } from "@/types";
import {
	mockApiModelRequest,
	mockReactFlowModelLibrary,
} from "./__tests__/fakeData";
import { reactflowToModel } from "./reactflowToModel";

describe("reactflowToModel", () => {
	it("should convert a model library to api request", () => {
		assert.deepEqual(
			reactflowToModel(mockReactFlowModelLibrary),
			mockApiModelRequest,
		);
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
});
