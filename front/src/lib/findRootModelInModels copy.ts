import type { ReactFlowInput } from "@/types";

export const findRootModelInNodes = (models: ReactFlowInput) =>
	models.nodes.find((n) => n.parentId === undefined);
