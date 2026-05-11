import {
	Activity,
	AlertTriangle,
	ArrowRight,
	ArrowRightLeft,
	Clock3,
	Download,
	Filter,
	ListTree,
	Loader2,
	Play,
	RefreshCw,
	Search,
	Send,
	Square,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { components } from "@/api/v1";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	type SimulationInstanceOverride,
	useStartSimulation,
} from "@/hooks/useSimulation";
import { modelToReactflow } from "@/lib/modelToReactflow";
import { cn } from "@/lib/utils";
import type { ReactFlowInput, SimulationStatus } from "@/types";
import {
	getKafkaMessageEventTime,
	type KafkaMessage,
	type SimulationEventResponse,
} from "@/types/simulation-events";

type PortValue = {
	portIdentifier: string;
	value: unknown;
	valueKey: string;
};

type PortRoute = {
	sourceModel: string;
	sourcePort: string;
	targetModel: string;
	targetPort: string;
};

type TransitionCandidate = {
	id: string;
	eventID: string;
	simulationTime: number | null;
	createdAt: string | null;
	valueKey: string;
};

type TransitMessage = {
	id: string;
	simulationTime: number | null;
	createdAt: string | null;
	fromModel: string | null;
	fromPort: string | null;
	toModel: string | null;
	toPort: string;
	value: unknown;
	valueKey: string;
	sourceEventID: string | null;
	targetEventID: string | null;
	matched: boolean;
};

type EventTypeFilter =
	| "all"
	| "message"
	| "transition"
	| "lifecycle"
	| "payload";

type ModelParameter = components["schemas"]["json.ModelParameter"];

export type SimulationParameterTarget = {
	instanceModelId: string;
	modelId: string;
	modelName: string;
	parameters: ModelParameter[];
};

type SimulationPanelProps = {
	modelId: string;
	modelName?: string;
	modelNameById?: Record<string, string>;
	recursiveModels?: components["schemas"]["response.ModelResponse"][];
	parameterTargets?: SimulationParameterTarget[];
	panelTitle?: string;
	panelDescription?: string;
	runButtonLabel?: string;
	showParameterOverrides?: boolean;
	parameterSectionTitle?: string;
	parameterSectionDescription?: string;
};

const statusColors: Record<SimulationStatus, string> = {
	completed: "bg-green-500",
	failed: "bg-red-500",
	pending: "bg-yellow-500",
	running: "bg-blue-500",
};

const statusLabels: Record<SimulationStatus, string> = {
	completed: "Completed",
	failed: "Failed",
	pending: "Pending",
	running: "Running",
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	return true;
};

const parseMaybeJSON = (value: unknown): unknown => {
	let current = value;
	for (let i = 0; i < 2; i += 1) {
		if (typeof current !== "string") break;
		const trimmed = current.trim();
		if (trimmed.length === 0) break;
		try {
			current = JSON.parse(trimmed);
		} catch {
			break;
		}
	}
	return current;
};

const normalizeForKey = (value: unknown): unknown => {
	const parsed = parseMaybeJSON(value);
	if (Array.isArray(parsed)) {
		return parsed.map(normalizeForKey);
	}
	if (!isRecord(parsed)) return parsed;

	const keys = Object.keys(parsed).sort((a, b) => a.localeCompare(b));
	const normalized: Record<string, unknown> = {};
	for (const key of keys) {
		normalized[key] = normalizeForKey(parsed[key]);
	}
	return normalized;
};

const stableValueKey = (value: unknown): string => {
	try {
		return JSON.stringify(normalizeForKey(value));
	} catch {
		return String(value);
	}
};

const formatValueCompact = (value: unknown, maxLength = 120): string => {
	const normalized = normalizeForKey(value);
	let raw = "";
	try {
		raw = JSON.stringify(normalized);
	} catch {
		raw = String(normalized);
	}
	if (raw.length <= maxLength) return raw;
	return `${raw.slice(0, maxLength - 3)}...`;
};

const formatValuePretty = (value: unknown): string => {
	try {
		return JSON.stringify(normalizeForKey(value), null, 2);
	} catch {
		return String(value);
	}
};

