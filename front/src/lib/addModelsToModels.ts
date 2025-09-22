import type { components } from "@/api/v1";
import { v4 as uuidv4 } from "uuid";
import { findRootModelInModels } from "./findRootModelInModels";

export const addModelsToModels = (
	actualModels:
		| components["schemas"]["response.ModelResponse"][]
		| components["schemas"]["request.ModelRequest"][],
	modelIdToPutIn: string,
	modelsToAdd: typeof actualModels,
	instanceMetadata?: components["schemas"]["json.ModelMetadata"],
): typeof actualModels => {
	const actualRootModel = actualModels.find((m) => m.id === modelIdToPutIn);

	const modelsToAddRootModel = findRootModelInModels(modelsToAdd);

	if (
		!actualRootModel?.id ||
		!modelsToAddRootModel?.id ||
		actualRootModel.id === modelsToAddRootModel.id
	) {
		return actualModels;
	}

	const newInstanceID = uuidv4();

	actualRootModel.components.push({
		instanceId: newInstanceID,
		modelId: modelsToAddRootModel.id,
		instanceMetadata: {
			position: {
				x: instanceMetadata ? instanceMetadata.position.x : 0,
				y: instanceMetadata ? instanceMetadata.position.y : 0,
			},
			style: {
				height: modelsToAddRootModel.metadata.style.height,
				width: modelsToAddRootModel.metadata.style.width,
			},
		},
	});

	const newModels: typeof actualModels = [...actualModels, ...modelsToAdd];

	return newModels;
};
