import type { ReactFlowInput } from "@/types";

// Parameters are now passed through manifest/runtime config.
// Do not mutate user code with regex-based replacements.
export const updateCodeBasedOnProperties = (
	node: ReactFlowInput["nodes"][number],
): typeof node => node;
