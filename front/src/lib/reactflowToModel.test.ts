import { assert, describe, it } from "vitest";
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
});
