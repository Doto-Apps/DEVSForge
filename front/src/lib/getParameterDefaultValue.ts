import type { components } from "@/api/v1";

export const getParameterDefaultValue = (
	parameter: components["schemas"]["json.ModelParameter"],
) => {
	if (parameter.type === "float" || parameter.type === "int") {
		return 0;
	}
	if (parameter.type === "bool") {
		return false;
	}
	if (parameter.type === "object") {
		return "{}";
	}
	return "";
};
