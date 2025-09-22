import type { components } from "@/api/v1";
import { PYTHON_LINES } from "@/constants";
import type { ReactFlowInput } from "@/types";

// Return ["param1=DEFAULT_VALUE", ...]
const getPythonParameters = (
	parameters: components["schemas"]["json.ModelParameter"][] | undefined,
): string[] => {
	if (!parameters) {
		return [];
	}

	return parameters.map((p) => `${p.name}=${JSON.stringify(p.value)}`);
};

export const updateCodeBasedOnProperties = (
	node: ReactFlowInput["nodes"][number],
): typeof node => {
	const newNode = { ...node };

	const parametersStrings = getPythonParameters(node.data.parameters);

	newNode.data.code = newNode.data.code.replace(
		PYTHON_LINES.INIT_DECLARATION_START,
		parametersStrings.length > 0
			? `def __init__(self, ${parametersStrings.join(",")})`
			: "def __init__(self)",
	);
	return newNode;
};
