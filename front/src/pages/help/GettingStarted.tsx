import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import {
	CopyCode,
	EventWalkthrough,
	ExampleDiagram,
	InterfaceLab,
	SimulationFigure,
} from "./LearningExamples";

const code = `    def initialize(self) -> None:
        self.hold_in("ON", 1.0)

    def delt_int(self) -> None:
        phase = "OFF" if self.phase_is("ON") else "ON"
        self.hold_in(phase, 1.0)

    def lambda_(self) -> None:
        port = self.get_port_by_name("state")
        port.add_value({"state": self.get_phase()})`;
const steps = [
	{
		title: "Make a place for it",
		short: "Library",
		detail: "Create a library and an atomic definition.",
		content: (
			<>
				<p>
					Open{" "}
					<Link className="underline" to="/library/new">
						New library
					</Link>
					, name it <strong>First system</strong>, and create it. In that
					library, choose <strong>New model</strong>.
				</p>
				<div className="my-5 grid gap-0 border-y sm:grid-cols-3">
					{[
						["Name", "Switch"],
						["Type", "Atomic"],
						["Integration", "xDEVS Python"],
					].map(([label, value]) => (
						<div key={label} className="py-4 sm:px-3">
							<p className="text-[10px] uppercase tracking-widest text-muted-foreground">
								{label}
							</p>
							<p className="mt-1 font-medium">{value}</p>
						</div>
					))}
				</div>
				<p>
					Create the model. Its editor opens with a source template. The
					generated class and factory already match the Python wrapper; you will
					fill in its behavior.
				</p>
				<ExampleDiagram />
				<p className="text-xs text-muted-foreground">
					Where we are going: a switch that sends a state to a light. First,
					build Switch alone. Room and Light come later.
				</p>
				<Button asChild variant="outline" className="mt-4">
					<Link to="/library/new">
						Create your library
						<ArrowRight size={14} />
					</Link>
				</Button>
			</>
		),
	},
	{
		title: "Give the model an output",
		short: "Interface",
		detail: "Try the real property controls before editing your model.",
		content: (
			<>
				<p>
					In your Switch model, use the properties panel on the right. Expand
					Information, find Output Ports and click Add to create an{" "}
					<strong>output</strong> port named <code>state</code>. No input port
					is needed for a switch that changes on its own.
				</p>
				<InterfaceLab />
				<p>
					The panel above is a local practice area. Try adding another port or
					changing its name, then do the same in your saved model. Only the port
					called <code>state</code> is needed for this tutorial.
				</p>
				<p>
					The <code>period</code> parameter demonstrates the parameter editor.
					The code in the next step uses a fixed delay of 1. To use the
					parameter instead, read <code>self.parameters</code> as shown in the{" "}
					<Link className="underline" to="/documentation/parameters">
						override guide
					</Link>
					.
				</p>
			</>
		),
	},
	{
		title: "Write one small behavior",
		short: "Behavior",
		detail: "Emit the current state, then alternate ON and OFF.",
		content: (
			<>
				<p>
					Replace these three methods{" "}
					<strong>inside the generated class</strong>. Keep the imports,
					constructor, other methods and <code>NewModel</code> factory. The copy
					button includes class indentation.
				</p>
				<CopyCode code={code} label="Python · methods inside Switch" />
				<div className="space-y-3 border-l-2 pl-4">
					<p>
						<strong>initialize</strong> starts ON and schedules an event one
						logical time unit later.
					</p>
					<p>
						<strong>lambda_</strong> emits the current phase on the named output
						port.
					</p>
					<p>
						<strong>delt_int</strong> flips the phase and schedules the next
						event.
					</p>
				</div>
				<p>
					Save with <strong>⌘S</strong> on macOS or <strong>Ctrl+S</strong> on
					Windows/Linux. Save the output port definition too. A port called{" "}
					<code>State</code> is not the same as <code>state</code>.
				</p>
			</>
		),
	},
	{
		title: "Follow the first event",
		short: "Simulate",
		detail: "Run the saved model, then inspect what happened.",
		content: (
			<>
				<p>
					Open <strong>Simulate</strong> from the model header. Set{" "}
					<strong>Max simulation time</strong> to <strong>5</strong>, then click{" "}
					<strong>Start</strong>. The first preparation can take longer than a
					subsequent run.
				</p>
				<SimulationFigure />
				<ol className="list-decimal space-y-2 pl-5">
					<li>The time field sets the logical horizon, not seconds to wait.</li>
					<li>Runtime overrides are optional and apply to this run only.</li>
					<li>
						Use the event filters to find <code>OutputReport</code> and inspect{" "}
						<code>payload.outputs</code>.
					</li>
				</ol>
				<EventWalkthrough />
				<p>
					For Switch alone, expect ON at t=1, OFF at t=2 and ON at t=3. The
					trace above illustrates the additional routing once Light is
					connected.
				</p>
				<p className="border-l-2 pl-4 text-muted-foreground">
					No outputs? Verify the saved port direction and spelling. In this
					library, <code>get_port_by_name("state")</code> looks up a name;{" "}
					<code>get_ports("out")</code> filters by direction.
				</p>
			</>
		),
	},
	{
		title: "Keep the evidence",
		short: "Export",
		detail: "Download the run and analyze it outside the editor.",
		content: (
			<>
				<p>
					Once events have arrived, click <strong>Export JSON</strong> in the
					simulation panel. Keep the file before clearing the event view. It
					contains the loaded events and run metadata.
				</p>
				<div className="my-6 flex flex-wrap items-center gap-3 font-mono text-xs">
					<span className="border-b-2 border-foreground py-3">
						Simulation panel
					</span>
					<ArrowRight size={15} />
					<span className="border-b-2 border-foreground py-3">Export JSON</span>
					<ArrowRight size={15} />
					<span className="border-b-2 border-foreground py-3">
						Grafana / your scripts
					</span>
				</div>
				<p>
					In Grafana, the <strong>Infinity</strong> data source can read the
					export as inline JSON. Select the <code>events</code> array, then
					inspect fields such as <code>message.messageType</code>,{" "}
					<code>message.eventTime</code> and values inside{" "}
					<code>message.payload.outputs</code>.
				</p>
				<p>
					Begin with a table. Simulation time is a logical numeric value, not a
					real-world timestamp. Compare two exports with different parameters to
					see how the behavior changes.
				</p>
				<Button asChild variant="outline">
					<Link to="/documentation/results">
						Read the Grafana walkthrough
						<ArrowRight size={14} />
					</Link>
				</Button>
				<p className="text-xs text-muted-foreground">
					Grafana is an external tool. This workflow exports and imports data;
					it does not enable an automatic live connection.
				</p>
			</>
		),
	},
	{
		title: "Turn a behavior into a system",
		short: "Compose",
		detail: "Reuse Switch as a component, then go further.",
		content: (
			<>
				<p>
					Create a <strong>coupled</strong> model called Room. Drag Switch from
					the library menu into its canvas. Add a Light definition with an input
					named <code>state</code> and behavior that stores incoming state
					values; the diagram alone does not implement that behavior.
				</p>
				<ExampleDiagram />
				<p>
					Connect Switch’s output to Light’s input. You can add another Switch
					occurrence: it reuses the same definition but has its own runtime
					state. You can also nest Room inside another coupled model.
				</p>
				<div className="mt-5 divide-y">
					{[
						[
							"/documentation/composition",
							"Compose nested systems",
							"Ports, boundaries and valid connections.",
						],
						[
							"/documentation/parameters",
							"Run variations",
							"Definition defaults, instance values and per-run overrides.",
						],
						[
							"/documentation/experimental-frames",
							"Test a requirement",
							"Put stimuli, observations and acceptance around the model.",
						],
						[
							"/documentation/webapps",
							"Build a runnable WebApp",
							"Expose selected parameters and inspect outputs.",
						],
					].map(([to, title, detail]) => (
						<Link
							key={to}
							to={to}
							className="flex items-center justify-between gap-3 py-4"
						>
							<span>
								<strong className="block text-sm font-medium">{title}</strong>
								<span className="text-xs text-muted-foreground">{detail}</span>
							</span>
							<ArrowRight size={14} />
						</Link>
					))}
				</div>
			</>
		),
	},
];
export function GettingStarted() {
	const [params, setParams] = useSearchParams();
	const raw = Number(params.get("step") ?? 1);
	const step =
		Number.isInteger(raw) && raw >= 1 && raw <= steps.length ? raw - 1 : 0;
	const scroller = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset scroll when the route changes, including browser history.
	useEffect(() => {
		scroller.current?.scrollTo({ top: 0 });
	}, [step]);
	const current = steps[step];
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Getting Started" }]}
				showModeToggle
				showNavActions={false}
			/>
			<main ref={scroller} className="flex-1 overflow-y-auto p-4 lg:p-6">
				<header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
					<div>
						<p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
							A guided experiment / xDEVS Python
						</p>
						<h1 className="text-3xl font-semibold tracking-tight">
							A switch. A signal. A system.
						</h1>
						<p className="mt-3 text-sm text-muted-foreground">
							Build your first model and learn to read what it does. No AI
							provider required.
						</p>
					</div>
					<span className="flex items-center gap-2 text-xs text-muted-foreground">
						<Play size={13} />6 hands-on steps
					</span>
				</header>
				<div className="grid items-start gap-7 lg:grid-cols-[180px_minmax(0,1fr)]">
					<nav
						aria-label="Tutorial steps"
						className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-0 lg:block"
					>
						<ol className="flex gap-2 lg:block lg:space-y-1">
							{steps.map((item, index) => (
								<li key={item.short}>
									<button
										type="button"
										aria-current={index === step ? "step" : undefined}
										onClick={() => setParams({ step: String(index + 1) })}
										className={`flex w-full items-center gap-3 whitespace-nowrap rounded px-3 py-3 text-left text-sm ${index === step ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted"}`}
									>
										<span className="flex size-5 shrink-0 items-center justify-center font-mono text-xs">
											{index < step ? (
												<Check size={13} />
											) : (
												String(index + 1).padStart(2, "0")
											)}
										</span>
										{item.short}
									</button>
								</li>
							))}
						</ol>
					</nav>
					<article className="min-w-0 max-w-5xl">
						<div className="mb-6">
							<p className="mb-2 font-mono text-xs text-muted-foreground">
								{String(step + 1).padStart(2, "0")} / 06
							</p>
							<h2 className="text-2xl font-semibold tracking-tight">
								{current.title}
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								{current.detail}
							</p>
						</div>
						<div
							key={step}
							className="space-y-4 text-sm leading-7 [&_code]:text-xs"
						>
							{current.content}
						</div>
						<footer className="mt-8 flex justify-between gap-3 border-t pt-5">
							<Button
								variant="ghost"
								disabled={step === 0}
								onClick={() => setParams({ step: String(step) })}
							>
								<ArrowLeft size={14} />
								Back
							</Button>
							{step < steps.length - 1 ? (
								<Button onClick={() => setParams({ step: String(step + 2) })}>
									Next: {steps[step + 1].short}
									<ArrowRight size={14} />
								</Button>
							) : (
								<Button asChild>
									<Link to="/documentation">
										Explore the documentation
										<ArrowRight size={14} />
									</Link>
								</Button>
							)}
						</footer>
					</article>
				</div>
			</main>
		</div>
	);
}