const getPortRouteKey = (modelID: string, portIdentifier: string): string =>
	`${modelID}::${portIdentifier}`;

const getTransitionCandidateKey = (
	modelID: string,
	portIdentifier: string,
	valueKey: string,
): string => `${getPortRouteKey(modelID, portIdentifier)}::${valueKey}`;

const getPortIdentifierFromHandle = (
	handle: string | undefined | null,
): string => {
	const parts = handle?.split(":") ?? [];
	return parts.length > 1 ? parts.slice(1).join(":") : "";
};

const getEventTime = (event: SimulationEventResponse): number | null => {
	return getKafkaMessageEventTime(event.message);
};

const getEventCategory = (event: SimulationEventResponse): EventTypeFilter => {
	const { messageType } = event.message;
	if (messageType === "OutputReport" || messageType === "MonitoringMessage") {
		return "message";
	}
	if (
		messageType === "ExecuteTransition" ||
		messageType === "TransitionComplete"
	) {
		return "transition";
	}
	if (
		messageType === "SimulationInit" ||
		messageType === "NextInternalTimeReport" ||
		messageType === "RequestOutput" ||
		messageType === "SimulationTerminate" ||
		messageType === "ModelTerminated"
	) {
		return "lifecycle";
	}
	return "payload";
};

const extractPortValues = (
	event: SimulationEventResponse,
	path: "outputs" | "inputs",
): PortValue[] => {
	const { message } = event;
	const rawList =
		path === "outputs" && message.messageType === "OutputReport"
			? (message.payload.outputs ?? [])
			: path === "inputs" && message.messageType === "ExecuteTransition"
				? (message.payload.inputs ?? [])
				: [];

	return rawList.map((item) => {
		const value = parseMaybeJSON(item.value);
		return {
			portIdentifier: item.portName,
			value,
			valueKey: stableValueKey(value),
		};
	});
};

const getEventIcon = (messageType: KafkaMessage["messageType"]) => {
	switch (messageType) {
		case "OutputReport":
			return Send;
		case "ErrorReport":
			return AlertTriangle;
		case "ExecuteTransition":
			return ArrowRightLeft;
		case "TransitionComplete":
			return Activity;
		case "SimulationTerminate":
		case "ModelTerminated":
			return Square;
		case "SimulationInit":
			return Play;
		case "NextInternalTimeReport":
		case "RequestOutput":
			return Clock3;
		case "MonitoringMessage":
			return ListTree;
	}
};

const getEventBadgeClass = (messageType: KafkaMessage["messageType"]) => {
	switch (messageType) {
		case "OutputReport":
		case "MonitoringMessage":
			return "bg-blue-500/10 text-blue-700 border-blue-200";
		case "ErrorReport":
			return "bg-red-500/10 text-red-700 border-red-200";
		case "ExecuteTransition":
		case "TransitionComplete":
			return "bg-amber-500/10 text-amber-700 border-amber-200";
		case "SimulationTerminate":
		case "ModelTerminated":
			return "bg-green-500/10 text-green-700 border-green-200";
		case "SimulationInit":
		case "NextInternalTimeReport":
		case "RequestOutput":
			return "bg-muted text-muted-foreground";
	}
};

