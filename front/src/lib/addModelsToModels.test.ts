import { describe, expect, it } from "vitest";
import {
	mockAddModelResult,
	mockApiModelWithoutAlpha,
	mockModelsToAdd,
} from "./__tests__/mockAddModelsToModels";
import { addModelsToModels } from "./addModelsToModels";

describe("addModelsToModels", () => {
	it("should return fakeData model", () => {
		expect(
			addModelsToModels(
				mockApiModelWithoutAlpha,
				"47e9cfa4-ea9f-46cb-a0c8-bbf8b47a7511",
				mockModelsToAdd,
			).sort((a, b) => (a.id && b.id ? a.id.localeCompare(b.id ?? "") : 0)),
		).toStrictEqual(
			mockAddModelResult.sort((a, b) =>
				a.id && b.id ? a.id.localeCompare(b.id ?? "") : 0,
			),
		);
	});
});
