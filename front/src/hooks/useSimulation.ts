import { useCallback, useState } from "react";
import type { components } from "@/api/v1";
import type { Simulation } from "@/types";
import { useSimulationPolling } from "./useSimulationPolling";

const API_BASE_URL = window.API_URL?.replace(/\/+$/, "");

type SimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];
type SimulationStartRequest =
	components["schemas"]["request.SimulationStartRequest"];
type APISimulationInstanceOverride = NonNullable<
	SimulationStartRequest["overrides"]
>[number];
type APISimulationParameterOverride = NonNullable<
	APISimulationInstanceOverride["overrideParams"]
>[number];

export type SimulationParameterOverride = {
	name: NonNullable<APISimulationParameterOverride["name"]>;
	value: APISimulationParameterOverride["value"];
};

export type SimulationInstanceOverride = {
	instanceModelId: NonNullable<
		APISimulationInstanceOverride["instanceModelId"]
	>;
	overrideParams: SimulationParameterOverride[];
};

type StartSimulationResult = {
	startSimulation: (
		modelId: string,
		maxTime?: number,
		overrides?: SimulationInstanceOverride[],
	) => Promise<Simulation | null>;
	simulation: Simulation | null;
	isLoading: boolean;
	error: string | null;
	isPolling: boolean;
	events: SimulationEventResponse[];
	stopPolling: () => void;
	clearEvents: () => void;
};

export const useStartSimulation = (): StartSimulationResult => {
	const [simulation, setSimulation] = useState<Simulation | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const polling = useSimulationPolling({
		interval: 1000,
		onStatusChange: (status) => {
			setSimulation((prev) => (prev ? { ...prev, status } : null));
		},
	});

	const startSimulation = useCallback(
		async (
			modelId: string,
			maxTime?: number,
			overrides?: SimulationInstanceOverride[],
		): Promise<Simulation | null> => {
			setIsLoading(true);
			setError(null);
			polling.clearEvents();

			try {
				const payload: SimulationStartRequest = {
					maxTime: maxTime || 0,
				};
				if (overrides && overrides.length > 0) {
					payload.overrides = overrides;
				}

				// Step 1: Create the simulation
				const createResponse = await fetch(
					`${API_BASE_URL}/simulation/${modelId}`,
					{
						body: JSON.stringify(payload),
						headers: {
							Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
							"Content-Type": "application/json",
						},
						method: "POST",
					},
				);

				if (!createResponse.ok) {
					const errorData = await createResponse.json();
					throw new Error(errorData.error || "Failed to create simulation");
				}

				const simulationData = (await createResponse.json()) as Simulation;
				if (!simulationData.id) {
					throw new Error("Simulation ID not returned from server");
				}
				setSimulation(simulationData);

				// Step 2: Start polling
				polling.startPolling(simulationData.id);

				// Step 3: Start the simulation
				const startResponse = await fetch(
					`${API_BASE_URL}/simulation/${simulationData.id}/start`,
					{
						headers: {
							Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
						},
						method: "POST",
					},
				);

				if (!startResponse.ok) {
					const errorData = await startResponse.json();
					throw new Error(errorData.error || "Failed to start simulation");
				}

				return simulationData;
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "An error occurred";
				setError(errorMessage);
				polling.stopPolling();
				return null;
			} finally {
				setIsLoading(false);
			}
		},
		[polling],
	);

	return {
		clearEvents: polling.clearEvents,
		error: error ?? polling.error,
		events: polling.events,
		isLoading,
		isPolling: polling.isPolling,
		simulation,
		startSimulation,
		stopPolling: polling.stopPolling,
	};
};
