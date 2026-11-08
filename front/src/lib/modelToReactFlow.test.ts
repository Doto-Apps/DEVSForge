import { assert, describe, it } from "vitest";
import {
	mockApiModelResponse,
	mockReactFlowModelLibrary,
} from "./__tests__/fakeData";
import { modelToReactflow } from "./modelToReactflow";

describe("modelToReactflow", () => {
	it.each([
		undefined,
		{},
		{
			bodyBackgroundColor: "",
			headerBackgroundColor: "",
			headerTextColor: "",
		},
	])("inherits definition colors at every nesting level when instance colors are %j", (instanceColors) => {
		const colors = {
			bodyBackgroundColor: "#123456",
			headerBackgroundColor: "#654321",
			headerTextColor: "#abcdef",
		};
		const models = mockApiModelResponse.map((model) => ({
			...model,
			components: model.components.map((component) => ({
				...component,
				instanceMetadata: {
					...(component.instanceMetadata ?? model.metadata),
					modelColors: instanceColors,
				},
			})),
			metadata: { ...model.metadata, modelColors: colors },
		}));

		const graph = modelToReactflow(models);
		assert.equal(graph.nodes.length, mockReactFlowModelLibrary.nodes.length);
		for (const node of graph.nodes) {
			assert.deepEqual(node.data.reactFlowModelGraphicalData, colors);
			assert.deepEqual(
				node.position,
				mockReactFlowModelLibrary.nodes.find(
					(original) => original.id === node.id,
				)?.position,
			);
		}
	});

	it("keeps explicit instance colors and inherits the remaining definition colors", () => {
		const colors = {
			bodyBackgroundColor: "#123456",
			headerBackgroundColor: "#654321",
			headerTextColor: "#abcdef",
		};
		const models = mockApiModelResponse.map((model) => ({
			...model,
			components: model.components.map((component) => ({
				...component,
				instanceMetadata: {
					...(component.instanceMetadata ?? model.metadata),
					modelColors: { bodyBackgroundColor: "#ff0000", headerTextColor: "" },
				},
			})),
			metadata: { ...model.metadata, modelColors: colors },
		}));

		for (const node of modelToReactflow(models).nodes) {
			assert.deepEqual(node.data.reactFlowModelGraphicalData, {
				...colors,
				...(node.parentId ? { bodyBackgroundColor: "#ff0000" } : {}),
			});
		}
	});

	it("should convert a model library to api request nodes", () => {
		assert.deepEqual(
			modelToReactflow(mockApiModelResponse).nodes.sort((a, b) =>
				a.id.localeCompare(b.data.id),
			),
			mockReactFlowModelLibrary.nodes.sort((a, b) =>
				a.id.localeCompare(b.data.id),
			),
		);
	});
	it("should convert a model library to api request edges", () => {
		assert.deepEqual(
			modelToReactflow(mockApiModelResponse).edges.sort((a, b) =>
				a.id.localeCompare(b.id),
			),
			mockReactFlowModelLibrary.edges.sort((a, b) => a.id.localeCompare(b.id)),
		);
	});
});
