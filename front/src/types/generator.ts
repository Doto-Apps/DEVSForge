import type { components } from "@/api/v1";
import type { ReactFlowInput } from ".";

// Types for LLM diagram responses
export type LLMDiagramResponse =
	components["schemas"]["response.DiagramResponse"];
export type LLMModel = components["schemas"]["response.Model"];
export type LLMConnection = components["schemas"]["response.Connection"];
export type LLMEndpoint = components["schemas"]["response.Endpoint"];
export type LLMPortResponse = components["schemas"]["response.PortResponse"];
export type ExperimentalFrameRole =
	components["schemas"]["response.ExperimentalFrameRole"];

// Request types
export type GenerateDiagramRequest =
	components["schemas"]["request.GenerateDiagramRequest"];

export type GenerateEFStructureRequest =
	components["schemas"]["request.GenerateEFStructureRequest"];

export type PortInfo = components["schemas"]["request.PortInfo"];
export type GenerateModelCodeRequest =
	components["schemas"]["request.GenerateModelRequest"];

export type ReuseCandidate = {
	modelId: string;
	name: string;
	score: number;
	keywords?: string[];
	description?: string;
};

export type GenerateModelCodeResult = {
	code: string;
	keywords?: string[];
	reuseCandidates?: ReuseCandidate[];
	reuseUsed?: ReuseCandidate;
	reuseMode?: string;
};

// Generator states
export type GeneratorPhase = "prompt" | "structure" | "code" | "complete";

// Model data in the generation flow
export type GeneratedModelData = {
	id: string;
	name: string;
	type: "atomic" | "coupled";
	role?: ExperimentalFrameRole;
	ports: {
		in: string[];
		out: string[];
	};
	components?: string[];
	code?: string;
	codeGenerated: boolean;
	dependencies: string[]; // IDs of models this one depends on
};

// Complete structure of the generated diagram
export type GeneratedDiagram = {
	name: string;
	models: GeneratedModelData[];
	connections: LLMConnection[];
	rootModelId?: string;
	modelUnderTestId?: string;
	targetModelId?: string;
	reactFlowData?: ReactFlowInput;
};

// État global du générateur
export type GeneratorState = {
	phase: GeneratorPhase;
	diagramName: string;
	userPrompt: string;
	diagram: GeneratedDiagram | null;
	currentModelIndex: number;
	isLoading: boolean;
	error: string | null;
};

// Props pour les composants
export type DiagramPromptFormProps = {
	onGenerate: (diagramName: string, prompt: string) => void;
	isLoading: boolean;
	initialName?: string;
	initialPrompt?: string;
};

export type StructureEditorProps = {
	diagram: GeneratedDiagram;
	onDiagramChange: (diagram: GeneratedDiagram) => void;
	onValidate: () => void;
	onRegenerate: () => void;
};

export type CodeGenerationPanelProps = {
	diagram: GeneratedDiagram;
	currentModelIndex: number;
	onCodeGenerated: (modelId: string, code: string) => void;
	onModelValidated: () => void;
	onCodeChange: (modelId: string, code: string) => void;
	atomicModelFilter?: (model: GeneratedModelData) => boolean;
	excludeFromContextModelIds?: string[];
};
