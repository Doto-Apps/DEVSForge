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
import { cn } from "@/lib/utils";
import type { SimulationStatus } from "@/types";

type SimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];

type ParsedPortValue = {
	portIdentifier: string;
	portType: string | null;
	value: unknown;
	valueKey: string;
};

type OutputCandidate = {
	id: string;
	simulationTime: number | null;
	createdAt: string | null;
	model: string | null;
	port: string;
	value: unknown;
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
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
	const rec = asRecord(parsed);
	if (!rec) return parsed;

	const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b));
	const normalized: Record<string, unknown> = {};
	for (const key of keys) {
		normalized[key] = normalizeForKey(rec[key]);
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

const getEventTime = (event: SimulationEventResponse): number | null => {
	if (typeof event.simulationTime === "number") return event.simulationTime;
	const payload = asRecord(event.payload);
	const time = asRecord(payload?.time);
	const maybeTime = time?.t;
	return typeof maybeTime === "number" ? maybeTime : null;
};

const getEventCategory = (event: SimulationEventResponse): EventTypeFilter => {
	if (event.msgType?.includes("Message")) return "message";
	if (event.msgType?.includes("Transition")) return "transition";
	if (
		event.msgType?.includes("InitSim") ||
		event.msgType?.includes("NextTime") ||
		event.msgType?.includes("SimulationDone")
	) {
		return "lifecycle";
	}
	return "payload";
};

const extractPortValues = (
	event: SimulationEventResponse,
	path: "modelOutput" | "modelInputsOption",
): ParsedPortValue[] => {
	const payload = asRecord(event.payload);
	const branch = asRecord(payload?.[path]);
	const rawList = branch?.portValueList;
	if (!Array.isArray(rawList)) return [];

	return rawList
		.map((item) => {
			const rec = asRecord(item);
			if (!rec) return null;
			const portIdentifier = asString(rec.portIdentifier);
			if (!portIdentifier) return null;
			const value = parseMaybeJSON(rec.value);
			return {
				portIdentifier,
				portType: asString(rec.portType),
				value,
				valueKey: stableValueKey(value),
			} as ParsedPortValue;
		})
		.filter((item): item is ParsedPortValue => item !== null);
};

const getEventIcon = (msgType?: string) => {
	if (msgType?.includes("ModelOutputMessage")) return Send;
	if (msgType?.includes("ErrorReport")) return AlertTriangle;
	if (msgType?.includes("ExecuteTransition")) return ArrowRightLeft;
	if (msgType?.includes("TransitionDone")) return Activity;
	if (msgType?.includes("SimulationDone")) return Square;
	if (msgType?.includes("InitSim")) return Play;
	if (msgType?.includes("NextTime")) return Clock3;
	return ListTree;
};

const getEventBadgeClass = (msgType?: string) => {
	if (msgType?.includes("Message"))
		return "bg-blue-500/10 text-blue-700 border-blue-200";
	if (msgType?.includes("ErrorReport")) {
		return "bg-red-500/10 text-red-700 border-red-200";
	}
	if (msgType?.includes("Transition")) {
		return "bg-amber-500/10 text-amber-700 border-amber-200";
	}
	if (msgType?.includes("SimulationTerminate")) {
		return "bg-green-500/10 text-green-700 border-green-200";
	}
	return "bg-muted text-muted-foreground";
};

export function SimulationPanel({
	modelId,
	modelName,
	modelNameById = {},
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
		const name = modelNameById[id];
		if (!name) return id;
		return `${name} (${id})`;
	};

	const transitMessages = useMemo(() => {
		const outputsByTime = new Map<string, OutputCandidate[]>();
		const transits: TransitMessage[] = [];

		const addOutputCandidate = (candidate: OutputCandidate) => {
			const key = String(candidate.simulationTime ?? "null");
			const list = outputsByTime.get(key) ?? [];
			list.push(candidate);
			outputsByTime.set(key, list);
		};

		const findCandidate = (
			simulationTime: number | null,
			valueKey: string,
		): OutputCandidate | null => {
			const key = String(simulationTime ?? "null");
			const candidates = outputsByTime.get(key) ?? [];
			const exact = candidates.find(
				(candidate) => candidate.valueKey === valueKey,
			);
			if (exact) return exact;

			if (candidates.length === 1) return candidates[0];
			return null;
		};

		events.forEach((event, index) => {
			const simulationTime = getEventTime(event);
			const eventID = event.id ?? `event-${index}`;

			if (event.msgType === "ModelOutputMessage") {
				const outputs = extractPortValues(event, "modelOutput");
				outputs.forEach((output, outputIndex) => {
					addOutputCandidate({
						createdAt: event.createdAt ?? null,
						id: `${eventID}-out-${outputIndex}`,
						model: event.sender ?? null,
						port: output.portIdentifier,
						simulationTime,
						value: output.value,
						valueKey: output.valueKey,
					});
				});
				return;
			}

			if (event.msgType !== "ExecuteTransition") return;

			const inputs = extractPortValues(event, "modelInputsOption");
			if (inputs.length === 0) return;

			inputs.forEach((input, inputIndex) => {
				const matchedCandidate = findCandidate(simulationTime, input.valueKey);

				transits.push({
					createdAt: event.createdAt ?? null,
					fromModel: matchedCandidate?.model ?? event.sender ?? null,
					fromPort: matchedCandidate?.port ?? null,
					id: `${eventID}-in-${inputIndex}`,
					matched: Boolean(matchedCandidate),
					simulationTime,
					sourceEventID: matchedCandidate?.id ?? null,
					targetEventID: eventID,
					toModel: event.target ?? null,
					toPort: input.portIdentifier,
					value: input.value,
					valueKey: input.valueKey,
				});
			});
		});

		return transits;
	}, [events]);

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
				const inputValues = extractPortValues(event, "modelInputsOption");
				const outputValues = extractPortValues(event, "modelOutput");
				if (inputValues.length === 0 && outputValues.length === 0) return false;
			}

			if (!normalizedSearch) return true;

			const haystack = [
				event.msgType,
				event.sender ?? "",
				event.target ?? "",
				formatValueCompact(event.payload, 300),
			]
				.join(" ")
				.toLowerCase();

			return haystack.includes(normalizedSearch);
		});
	}, [eventTypeFilter, events, onlyEventsWithPayload, search]);

	const eventSummary = useMemo(() => {
		const messages = events.filter((e) => e.msgType?.includes("Message"));
		const transitions = events.filter((e) => e.msgType?.includes("Transition"));
		const others = events.filter(
			(e) =>
				!e.msgType?.includes("Message") && !e.msgType?.includes("Transition"),
		);

		return {
			messages: messages.length,
			others: others.length,
			transitions: transitions.length,
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

							<div className="max-h-72 overflow-auto space-y-3 pr-1">
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

											<div className="grid gap-3 md:grid-cols-2">
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
																		JSON.stringify(currentValue ?? {}, null, 2)
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
									Show only matched transits
								</div>
								<Switch
									checked={showOnlyMatchedTransit}
									onCheckedChange={setShowOnlyMatchedTransit}
								/>
							</div>

							<div className="max-h-[420px] overflow-auto rounded-md border">
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
														{message.matched ? "match exact" : "inference"}
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
							</div>
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

							<div className="max-h-[420px] overflow-auto rounded-md border">
								{filteredEvents.length === 0 ? (
									<div className="p-4 text-center text-sm text-muted-foreground">
										No events visible with current filters.
									</div>
								) : (
									<div className="divide-y">
										{[...filteredEvents].reverse().map((event, index) => {
											const EventIcon = getEventIcon(event.msgType);
											const inputValues = extractPortValues(
												event,
												"modelInputsOption",
											);
											const outputValues = extractPortValues(
												event,
												"modelOutput",
											);
											const eventID = event.id || `event-${index}`;

											return (
												<div className="px-3 py-2 space-y-2" key={eventID}>
													<div className="flex items-center justify-between gap-2">
														<div className="flex items-center gap-2 min-w-0">
															<EventIcon className="h-4 w-4 text-muted-foreground shrink-0" />
															<Badge
																className={cn(
																	"text-[10px]",
																	getEventBadgeClass(event.msgType),
																)}
																variant="outline"
															>
																{event.msgType}
															</Badge>
															<span className="text-xs text-muted-foreground">
																{getEventTime(event) === null
																	? "t=?"
																	: `t=${getEventTime(event)}`}
															</span>
														</div>
														<span className="text-[10px] text-muted-foreground">
															{event.createdAt
																? new Date(event.createdAt).toLocaleTimeString()
																: ""}
														</span>
													</div>

													<div className="flex items-center gap-2 text-xs font-mono break-all">
														<span className="rounded bg-muted px-1.5 py-0.5">
															{event.sender ?? "coordinator"}
														</span>
														<ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
														<span className="rounded bg-muted px-1.5 py-0.5">
															{event.target ?? "broadcast"}
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
															Show raw payload
														</summary>
														<Separator className="my-2" />
														<pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground font-mono">
															{formatValuePretty(event.payload)}
														</pre>
													</details>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</CardContent>
		</Card>
	);
}

export default SimulationPanel;
