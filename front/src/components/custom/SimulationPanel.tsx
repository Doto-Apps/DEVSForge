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
import { useStartSimulation } from "@/hooks/useSimulation";
import type { components } from "@/api/v1";
import type { SimulationStatus } from "@/types";
import { Loader2, Play, Square, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

type SimulationEventResponse = components["schemas"]["response.SimulationEventResponse"];

type SimulationPanelProps = {
	modelId: string;
	modelName?: string;
};

const statusColors: Record<SimulationStatus, string> = {
	pending: "bg-yellow-500",
	running: "bg-blue-500",
	completed: "bg-green-500",
	failed: "bg-red-500",
};

const statusLabels: Record<SimulationStatus, string> = {
	pending: "En attente",
	running: "En cours",
	completed: "Terminée",
	failed: "Échouée",
};

export function SimulationPanel({ modelId, modelName }: SimulationPanelProps) {
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

	const handleStart = async () => {
		const maxTimeValue = Number.parseFloat(maxTime) || 0;
		await startSimulation(modelId, maxTimeValue);
	};

	const handleStop = () => {
		stopPolling();
	};

	const handleClear = () => {
		clearEvents();
	};

	// Group events by devsType for display
	const eventSummary = useMemo(() => {
		const messages = events.filter((e) => e.devsType?.includes("Message"));
		const transitions = events.filter((e) => e.devsType?.includes("Transition"));
		const others = events.filter(
			(e) => !e.devsType?.includes("Message") && !e.devsType?.includes("Transition")
		);

		return {
			messages: messages.length,
			transitions: transitions.length,
			others: others.length,
		};
	}, [events]);

	return (
		<Card className="w-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							Simulation
							{isPolling && (
								<RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
							)}
						</CardTitle>
						<CardDescription>
							{modelName || `Model: ${modelId}`}
						</CardDescription>
					</div>
					{simulation?.status && (
						<Badge
							className={statusColors[simulation.status]}
							variant="secondary"
						>
							{statusLabels[simulation.status]}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Max Time Input */}
				<div className="flex items-center gap-2">
					<Label htmlFor="maxTime" className="whitespace-nowrap text-sm">
						Temps max (simulé)
					</Label>
					<Input
						id="maxTime"
						type="text"
						inputMode="numeric"
						pattern="[0-9]*\.?[0-9]*"
						value={maxTime}
						onChange={(e) => setMaxTime(e.target.value)}
						disabled={isLoading || simulation?.status === "running"}
						className="w-24"
						placeholder="0 = ∞"
					/>
					<span className="text-xs text-muted-foreground">(0 = illimité)</span>
				</div>

				{/* Controls */}
				<div className="flex gap-2">
					<Button
						onClick={handleStart}
						disabled={isLoading || simulation?.status === "running"}
						className="flex-1"
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Démarrage...
							</>
						) : (
							<>
								<Play className="mr-2 h-4 w-4" />
								Lancer
							</>
						)}
					</Button>
					<Button
						variant="outline"
						onClick={handleStop}
						disabled={!isPolling}
					>
						<Square className="mr-2 h-4 w-4" />
						Arrêter
					</Button>
					<Button variant="ghost" onClick={handleClear} disabled={events.length === 0}>
						Effacer
					</Button>
				</div>

				{/* Error display */}
				{error && (
					<div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
						{error}
					</div>
				)}

				{/* Event summary */}
				{events.length > 0 && (
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md bg-muted p-2">
							<div className="text-2xl font-bold">{eventSummary.messages}</div>
							<div className="text-xs text-muted-foreground">Messages</div>
						</div>
						<div className="rounded-md bg-muted p-2">
							<div className="text-2xl font-bold">{eventSummary.transitions}</div>
							<div className="text-xs text-muted-foreground">Transitions</div>
						</div>
						<div className="rounded-md bg-muted p-2">
							<div className="text-2xl font-bold">{eventSummary.others}</div>
							<div className="text-xs text-muted-foreground">Autres</div>
						</div>
					</div>
				)}

				{/* Event log */}
				<div className="max-h-64 overflow-y-auto rounded-md border">
					{events.length === 0 ? (
						<div className="p-4 text-center text-sm text-muted-foreground">
							Aucun événement. Lancez une simulation.
						</div>
					) : (
						<div className="divide-y">
							{[...events].reverse().map((event, index) => (
								<SimulationEventItem key={event.id || `event-${index}`} event={event} />
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function SimulationEventItem({
	event,
}: { event: SimulationEventResponse }) {
	const getEventIcon = (devsType?: string) => {
		if (!devsType) return "📝";
		
		if (devsType.includes("InitSim")) return "🏁";
		if (devsType.includes("NextTime")) return "⏱️";
		if (devsType.includes("SendOutput")) return "📤";
		if (devsType.includes("ModelOutputMessage")) return "📨";
		if (devsType.includes("ExecuteTransition")) return "⚡";
		if (devsType.includes("TransitionDone")) return "✔️";
		if (devsType.includes("SimulationDone")) return "🏆";
		return "📩";
	};

	const getEventDescription = (event: SimulationEventResponse) => {
		const shortType = event.devsType?.replace("devs.msg.", "") || "Unknown";
		const time = event.simulationTime !== null && event.simulationTime !== undefined 
			? `t=${event.simulationTime}` 
			: "";
		const direction = event.sender
			? `← ${event.sender.slice(0, 8)}`
			: event.target
				? `→ ${event.target.slice(0, 8)}`
				: "";
		return `${shortType} ${direction} ${time}`.trim();
	};

	return (
		<div className="flex items-center gap-2 px-3 py-2 text-sm">
			<span>{getEventIcon(event.devsType)}</span>
			<span className="flex-1 font-mono text-xs">{getEventDescription(event)}</span>
			<span className="text-xs text-muted-foreground">
				{event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ""}
			</span>
		</div>
	);
}

export default SimulationPanel;