export function SimulationPanel({
	modelId,
	modelName,
	modelNameById = {},
	recursiveModels = [],
	parameterTargets = [],
	panelTitle = "Simulation",
	panelDescription,
	runButtonLabel = "Start",
	showParameterOverrides = true,
	parameterSectionTitle = "Runtime Parameter Overrides",
	parameterSectionDescription = "Optional. Overrides are applied only for this simulation run.",
}: SimulationPanelProps) {
	const {
		startSimulation,
		simulation,
		isLoading,
		error,
		isPolling,
		events,
		stopPolling,
		clearEvents,
	} = useStartSimulation();

	const [maxTime, setMaxTime] = useState<string>("100");
	const [search, setSearch] = useState("");
	const [eventTypeFilter, setEventTypeFilter] =
		useState<EventTypeFilter>("all");
	const [onlyEventsWithPayload, setOnlyEventsWithPayload] = useState(false);
	const [showOnlyMatchedTransit, setShowOnlyMatchedTransit] = useState(false);
	const [parameterOverrides, setParameterOverrides] = useState<
		Record<string, Record<string, unknown>>
	>({});
	const [objectInputs, setObjectInputs] = useState<Record<string, string>>({});

	const modelIdentityById = useMemo(() => {
		const map = { ...modelNameById };
		for (const item of recursiveModels) {
			if (item.id && item.name) {
				map[item.id] = item.name;
			}
		}
		return map;
	}, [modelNameById, recursiveModels]);

	const setOverrideValue = (
		instanceModelId: string,
		paramName: string,
		baseValue: unknown,
		nextValue: unknown,
	) => {
		const baseKey = stableValueKey(baseValue);
		const nextKey = stableValueKey(nextValue);
		const shouldReset = baseKey === nextKey;

		setParameterOverrides((prev) => {
			const next = { ...prev };
			const currentByInstance = { ...(next[instanceModelId] ?? {}) };

			if (shouldReset) {
				delete currentByInstance[paramName];
			} else {
				currentByInstance[paramName] = nextValue;
			}

			if (Object.keys(currentByInstance).length === 0) {
				delete next[instanceModelId];
			} else {
				next[instanceModelId] = currentByInstance;
			}

			return next;
		});
	};

	const runtimeOverrides = useMemo<SimulationInstanceOverride[]>(() => {
		return Object.entries(parameterOverrides)
			.map(([instanceModelId, params]) => ({
				instanceModelId,
				overrideParams: Object.entries(params).map(([name, value]) => ({
					name,
					value,
				})),
			}))
			.filter((override) => override.overrideParams.length > 0);
	}, [parameterOverrides]);

	const parameterTargetsWithParams = useMemo(
		() => parameterTargets.filter((target) => target.parameters.length > 0),
		[parameterTargets],
	);

	const handleStart = async () => {
		const maxTimeValue = Number.parseFloat(maxTime) || 0;
		await startSimulation(
			modelId,
			maxTimeValue,
			runtimeOverrides.length > 0 ? runtimeOverrides : undefined,
		);
	};

	const handleStop = () => {
		stopPolling();
	};

	const handleClear = () => {
		clearEvents();
	};

	const handleExportEventsJSON = () => {
		if (events.length === 0) return;

		const now = new Date();
		const safeModelName = (modelName ?? modelId ?? "simulation")
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "_");
		const timestamp = now.toISOString().replace(/[:.]/g, "-");

		const payload = {
			eventCount: events.length,
			events,
			exportedAt: now.toISOString(),
			modelId,
			modelName: modelName ?? null,
			simulationId: simulation?.id ?? null,
			simulationStatus: simulation?.status ?? null,
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${safeModelName}-events-${timestamp}.json`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	};

	const handleClearOverrides = () => {
		setParameterOverrides({});
		setObjectInputs({});
	};

	const formatModelIdentity = (id: string | null): string => {
		if (!id) return "unknown";
		const exactName = modelIdentityById[id];
		if (exactName) return `${exactName} (${id})`;

		const atomicModelID = id.split("/").at(-1);
		const name = atomicModelID ? modelIdentityById[atomicModelID] : null;
		if (!name) return id;
		return `${name} (${id})`;
	};

	const modelRouteGraph = useMemo(() => {
		const emptyGraph: {
			edgesBySource: Map<string, PortRoute[]>;
			nodesById: Map<string, ReactFlowInput["nodes"][number]>;
		} = {
			edgesBySource: new Map(),
			nodesById: new Map(),
		};

		if (recursiveModels.length === 0) return emptyGraph;

		let reactFlowModel: ReactFlowInput;
		try {
			reactFlowModel = modelToReactflow(recursiveModels);
		} catch {
			return emptyGraph;
		}

		const nodesById = new Map(
			reactFlowModel.nodes.map((node) => [node.id, node]),
		);
		const edgesBySource = new Map<string, PortRoute[]>();

		for (const edge of reactFlowModel.edges) {
			const sourcePort = getPortIdentifierFromHandle(edge.sourceHandle);
			const targetPort = getPortIdentifierFromHandle(edge.targetHandle);
			if (!edge.source || !edge.target || !sourcePort || !targetPort) {
				continue;
			}

			const route: PortRoute = {
				sourceModel: edge.source,
				sourcePort,
				targetModel: edge.target,
				targetPort,
			};
			const key = getPortRouteKey(route.sourceModel, route.sourcePort);
			edgesBySource.set(key, [...(edgesBySource.get(key) ?? []), route]);
		}

		return { edgesBySource, nodesById };
	}, [recursiveModels]);

	const transitMessages = useMemo(() => {
		const transits: TransitMessage[] = [];
		const claimedTransitionIDs = new Set<string>();
		const transitionCandidatesByTarget = new Map<
			string,
			TransitionCandidate[]
		>();

		const resolveAtomicTargets = (
			sourceModel: string,
			sourcePort: string,
		): PortRoute[] => {
			const resolved: PortRoute[] = [];
			const queue = [{ model: sourceModel, port: sourcePort }];
			const visited = new Set<string>();

			while (queue.length > 0) {
				const current = queue.shift();
				if (!current) break;

				const currentKey = getPortRouteKey(current.model, current.port);
				if (visited.has(currentKey)) continue;
				visited.add(currentKey);

				for (const edge of modelRouteGraph.edgesBySource.get(currentKey) ??
					[]) {
					const targetNode = modelRouteGraph.nodesById.get(edge.targetModel);
					if (!targetNode || targetNode.data.modelType === "atomic") {
						resolved.push({
							sourceModel,
							sourcePort,
							targetModel: edge.targetModel,
							targetPort: edge.targetPort,
						});
						continue;
					}

					queue.push({ model: edge.targetModel, port: edge.targetPort });
				}
			}

			return resolved;
		};

		const findTransitionCandidate = (
			route: PortRoute,
			valueKey: string,
			outputSimulationTime: number | null,
		): TransitionCandidate | null => {
			const key = getTransitionCandidateKey(
				route.targetModel,
				route.targetPort,
				valueKey,
			);
			const candidates = (transitionCandidatesByTarget.get(key) ?? []).filter(
				(candidate) => !claimedTransitionIDs.has(candidate.id),
			);

			const exactTimeCandidate = candidates.find(
				(candidate) => candidate.simulationTime === outputSimulationTime,
			);
			const nextCandidate =
				outputSimulationTime === null
					? null
					: candidates.find(
							(candidate) =>
								candidate.simulationTime !== null &&
								candidate.simulationTime >= outputSimulationTime,
						);
			const candidate = exactTimeCandidate ?? nextCandidate ?? candidates[0];

			if (candidate) claimedTransitionIDs.add(candidate.id);
			return candidate ?? null;
		};

		events.forEach((event, index) => {
			if (event.message.messageType !== "ExecuteTransition") return;
			if (!event.message.receiverId) return;

			const simulationTime = getEventTime(event);
			const eventID = event.id ?? `event-${index}`;
			const inputs = extractPortValues(event, "inputs");

			inputs.forEach((input, inputIndex) => {
				const key = getTransitionCandidateKey(
					event.message.receiverId ?? "",
					input.portIdentifier,
					input.valueKey,
				);
				const candidates = transitionCandidatesByTarget.get(key) ?? [];
				transitionCandidatesByTarget.set(key, [
					...candidates,
					{
						createdAt: event.createdAt ?? null,
						eventID,
						id: `${eventID}-in-${inputIndex}`,
						simulationTime,
						valueKey: input.valueKey,
					},
				]);
			});
		});

		events.forEach((event, index) => {
			if (event.message.messageType !== "OutputReport") return;
			if (!event.message.senderId) return;

			const sourceModel = event.message.senderId;
			const simulationTime = getEventTime(event);
			const eventID = event.id ?? `event-${index}`;
			const outputs = extractPortValues(event, "outputs");

			outputs.forEach((output, outputIndex) => {
				const routes = resolveAtomicTargets(sourceModel, output.portIdentifier);

				routes.forEach((route, routeIndex) => {
					const targetCandidate = findTransitionCandidate(
						route,
						output.valueKey,
						simulationTime,
					);

					transits.push({
						createdAt: event.createdAt ?? targetCandidate?.createdAt ?? null,
						fromModel: route.sourceModel,
						fromPort: route.sourcePort,
						id: `${eventID}-out-${outputIndex}-route-${routeIndex}`,
						matched: Boolean(targetCandidate),
						simulationTime,
						sourceEventID: `${eventID}-out-${outputIndex}`,
						targetEventID: targetCandidate?.eventID ?? null,
						toModel: route.targetModel,
						toPort: route.targetPort,
						value: output.value,
						valueKey: output.valueKey,
					});
				});
			});
		});

		return transits;
	}, [events, modelRouteGraph]);

	const maxSimTime = useMemo(() => {
		const values = events
			.map((event) => getEventTime(event))
			.filter((time): time is number => typeof time === "number");
		if (values.length === 0) return null;
		return Math.max(...values);
	}, [events]);

	const filteredTransitMessages = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();

		return transitMessages.filter((message) => {
			if (showOnlyMatchedTransit && !message.matched) return false;

			if (!normalizedSearch) return true;
			const haystack = [
				message.fromModel ?? "",
				message.fromPort ?? "",
				message.toModel ?? "",
				message.toPort ?? "",
				formatValueCompact(message.value, 200),
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(normalizedSearch);
		});
	}, [search, showOnlyMatchedTransit, transitMessages]);

	const filteredEvents = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();

		return events.filter((event) => {
			if (
				eventTypeFilter !== "all" &&
				getEventCategory(event) !== eventTypeFilter
			) {
				return false;
			}

			if (onlyEventsWithPayload) {
				const inputValues = extractPortValues(event, "inputs");
				const outputValues = extractPortValues(event, "outputs");
				if (inputValues.length === 0 && outputValues.length === 0) return false;
			}

			if (!normalizedSearch) return true;

			const haystack = [
				event.message.messageType,
				event.message.senderId ?? "",
				event.message.receiverId ?? "",
				formatValueCompact(event.message, 300),
			]
				.join(" ")
				.toLowerCase();

			return haystack.includes(normalizedSearch);
		});
	}, [eventTypeFilter, events, onlyEventsWithPayload, search]);

	const eventSummary = useMemo(() => {
		let messages = 0;
		let transitions = 0;
		let others = 0;

		for (const event of events) {
			const category = getEventCategory(event);
			if (category === "message") {
				messages += 1;
			} else if (category === "transition") {
				transitions += 1;
			} else {
				others += 1;
			}
		}

		return {
			messages,
			others,
			transitions,
			transits: transitMessages.length,
		};
	}, [events, transitMessages.length]);

	return (
		<Card className="w-full border-border/60 shadow-sm">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2 text-xl">
							{panelTitle}
							{isPolling && (
								<RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
							)}
						</CardTitle>
						<CardDescription>
							{panelDescription ||
								`${modelName || `Model: ${modelId}`} - DEVS message tracking and transit flows`}
						</CardDescription>
					</div>
					{simulation?.status && (
						<Badge
							className={cn("text-white", statusColors[simulation.status])}
							variant="secondary"
						>
							{statusLabels[simulation.status]}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border bg-muted/20 p-4 space-y-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="flex items-center gap-3">
							<Label className="whitespace-nowrap text-sm" htmlFor="maxTime">
								Max simulation time
							</Label>
							<Input
								className="w-32"
								disabled={isLoading || simulation?.status === "running"}
								id="maxTime"
								inputMode="numeric"
								onChange={(e) => setMaxTime(e.target.value)}
								pattern="[0-9]*\\.?[0-9]*"
								placeholder="0 = infinite"
								type="text"
								value={maxTime}
							/>
							<span className="text-xs text-muted-foreground">
								(0 = unlimited)
							</span>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<Button
								className="min-w-32"
								disabled={isLoading || simulation?.status === "running"}
								onClick={handleStart}
							>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Starting...
									</>
								) : (
									<>
										<Play className="mr-2 h-4 w-4" />
										{runButtonLabel}
									</>
								)}
							</Button>
							<Button
								disabled={!isPolling}
								onClick={handleStop}
								variant="outline"
							>
								<Square className="mr-2 h-4 w-4" />
								Stop
							</Button>
							<Button
								disabled={events.length === 0}
								onClick={handleClear}
								variant="ghost"
							>
								Clear
							</Button>
							<Button
								disabled={events.length === 0}
								onClick={handleExportEventsJSON}
								variant="outline"
							>
								<Download className="mr-2 h-4 w-4" />
								Export JSON
							</Button>
						</div>
					</div>

					{showParameterOverrides && parameterTargetsWithParams.length > 0 ? (
						<div className="rounded-md border bg-background p-3 space-y-3">
							<div className="flex items-center justify-between gap-2">
								<div>
									<div className="text-sm font-medium">
										{parameterSectionTitle}
									</div>
									<div className="text-xs text-muted-foreground">
										{parameterSectionDescription}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">
										{runtimeOverrides.length} override
										{runtimeOverrides.length > 1 ? "s" : ""}
									</Badge>
									<Button
										disabled={runtimeOverrides.length === 0}
										onClick={handleClearOverrides}
										size="sm"
										type="button"
										variant="ghost"
									>
										Reset
									</Button>
								</div>
							</div>

							<ScrollArea className="h-72 pr-1">
								<div className="space-y-3">
									{parameterTargetsWithParams.map((target) => {
										const instanceOverrides =
											parameterOverrides[target.instanceModelId] ?? {};

										return (
											<div
												className="rounded-md border p-3 space-y-3"
												key={target.instanceModelId}
											>
												<div className="space-y-1">
													<div className="text-sm font-medium leading-none">
														{target.modelName}
													</div>
													<div className="text-xs text-muted-foreground font-mono break-all">
														{target.instanceModelId}
													</div>
												</div>

												<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
													{target.parameters.map((param) => {
														const hasRuntimeOverride = Object.hasOwn(
															instanceOverrides,
															param.name,
														);
														const currentValue = hasRuntimeOverride
															? instanceOverrides[param.name]
															: param.value;
														const objectInputKey = `${target.instanceModelId}::${param.name}`;

														return (
															<div className="space-y-1.5" key={param.name}>
																<div className="flex items-center justify-between gap-2">
																	<Label className="text-xs font-semibold">
																		{param.name}
																	</Label>
																	<Badge
																		className={cn(
																			"text-[10px]",
																			hasRuntimeOverride
																				? "border-blue-300 text-blue-700"
																				: "text-muted-foreground",
																		)}
																		variant="outline"
																	>
																		{param.type}
																	</Badge>
																</div>

																{param.type === "bool" ? (
																	<div className="flex h-10 items-center rounded-md border px-3">
																		<Switch
																			checked={Boolean(currentValue)}
																			onCheckedChange={(checked) =>
																				setOverrideValue(
																					target.instanceModelId,
																					param.name,
																					param.value,
																					checked,
																				)
																			}
																		/>
																	</div>
																) : null}

																{param.type === "string" ? (
																	<Input
																		onChange={(event) =>
																			setOverrideValue(
																				target.instanceModelId,
																				param.name,
																				param.value,
																				event.target.value,
																			)
																		}
																		type="text"
																		value={
																			typeof currentValue === "string"
																				? currentValue
																				: String(currentValue ?? "")
																		}
																	/>
																) : null}

																{param.type === "int" ||
																param.type === "float" ? (
																	<Input
																		onChange={(event) => {
																			const raw = event.target.value;
																			if (raw === "") {
																				setOverrideValue(
																					target.instanceModelId,
																					param.name,
																					param.value,
																					param.value,
																				);
																				return;
																			}
																			const parsed = Number(raw);
																			if (Number.isNaN(parsed)) return;

																			setOverrideValue(
																				target.instanceModelId,
																				param.name,
																				param.value,
																				param.type === "int"
																					? Math.trunc(parsed)
																					: parsed,
																			);
																		}}
																		step={param.type === "int" ? 1 : 0.1}
																		type="number"
																		value={
																			typeof currentValue === "number" &&
																			Number.isFinite(currentValue)
																				? currentValue
																				: ""
																		}
																	/>
																) : null}

																{param.type === "object" ? (
																	<Textarea
																		className="font-mono min-h-24"
																		onChange={(event) => {
																			const raw = event.target.value;
																			setObjectInputs((prev) => ({
																				...prev,
																				[objectInputKey]: raw,
																			}));
																			try {
																				const parsed = JSON.parse(raw);
																				setOverrideValue(
																					target.instanceModelId,
																					param.name,
																					param.value,
																					parsed,
																				);
																			} catch {
																				// keep raw editing until valid JSON
																			}
																		}}
																		value={
																			objectInputs[objectInputKey] ??
																			JSON.stringify(
																				currentValue ?? {},
																				null,
																				2,
																			)
																		}
																	/>
																) : null}
															</div>
														);
													})}
												</div>
											</div>
										);
									})}
								</div>
							</ScrollArea>
						</div>
					) : null}

					<div className="grid grid-cols-2 gap-2 md:grid-cols-5">
						<div className="rounded-md bg-background p-3 border">
							<div className="text-xs text-muted-foreground">Messages</div>
							<div className="text-lg font-semibold">
								{eventSummary.messages}
							</div>
						</div>
						<div className="rounded-md bg-background p-3 border">
							<div className="text-xs text-muted-foreground">Transitions</div>
							<div className="text-lg font-semibold">
								{eventSummary.transitions}
							</div>
						</div>
						<div className="rounded-md bg-background p-3 border">
							<div className="text-xs text-muted-foreground">Transits</div>
							<div className="text-lg font-semibold">
								{eventSummary.transits}
							</div>
						</div>
						<div className="rounded-md bg-background p-3 border">
							<div className="text-xs text-muted-foreground">Others</div>
							<div className="text-lg font-semibold">{eventSummary.others}</div>
						</div>
						<div className="rounded-md bg-background p-3 border">
							<div className="text-xs text-muted-foreground">
								Max observed time
							</div>
							<div className="text-lg font-semibold">
								{maxSimTime === null ? "-" : `t=${maxSimTime}`}
							</div>
						</div>
					</div>
				</div>

				{error && (
					<div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
						<AlertTriangle className="h-4 w-4 mt-0.5" />
						{error}
					</div>
				)}

				<div className="flex flex-col gap-3 md:flex-row md:items-center">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Filter by model, port, type, payload..."
							value={search}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<Select
							onValueChange={(value) =>
								setEventTypeFilter(value as EventTypeFilter)
							}
							value={eventTypeFilter}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Event type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="message">Messages</SelectItem>
								<SelectItem value="transition">Transitions</SelectItem>
								<SelectItem value="lifecycle">Lifecycle</SelectItem>
								<SelectItem value="payload">Payload</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
					<Card className="border-border/70">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base flex items-center gap-2">
										<ArrowRightLeft className="h-4 w-4 text-primary" />
										Transit flows
									</CardTitle>
									<CardDescription>
										Routed messages: source model/port to target model/port
									</CardDescription>
								</div>
								<Badge variant="outline">
									{filteredTransitMessages.length}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between rounded-md border px-3 py-2">
								<div className="text-sm text-muted-foreground">
									Show only confirmed transitions
								</div>
								<Switch
									checked={showOnlyMatchedTransit}
									onCheckedChange={setShowOnlyMatchedTransit}
								/>
							</div>

							<ScrollArea className="h-[420px] rounded-md border">
								{filteredTransitMessages.length === 0 ? (
									<div className="p-4 text-sm text-muted-foreground text-center">
										No transits visible with current filters.
									</div>
								) : (
									<div className="divide-y">
										{[...filteredTransitMessages].reverse().map((message) => (
											<div className="px-3 py-2 space-y-2" key={message.id}>
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-2 text-xs text-muted-foreground">
														<Clock3 className="h-3.5 w-3.5" />
														{message.simulationTime === null
															? "t=?"
															: `t=${message.simulationTime}`}
													</div>
													<Badge
														className={cn(
															message.matched
																? "border-green-200 text-green-700"
																: "border-amber-200 text-amber-700",
														)}
														variant="outline"
													>
														{message.matched ? "transition seen" : "route only"}
													</Badge>
												</div>
												<div className="font-mono text-xs flex items-center gap-2 break-all">
													<span className="rounded bg-muted px-1.5 py-0.5">
														{formatModelIdentity(message.fromModel)}:
														{message.fromPort ?? "?"}
													</span>
													<ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
													<span className="rounded bg-muted px-1.5 py-0.5">
														{formatModelIdentity(message.toModel)}:
														{message.toPort}
													</span>
												</div>
												<div className="text-xs text-muted-foreground font-mono break-all">
													{formatValueCompact(message.value)}
												</div>
											</div>
										))}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>

					<Card className="border-border/70">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base flex items-center gap-2">
										<ListTree className="h-4 w-4 text-primary" />
										Raw DEVS timeline
									</CardTitle>
									<CardDescription>
										Full coordinator/runner event stream
									</CardDescription>
								</div>
								<Badge variant="outline">{filteredEvents.length}</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between rounded-md border px-3 py-2">
								<div className="text-sm text-muted-foreground">
									Only events with port messages
								</div>
								<Switch
									checked={onlyEventsWithPayload}
									onCheckedChange={setOnlyEventsWithPayload}
								/>
							</div>

							<ScrollArea className="h-[420px] rounded-md border">
								{filteredEvents.length === 0 ? (
									<div className="p-4 text-center text-sm text-muted-foreground">
										No events visible with current filters.
									</div>
								) : (
									<div className="divide-y">
										{[...filteredEvents].reverse().map((event, index) => {
											const EventIcon = getEventIcon(event.message.messageType);
											const eventTime = getEventTime(event);
											const inputValues = extractPortValues(event, "inputs");
											const outputValues = extractPortValues(event, "outputs");
											const eventID = event.id || `event-${index}`;

											return (
												<div className="px-3 py-2 space-y-2" key={eventID}>
													<div className="flex items-center justify-between gap-2">
														<div className="flex items-center gap-2 min-w-0">
															<EventIcon className="h-4 w-4 text-muted-foreground shrink-0" />
															<Badge
																className={cn(
																	"text-[10px]",
																	getEventBadgeClass(event.message.messageType),
																)}
																variant="outline"
															>
																{event.message.messageType}
															</Badge>
															<span className="text-xs text-muted-foreground">
																{eventTime === null ? "t=?" : `t=${eventTime}`}
															</span>
														</div>
														<span className="text-[10px] text-muted-foreground">
															{event.createdAt
																? new Date(event.createdAt).toLocaleTimeString()
																: ""}
														</span>
													</div>

													<div className="flex items-center gap-2 text-xs font-mono break-all">
														<span className="rounded bg-muted px-1.5 py-0.5 flex flex-col ">
															<div className="font-bold text-sm">
																{formatModelIdentity(
																	event.message.senderId ?? "Coordinator",
																)}
															</div>
														</span>
														<ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
														<span className="rounded bg-muted px-1.5 py-0.5 flex flex-col ">
															<div className="font-bold text-sm">
																{formatModelIdentity(
																	event.message.receiverId ?? "broadcast",
																)}
															</div>
														</span>
													</div>

													{(inputValues.length > 0 ||
														outputValues.length > 0) && (
														<div className="space-y-1">
															{outputValues.map((item) => (
																<div
																	className="text-xs font-mono text-muted-foreground"
																	key={`${eventID}-out-${item.portIdentifier}`}
																>
																	<Send className="inline h-3.5 w-3.5 mr-1" />
																	out.{item.portIdentifier} ={" "}
																	{formatValueCompact(item.value)}
																</div>
															))}
															{inputValues.map((item) => (
																<div
																	className="text-xs font-mono text-muted-foreground"
																	key={`${eventID}-in-${item.portIdentifier}`}
																>
																	<Activity className="inline h-3.5 w-3.5 mr-1" />
																	in.{item.portIdentifier} ={" "}
																	{formatValueCompact(item.value)}
																</div>
															))}
														</div>
													)}

													<details className="rounded-md border bg-muted/20 px-2 py-1.5">
														<summary className="cursor-pointer text-xs text-muted-foreground">
															Show raw message
														</summary>
														<Separator className="my-2" />
														<pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground font-mono">
															{formatValuePretty(event.message)}
														</pre>
													</details>
												</div>
											);
										})}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</CardContent>
		</Card>
	);
}

export default SimulationPanel;
