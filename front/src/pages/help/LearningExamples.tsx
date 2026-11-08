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
	style: { height: 160, width: 200 },
};
const base: Model = {
	code: "",
	components: [],
	connections: [],
	description: "",
	id: "switch",
	integrationId: "xdevs-python",
	integrationVersion: "1.0.0",
	language: "python",
	metadata,
	name: "Switch",
	ports: [],
	type: "atomic",
	userId: "tutorial",
};
export const tutorialModels: Model[] = [
	{
		...base,
		components: [
			{
				instanceId: "switch-1",
				instanceMetadata: { ...metadata, position: { x: 45, y: 85 } },
				modelId: "switch",
			},
			{
				instanceId: "light-1",
				instanceMetadata: { ...metadata, position: { x: 390, y: 85 } },
				modelId: "light",
			},
		],
		connections: [
			{
				from: { instanceId: "switch-1", port: "state" },
				to: { instanceId: "light-1", port: "state" },
			},
		],
		id: "room",
		integrationId: undefined,
		integrationVersion: undefined,
		language: undefined,
		metadata: { ...metadata, style: { height: 300, width: 640 } },
		name: "Room",
		type: "coupled",
	},
	{ ...base, ports: [{ id: "state-out", name: "state", type: "out" }] },
	{
		...base,
		id: "light",
		integrationId: "xdevs-java",
		language: "java",
		name: "Light",
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
			description: "Time between two internal events.",
			name: "period",
			type: "float",
			value: 1,
		},
	]);
	const graph = useMemo(
		() =>
			modelToReactflow([
				{
					...base,
					metadata: { ...metadata, parameters },
					ports: ports.map((port) => ({ ...port, type: "out" as const })),
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
						defaultPrefix="out"
						disabled={false}
						label="Output ports"
						onChange={setPorts}
						ports={ports}
					/>
					<ModelParameterEditor
						disabled={false}
						onParametersChange={setParameters}
						parameters={parameters}
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
						aria-label="Reset event walkthrough"
						onClick={() => setStep(0)}
						size="sm"
						variant="ghost"
					>
						<RotateCcw size={14} />
					</Button>
					<Button
						onClick={() => setStep((step + 1) % descriptions.length)}
						size="sm"
						variant="secondary"
					>
						<StepForward size={14} />
						Next event
					</Button>
				</div>
			</div>
			<ol
				aria-label="Event phases"
				className="grid grid-cols-5 gap-1 px-4 pt-5"
			>
				{descriptions.map(([title], index) => (
					<li key={title}>
						<button
							aria-current={index === step ? "step" : undefined}
							className={`w-full border-t-2 pt-2 text-left text-[10px] sm:text-xs ${index === step ? "border-primary font-semibold" : "border-border text-muted-foreground"}`}
							onClick={() => setStep(index)}
							type="button"
						>
							{index + 1}
							<span className="mt-1 block truncate">{title}</span>
						</button>
					</li>
				))}
			</ol>
			<div aria-live="polite" className="min-h-28 px-4 py-5">
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
					className="h-7"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(code);
							setStatus("Copied");
						} catch {
							setStatus("Select the code to copy it.");
						}
					}}
					size="sm"
					variant="ghost"
				>
					{status === "Copied" ? <Check size={13} /> : <Copy size={13} />}Copy
				</Button>
			</div>
			<pre className="overflow-x-auto p-4 text-xs leading-6">
				<code>{code}</code>
			</pre>
			{status && (
				<p className="px-4 pb-2 text-xs text-muted-foreground" role="status">
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
				aria-label="Enlarge simulation panel screenshot"
				className="block overflow-hidden rounded-md border"
				href="/guide/simulation-light.png"
				rel="noreferrer"
				target="_blank"
			>
				<img
					alt="Simulation panel showing Max simulation time, Start, Export JSON, runtime parameter overrides and event filters."
					className="w-full dark:hidden"
					height="800"
					loading="lazy"
					src="/guide/simulation-light.png"
					width="1100"
				/>
				<img
					alt="Simulation panel showing Max simulation time, Start, Export JSON, runtime parameter overrides and event filters."
					className="hidden w-full dark:block"
					height="800"
					loading="lazy"
					src="/guide/simulation-dark.png"
					width="1100"
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
					aria-label="Browser calls backend; backend stores models in PostgreSQL and starts the coordinator. Coordinator and runner communicate through Kafka. Runner invokes Python, Go and Java wrappers through gRPC."
					className="min-w-[600px] w-full text-foreground"
					role="img"
					viewBox="0 0 740 385"
				>
					<defs>
						<marker
							id={marker}
							markerHeight="5"
							markerWidth="5"
							orient="auto-start-reverse"
							refX="9"
							refY="5"
							viewBox="0 0 10 10"
						>
							<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
						</marker>
					</defs>
					<g
						fill="none"
						markerEnd={`url(#${marker})`}
						stroke="currentColor"
						strokeOpacity="0.4"
						strokeWidth="1.5"
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
						fontFamily="monospace"
						fontSize="10"
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
								fill="hsl(var(--background))"
								height="66"
								rx="4"
								stroke="currentColor"
								strokeOpacity="0.3"
								width="200"
								x={x}
								y={y}
							/>
							<text
								fill="currentColor"
								fontSize="14"
								fontWeight="500"
								x={x + 14}
								y={y + 27}
							>
								{title}
							</text>
							<text
								fill="currentColor"
								fillOpacity="0.6"
								fontSize="10"
								x={x + 14}
								y={y + 46}
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
