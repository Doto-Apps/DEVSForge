import { assert, describe, it } from "vitest";
import {
	mockApiModelResponse,
	mockReactFlowModelLibrary,
} from "./__tests__/fakeData";
import { modelToReactflow } from "./modelToReactflow";

describe("modelToReactflow", () => {
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
