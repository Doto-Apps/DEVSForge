import type { components } from "@/api/v1";
import type { Simulation } from "@/types";
import { useCallback, useState } from "react";
import { useSimulationPolling } from "./useSimulationPolling";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string).replace(
	/\/+$/,
	"",
);

type SimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];

type StartSimulationResult = {
	startSimulation: (
		modelId: string,
		maxTime?: number,
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
		interval: 500,
		onStatusChange: (status) => {
			setSimulation((prev) => (prev ? { ...prev, status } : null));
		},
	});

	const startSimulation = useCallback(
		async (modelId: string, maxTime?: number): Promise<Simulation | null> => {
			setIsLoading(true);
			setError(null);
			polling.clearEvents();

			try {
				// Step 1: Create the simulation
				const createResponse = await fetch(
					`${API_BASE_URL}/simulation/${modelId}`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
						},
						body: JSON.stringify({ maxTime: maxTime || 0 }),
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
						method: "POST",
						headers: {
							Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
						},
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
		startSimulation,
		simulation,
		isLoading,
		error,
		isPolling: polling.isPolling,
		events: polling.events,
		stopPolling: polling.stopPolling,
		clearEvents: polling.clearEvents,
	};
};

// Hook to get a specific simulation
export const useGetSimulation = (simulationId: string | null) => {
	const [simulation, setSimulation] = useState<Simulation | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSimulation = useCallback(async () => {
		if (!simulationId) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(
				`${API_BASE_URL}/simulation/${simulationId}`,
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch simulation");
			}

			const data = (await response.json()) as Simulation;
			setSimulation(data);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An error occurred";
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, [simulationId]);

	return {
		simulation,
		isLoading,
		error,
		refetch: fetchSimulation,
	};
};

// Hook to get simulations for a model
export const useModelSimulations = (modelId: string | null) => {
	const [simulations, setSimulations] = useState<Simulation[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSimulations = useCallback(async () => {
		if (!modelId) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(
				`${API_BASE_URL}/simulation/model/${modelId}`,
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch simulations");
			}

			const data = (await response.json()) as Simulation[];
			setSimulations(data);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An error occurred";
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, [modelId]);

	return {
		simulations,
		isLoading,
		error,
		refetch: fetchSimulations,
	};
};
