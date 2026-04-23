// Simulation types from OpenAPI
import type { components } from "@/api/v1";

export type SimulationStatus = components["schemas"]["model.SimulationStatus"];
export type Simulation = components["schemas"]["response.SimulationResponse"];

// WebSocket event types (not in OpenAPI spec)
export type SimulationEventType =
	| "connection_ready"
	| "simulation_started"
	| "simulation_completed"
	| "simulation_failed"
	| "state_changed"
	| "transition_start"
	| "transition_end"
	| "output_sent"
	| "model_state_snapshot"
	| "devs_message";

export type SimulationEvent<T = unknown> = {
	type: SimulationEventType;
	timestamp: string;
	data: T;
};

export type SimulationStartedData = {
	simulationId: string;
	message: string;
};

export type SimulationCompletedData = {
	simulationId: string;
	message: string;
	results?: unknown;
};

export type SimulationFailedData = {
	simulationId: string;
	message: string;
	error: string;
};

export type StateChangedData = {
	simulationId: string;
	modelId: string;
	state: unknown;
};

export type TransitionData = {
	simulationId: string;
	modelId: string;
	stateBefore: unknown;
	stateAfter: unknown;
	simulationTime: number;
};

export type OutputSentData = {
	simulationId: string;
	modelId: string;
	portId: string;
	value: unknown;
	simulationTime: number;
};

export type DevsMessageData = {
	MsgType: string;
	simulationTime: number | null;
	sender: string | null;
	target: string | null;
};

// Union type for all event data
export type SimulationEventData =
	| SimulationStartedData
	| SimulationCompletedData
	| SimulationFailedData
	| StateChangedData
	| TransitionData
	| OutputSentData
	| DevsMessageData;
