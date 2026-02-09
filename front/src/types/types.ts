import type { components } from "@/api/v1";
import type { Edge, Node } from "@xyflow/react";

export type ReactFlowInput = {
	nodes: Node<ReactFlowModelData>[];
	edges: Edge<EdgeData>[];
};

export type ReactFlowPort = { id: string; name: string };

export type ReactFlowModelData = {
	id: string;
	modelType: "atomic" | "coupled";
	label: string;
	description: string;
	inputPorts?: ReactFlowPort[];
	outputPorts?: ReactFlowPort[];
	reactFlowModelGraphicalData?: ReactFlowModelGraphicalData;
	parameters?: components["schemas"]["json.ModelParameter"][];
	code: string;
	modelRole: string;
	keyword: string[];
};

export type EdgeData = {
	holderId: string;
};

export type ReactFlowModelGraphicalData = {
	headerBackgroundColor?: string;
	headerTextColor?: string;
	bodyBackgroundColor?: string;
};

export type WorkerResponse = {
	diagnostics: Diagnostic[];
	error?: Error;
};

export type Diagnostic = {
	severity: number;
	message: string;
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
};
