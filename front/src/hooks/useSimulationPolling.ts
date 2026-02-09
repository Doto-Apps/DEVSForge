import type { components } from "@/api/v1";
import { useCallback, useEffect, useRef, useState } from "react";

type SimulationResponse = components["schemas"]["response.SimulationResponse"];
type SimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];
type SimulationEventsResponse =
	components["schemas"]["response.SimulationEventsResponse"];

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string).replace(
	/\/+$/,
	"",
);

type UseSimulationPollingOptions = {
	/** Polling interval in ms (default: 500) */
	interval?: number;
	/** Whether to start polling immediately (default: false) */
	enabled?: boolean;
	/** Callback when new events are received */
	onEvents?: (events: SimulationEventResponse[]) => void;
	/** Callback when simulation status changes */
	onStatusChange?: (status: SimulationResponse["status"]) => void;
};

type UseSimulationPollingResult = {
	/** All events received so far */
	events: SimulationEventResponse[];
	/** Current simulation data */
	simulation: SimulationResponse | null;
	/** Whether polling is active */
	isPolling: boolean;
	/** Any error that occurred */
	error: string | null;
	/** Start polling for a simulation */
	startPolling: (simulationId: string) => void;
	/** Stop polling */
	stopPolling: () => void;
	/** Clear all events */
	clearEvents: () => void;
};

export const useSimulationPolling = (
	options: UseSimulationPollingOptions = {},
): UseSimulationPollingResult => {
	const { interval = 500, enabled = false, onEvents, onStatusChange } = options;

	const [events, setEvents] = useState<SimulationEventResponse[]>([]);
	const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
	const [isPolling, setIsPolling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const simulationIdRef = useRef<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const lastEventCountRef = useRef(0);
	const previousStatusRef = useRef<SimulationResponse["status"] | null>(null);

	const fetchEvents = useCallback(async () => {
		if (!simulationIdRef.current) return;

		try {
			const response = await fetch(
				`${API_BASE_URL}/simulation/${simulationIdRef.current}/events?offset=${lastEventCountRef.current}`,
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch events");
			}

			const data = (await response.json()) as SimulationEventsResponse;

			// Update simulation status
			if (data.simulation) {
				setSimulation(data.simulation);

				// Check for status change
				if (data.simulation.status !== previousStatusRef.current) {
					previousStatusRef.current = data.simulation.status;
					onStatusChange?.(data.simulation.status);
				}

				// Stop polling if simulation is done
				if (
					data.simulation.status === "completed" ||
					data.simulation.status === "failed"
				) {
					stopPolling();
				}
			}

			// Add new events
			const newEvents = data.events;
			if (newEvents && newEvents.length > 0) {
				setEvents((prev) => [...prev, ...newEvents]);
				lastEventCountRef.current += newEvents.length;
				onEvents?.(newEvents);
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An error occurred";
			setError(errorMessage);
		}
	}, [onEvents, onStatusChange]);

	const startPolling = useCallback(
		(simulationId: string) => {
			// Reset state
			simulationIdRef.current = simulationId;
			lastEventCountRef.current = 0;
			previousStatusRef.current = null;
			setEvents([]);
			setSimulation(null);
			setError(null);
			setIsPolling(true);

			// Start interval
			intervalRef.current = setInterval(fetchEvents, interval);
			// Fetch immediately
			fetchEvents();
		},
		[fetchEvents, interval],
	);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	const clearEvents = useCallback(() => {
		setEvents([]);
		lastEventCountRef.current = 0;
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	// Auto-start if enabled and simulationId is set
	useEffect(() => {
		if (enabled && simulationIdRef.current && !isPolling) {
			startPolling(simulationIdRef.current);
		}
	}, [enabled, isPolling, startPolling]);

	return {
		events,
		simulation,
		isPolling,
		error,
		startPolling,
		stopPolling,
		clearEvents,
	};
};
