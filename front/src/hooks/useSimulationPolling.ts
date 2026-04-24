import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/v1";

type SimulationResponse = components["schemas"]["response.SimulationResponse"];
type SimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];
type SimulationEventsResponse =
	components["schemas"]["response.SimulationEventsResponse"];

const API_BASE_URL = window.API_URL?.replace(/\/+$/, "");

const asRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const extractErrorReportMessage = (
	event: SimulationEventResponse,
): string | null => {
	const msgType = event.msgType ?? "";
	const payload = asRecord(event.payload);
	const messageType = asString(payload?.messageType);
	const isErrorReport =
		msgType.includes("ErrorReport") || messageType === "ErrorReport";
	if (!isErrorReport) return null;

	const reportPayload = asRecord(payload?.payload);
	const severity = asString(reportPayload?.severity)?.toLowerCase();
	if (severity === "warning" || severity === "info") {
		return null;
	}

	const message =
		asString(reportPayload?.message) ??
		asString(payload?.errorMessage) ??
		"Simulation error report received";
	const originRole = asString(reportPayload?.originRole);
	const originID = asString(reportPayload?.originId);

	if (originRole && originID) {
		return `[${originRole}:${originID}] ${message}`;
	}
	if (originRole) {
		return `[${originRole}] ${message}`;
	}
	return message;
};

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
	const {
		interval = 1000,
		enabled = false,
		onEvents,
		onStatusChange,
	} = options;

	const [events, setEvents] = useState<SimulationEventResponse[]>([]);
	const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
	const [isPolling, setIsPolling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const simulationIdRef = useRef<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const lastEventCountRef = useRef(0);
	const previousStatusRef = useRef<SimulationResponse["status"] | null>(null);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

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
					if (
						data.simulation.status === "failed" &&
						data.simulation.errorMessage
					) {
						setError(data.simulation.errorMessage);
					}
					stopPolling();
				}
			}

			// Add new events
			const newEvents = data.events;
			if (newEvents && newEvents.length > 0) {
				setEvents((prev) =>
					[...prev, ...newEvents].sort(({ createdAt: a }, { createdAt: b }) =>
						b && a ? a.localeCompare(b) : 0,
					),
				);
				lastEventCountRef.current += newEvents.length;
				onEvents?.(newEvents);

				const blockingError = newEvents
					.map((event) => extractErrorReportMessage(event))
					.find((message): message is string => Boolean(message));
				if (blockingError) {
					setError(blockingError);
					setSimulation((prev) =>
						prev
							? {
									...prev,
									errorMessage: blockingError,
									status: "failed",
								}
							: prev,
					);
					onStatusChange?.("failed");
					stopPolling();
				}
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An error occurred";
			setError(errorMessage);
		}
	}, [onEvents, onStatusChange, stopPolling]);

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
		clearEvents,
		error,
		events,
		isPolling,
		simulation,
		startPolling,
		stopPolling,
	};
};
