import { ArrowRight, Check, Copy, RotateCcw, StepForward } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { components } from "@/api/v1";
import { ModelParameterEditor } from "@/components/custom/ModelParameterEditor";
import { ModelView } from "@/components/custom/ModelView";
import { PortEditor } from "@/components/custom/reactFlow/PortEditor";
import { Button } from "@/components/ui/button";
import { modelToReactflow } from "@/lib/modelToReactflow";

type Model = components["schemas"]["response.ModelResponse"];
const metadata: Model["metadata"] = {
	keyword: [],
	modelRole: "",
	position: { x: 0, y: 0 },
	style: { width: 200, height: 160 },
};
const base: Model = {
	id: "switch",
	name: "Switch",
	type: "atomic",
	userId: "tutorial",
	code: "",
	description: "",
	components: [],
	connections: [],
	ports: [],
	metadata,
	language: "python",
	integrationId: "xdevs-python",
	integrationVersion: "1.0.0",
};
export const tutorialModels: Model[] = [
	{
		...base,
		id: "room",
		name: "Room",
		type: "coupled",
		language: undefined,
		integrationId: undefined,
		integrationVersion: undefined,
		metadata: { ...metadata, style: { width: 640, height: 300 } },
		components: [
			{
				instanceId: "switch-1",
				modelId: "switch",
				instanceMetadata: { ...metadata, position: { x: 45, y: 85 } },
			},
			{
				instanceId: "light-1",
				modelId: "light",
				instanceMetadata: { ...metadata, position: { x: 390, y: 85 } },
			},
		],
		connections: [
			{
				from: { instanceId: "switch-1", port: "state" },
				to: { instanceId: "light-1", port: "state" },
			},
		],
	},
	{ ...base, ports: [{ id: "state-out", name: "state", type: "out" }] },
	{
		...base,
		id: "light",
		name: "Light",
		language: "java",
		integrationId: "xdevs-java",
		ports: [{ id: "state-in", name: "state", type: "in" }],
	},
];

export function ExampleDiagram() {
	const graph = useMemo(() => modelToReactflow(tutorialModels), []);
	return (
		<figure className="my-5 overflow-hidden rounded-md border">
			<div className="h-64 sm:h-80">
				<ModelView models={graph} />
			</div>
			<figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
				Example · Room contains Switch and Light. The connection belongs to
				Room. Rendered by the same model viewer as your library.
			</figcaption>
		</figure>
	);
}

export function InterfaceLab() {
	const [ports, setPorts] = useState([{ id: "state-out", name: "state" }]);
	const [parameters, setParameters] = useState<
		NonNullable<Model["metadata"]["parameters"]>
	>([
		{
			name: "period",
			type: "float",
			value: 1,
			description: "Time between two internal events.",
		},
	]);
	const graph = useMemo(
		() =>
			modelToReactflow([
				{
					...base,
					ports: ports.map((port) => ({ ...port, type: "out" as const })),
					metadata: { ...metadata, parameters },
				},
			]),
		[ports, parameters],
	);
	return (
		<div className="my-5 overflow-hidden rounded-lg border">
			<div className="flex items-center justify-between bg-muted/40 px-4 py-2 text-xs">
				<span>Try the model properties</span>
				<span className="text-muted-foreground">
					Local practice · not saved
				</span>
			</div>
			<div className="grid lg:grid-cols-2">
				<div className="space-y-6 p-5">
					<PortEditor
						label="Output ports"
						ports={ports}
						onChange={setPorts}
						disabled={false}
						defaultPrefix="out"
					/>
					<ModelParameterEditor
						parameters={parameters}
						onParametersChange={setParameters}
						disabled={false}
					/>
				</div>
				<div className="min-h-64 border-t lg:border-l lg:border-t-0">
					<ModelView models={graph} />
				</div>
			</div>
			<p className="border-t px-4 py-3 text-xs text-muted-foreground">
				Add or rename a port: its handle appears in the preview. These are the
				editor’s actual port and parameter controls. Parameter values only
				affect behavior when the model code reads them.
			</p>
		</div>
	);
}

export function EventWalkthrough() {
	const [step, setStep] = useState(0);
	const descriptions = [
		[
			"Initialize",
			"Switch holds ON for one time unit. Its next internal event is t = 1.",
		],
		[
			"Request output",
			"At t = 1 the coordinator asks the imminent Switch for its output, before changing its state.",
		],
		[
			"Route",
			'Switch emits {state: "ON"}. Room routes the value from Switch.state to Light.state.',
		],
		[
			"Transition",
			"Switch changes to OFF. Light receives the input in its external transition. Both report their next event times.",
		],
		[
			"Advance",
			"At t = 2 Switch emits OFF, then returns to ON. The cycle continues until the horizon or passivation.",
		],
	];
	return (
		<div className="my-5 rounded-lg border">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				<span className="text-xs font-medium">One event, step by step</span>
				<div className="flex gap-1">
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setStep(0)}
						aria-label="Reset event walkthrough"
					>
						<RotateCcw size={14} />
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setStep((step + 1) % descriptions.length)}
					>
						<StepForward size={14} />
						Next event
					</Button>
				</div>
			</div>
			<ol
				className="grid grid-cols-5 gap-1 px-4 pt-5"
				aria-label="Event phases"
			>
				{descriptions.map(([title], index) => (
					<li key={title}>
						<button
							type="button"
							className={`w-full border-t-2 pt-2 text-left text-[10px] sm:text-xs ${index === step ? "border-primary font-semibold" : "border-border text-muted-foreground"}`}
							onClick={() => setStep(index)}
							aria-current={index === step ? "step" : undefined}
						>
							{index + 1}
							<span className="mt-1 block truncate">{title}</span>
						</button>
					</li>
				))}
			</ol>
			<div className="min-h-28 px-4 py-5" aria-live="polite">
				<h3 className="font-medium">{descriptions[step][0]}</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{descriptions[step][1]}
				</p>
			</div>
			<div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
				Illustrated trace, not a simulation run. No model is executed.
			</div>
		</div>
	);
}

