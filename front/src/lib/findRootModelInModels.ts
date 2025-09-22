import type { components } from "@/api/v1";

export const findRootModelInModels = (
	models: (
		| components["schemas"]["request.ModelRequest"]
		| components["schemas"]["response.ModelResponse"]
	)[],
) =>
	models.find(({ id }) =>
		models.every(
			({ components }) => !components.some(({ modelId }) => modelId === id),
		),
	);