export function CopyCode({
	code,
	label = "Example",
}: {
	code: string;
	label?: string;
}) {
	const [status, setStatus] = useState("");
	return (
		<div className="my-4 overflow-hidden rounded-md border bg-muted/20">
			<div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs">
				<span className="font-mono text-muted-foreground">{label}</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(code);
							setStatus("Copied");
						} catch {
							setStatus("Select the code to copy it.");
						}
					}}
				>
					{status === "Copied" ? <Check size={13} /> : <Copy size={13} />}Copy
				</Button>
			</div>
			<pre className="overflow-x-auto p-4 text-xs leading-6">
				<code>{code}</code>
			</pre>
			{status && (
				<p role="status" className="px-4 pb-2 text-xs text-muted-foreground">
					{status}
				</p>
			)}
		</div>
	);
}

export function SimulationFigure() {
	return (
		<figure className="my-5">
			<a
				href="/guide/simulation-light.png"
				target="_blank"
				rel="noreferrer"
				className="block overflow-hidden rounded-md border"
				aria-label="Enlarge simulation panel screenshot"
			>
				<img
					className="w-full dark:hidden"
					src="/guide/simulation-light.png"
					alt="Simulation panel showing Max simulation time, Start, Export JSON, runtime parameter overrides and event filters."
					loading="lazy"
					width="1100"
					height="800"
				/>
				<img
					className="hidden w-full dark:block"
					src="/guide/simulation-dark.png"
					alt="Simulation panel showing Max simulation time, Start, Export JSON, runtime parameter overrides and event filters."
					loading="lazy"
					width="1100"
					height="800"
				/>
			</a>
			<figcaption className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
				Actual application panel, populated with demonstration data. Click to
				enlarge.
				<ArrowRight size={12} />
			</figcaption>
		</figure>
	);
}

export function ExecutionMap() {
	const marker = useId();
	const boxes = [
		[20, 20, "Browser", "Edit · compose · inspect"],
		[270, 20, "Backend", "Ownership · models · runs"],
		[520, 20, "PostgreSQL", "Definitions · event history"],
		[20, 150, "Coordinator", "Logical time · routing"],
		[270, 150, "Kafka", "Commands & reports"],
		[520, 150, "Runner", "Prepare · launch · bridge"],
		[20, 300, "Python wrapper", "modeling → user model"],
		[270, 300, "Go wrapper", "modeling → user model"],
		[520, 300, "Java wrapper", "modeling → user model"],
	] as const;
	return (
		<figure className="my-6 overflow-hidden rounded-md border">
			<div className="overflow-x-auto bg-muted/10 p-3">
				<svg
					className="min-w-[600px] w-full text-foreground"
					viewBox="0 0 740 385"
					role="img"
					aria-label="Browser calls backend; backend stores models in PostgreSQL and starts the coordinator. Coordinator and runner communicate through Kafka. Runner invokes Python, Go and Java wrappers through gRPC."
				>
					<defs>
						<marker
							id={marker}
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="5"
							markerHeight="5"
							orient="auto-start-reverse"
						>
							<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
						</marker>
					</defs>
					<g
						fill="none"
						stroke="currentColor"
						strokeOpacity="0.4"
						strokeWidth="1.5"
						markerEnd={`url(#${marker})`}
					>
						<path d="M220 53 H270" />
						<path d="M470 53 H520" />
						<path d="M370 86 V118 H120 V150" />
						<path d="M220 183 H270" markerStart={`url(#${marker})`} />
						<path d="M470 183 H520" markerStart={`url(#${marker})`} />
						<path d="M620 216 V265 H120 V300" />
						<path d="M620 265 H370 V300" />
						<path d="M620 265 V300" />
					</g>
					<g
						fill="currentColor"
						fillOpacity="0.6"
						fontSize="10"
						fontFamily="monospace"
					>
						<text x="230" y="42">
							HTTP
						</text>
						<text x="482" y="42">
							SQL
						</text>
						<text x="180" y="111">
							start simulation
						</text>
						<text x="290" y="255">
							shared gRPC contract
						</text>
					</g>
					{boxes.map(([x, y, title, detail]) => (
						<g key={title}>
							<rect
								x={x}
								y={y}
								width="200"
								height="66"
								rx="4"
								fill="hsl(var(--background))"
								stroke="currentColor"
								strokeOpacity="0.3"
							/>
							<text
								x={x + 14}
								y={y + 27}
								fontSize="14"
								fill="currentColor"
								fontWeight="500"
							>
								{title}
							</text>
							<text
								x={x + 14}
								y={y + 46}
								fontSize="10"
								fill="currentColor"
								fillOpacity="0.6"
							>
								{detail}
							</text>
						</g>
					))}
				</svg>
			</div>
			<figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
				Execution path · wrappers adapt each language to a common protocol.
				Logical scheduling stays in the coordinator.
			</figcaption>
		</figure>
	);
}
