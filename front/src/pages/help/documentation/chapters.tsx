import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
	CopyCode,
	EventWalkthrough,
	ExecutionMap,
	ExampleDiagram,
	InterfaceLab,
	SimulationFigure,
} from "../LearningExamples";

export type Chapter = {
	id: string;
	group: string;
	title: string;
	summary: string;
	sections: { id: string; title: string; content: ReactNode }[];
};

function Table({ heads, rows }: { heads: string[]; rows: string[][] }) {
	return (
		<div className="my-5 overflow-x-auto">
			<table className="w-full min-w-96 text-left text-sm">
				<thead>
					<tr>
						{heads.map((head) => (
							<th key={head} className="border-b px-3 py-2 font-medium">
								{head}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row[0]}>
							{row.map((cell, i) => (
								<td
									key={heads[i]}
									className="border-b px-3 py-3 align-top text-muted-foreground"
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
function Flow({ steps }: { steps: [string, string][] }) {
	return (
		<ol className="my-6 grid gap-3 sm:grid-cols-2">
			{steps.map(([title, detail], index) => (
				<li
					key={title}
					className="relative border-l-2 border-foreground/30 bg-muted/20 px-4 py-3"
				>
					<span className="mb-2 block font-mono text-[10px] text-muted-foreground">
						0{index + 1}
					</span>
					<strong className="block text-sm font-medium">{title}</strong>
					<span className="mt-1 block text-xs leading-5 text-muted-foreground">
						{detail}
					</span>
				</li>
			))}
		</ol>
	);
}
function Note({ children }: { children: ReactNode }) {
	return (
		<aside className="my-5 border-l-2 border-primary py-1 pl-4 text-sm text-muted-foreground">
			{children}
		</aside>
	);
}
const docLink = (id: string, text: string) => (
	<Link className="underline underline-offset-4" to={`/documentation/${id}`}>
		{text}
	</Link>
);

export const chapters: Chapter[] = [
	{
		id: "overview",
		group: "Start here",
		title: "A model is only the beginning.",
		summary:
			"Build behaviors, compose systems, run experiments and inspect the messages that connect them.",
		sections: [
			{
				id: "journey",
				title: "From a definition to an experiment",
				content: (
					<>
						<p>
							DEVSForge is a modeling and simulation workspace built around
							discrete events. You write a reusable atomic behavior, connect
							instances in a coupled model, then execute that composition. An
							atomic component can use Python, Go or Java without imposing that
							language on its neighbors.
						</p>
						<ExampleDiagram />
						<p>
							The diagram is also the execution structure: the ports, component
							instances and connections you edit determine how outputs are
							delivered. Libraries organize definitions; they are not execution
							boundaries.
						</p>
						<Flow
							steps={[
								[
									"Define",
									"Code an atomic model and declare its ports and parameters.",
								],
								[
									"Compose",
									"Reuse definitions in nested coupled models. Give each occurrence its own configuration.",
								],
								[
									"Experiment",
									"Choose a time horizon and per-run overrides, or build an experimental frame.",
								],
								[
									"Observe",
									"Inspect protocol events and routed values. Export the run or expose it through a WebApp.",
								],
							]}
						/>
					</>
				),
			},
			{
				id: "choose",
				title: "Find the part you need",
				content: (
					<div className="divide-y">
						{[
							["models", "I want to write a model."],
							["composition", "I want to connect or nest models."],
							[
								"parameters",
								"I want to change one instance without changing the others.",
							],
							["parallel-devs", "I want to understand the simulation clock."],
							["languages", "I want Python, Go and Java in one system."],
							["results", "I want to inspect a run or use Grafana."],
							[
								"experimental-frames",
								"I want to check a model against a requirement.",
							],
							[
								"protocol",
								"I want to understand interoperability and ISO 21175.",
							],
						].map(([id, title]) => (
							<Link
								key={id}
								to={`/documentation/${id}`}
								className="flex justify-between gap-4 py-3 text-sm hover:text-muted-foreground"
							>
								{title}
								<span aria-hidden="true">→</span>
							</Link>
						))}
					</div>
				),
			},
			{
				id: "first",
				title: "Learn by doing",
				content: (
					<>
						<p>
							The{" "}
							{
								<Link
									to="/getting-started"
									className="underline underline-offset-4"
								>
									Getting Started tutorial
								</Link>
							}{" "}
							walks through a switch, its interface, a trace and a composition.
							Its interactive examples stay in your browser. Creating an actual
							model or starting a simulation is a separate, explicit action.
						</p>
						<p>
							You can model manually without configuring an AI provider.
							Assisted generation is an optional way to create and revise a
							starting structure.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "models",
		group: "Modeling",
		title: "Atomic models & libraries",
		summary:
			"What a definition contains, what your code must implement, and how it becomes reusable.",
		sections: [
			{
				id: "definition",
				title: "The definition is the reusable unit",
				content: (
					<>
						<p>
							A library contains named definitions. An atomic definition
							combines source code, an integration and version, a port
							interface, parameters and graphical metadata. A coupled definition
							contains component references and connections instead of atomic
							behavior code.
						</p>
						<p>
							Keep display names meaningful. Runtime identity is based on
							identifiers, not those names. Two definitions may have the same
							name; distinguish them by library and integration. A trailing
							space in a display name is not a new language or a reason to share
							an analysis process with another account.
						</p>
						<Table
							heads={["Part", "Purpose"]}
							rows={[
								[
									"Integration + version",
									"Selects the modeling library, source template and execution preparation.",
								],
								[
									"Ports",
									"Declares input/output names used by both your code and the diagram.",
								],
								[
									"Parameters",
									"Defines typed configuration; behavior reads these values explicitly.",
								],
								[
									"Metadata",
									"Layout, colors, descriptions, roles and keywords help editing and discovery.",
								],
							]}
						/>
					</>
				),
			},
			{
				id: "functions",
				title: "The atomic lifecycle",
				content: (
					<>
						<Table
							heads={["Operation", "Python name", "Responsibility"]}
							rows={[
								[
									"Initialization",
									"initialize",
									"Set initial state and schedule the first internal event.",
								],
								[
									"Output",
									"lambda_",
									"Emit values at an imminent event, before its internal transition.",
								],
								[
									"Internal transition",
									"delt_int",
									"Update state when the scheduled event occurs.",
								],
								[
									"External transition",
									"delt_ext(e)",
									"Consume input and account for elapsed simulation time.",
								],
								[
									"Confluent transition",
									"delt_con(e)",
									"Resolve input arriving exactly at an internal event.",
								],
								["Shutdown", "exit", "Finish and release model resources."],
							]}
						/>
						<p>
							Use the integration’s generated template. It contains the imports,
							model construction and runner-facing factory expected by the
							wrapper. Implementing only a class without that factory is not a
							complete runnable module. Go and Java follow the same simulation
							concepts with their own method signatures.
						</p>
					</>
				),
			},
			{
				id: "interface",
				title: "The diagram and the code share an interface",
				content: (
					<>
						<p>
							Use the same port names in both places, including case. In the
							Python modeling library, <code>get_port_by_name("state")</code>{" "}
							finds one named port. <code>get_ports("out")</code> filters by
							direction; passing a port name to that method does not find it.
						</p>
						<InterfaceLab />
						<p>
							Adding a port in the editor does not automatically add output
							logic to the source. Conversely, emitting to a name absent from
							the interface will not create a new route.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "composition",
		group: "Modeling",
		title: "Composition & hierarchy",
		summary:
			"Connect components at the right level, then reuse the whole composition as another component.",
		sections: [
			{
				id: "levels",
				title: "Every coupled model owns one level",
				content: (
					<>
						<p>
							Drag definitions from the library into a coupled model to create
							occurrences. An occurrence can itself be coupled. Its inner
							structure remains part of that referenced definition, while its
							placement belongs to its parent.
						</p>
						<ExampleDiagram />
						<p>
							A connection is interpreted in the coupled model that owns it. The
							editor stores its source occurrence, source port, destination
							occurrence and destination port. It is not a global wire between
							arbitrary descendants.
						</p>
					</>
				),
			},
			{
				id: "connections",
				title: "Three legal coupling patterns",
				content: (
					<>
						<Table
							heads={["Pattern", "From", "To"]}
							rows={[
								[
									"Internal coupling (IC)",
									"A direct child’s output",
									"Another direct child’s input",
								],
								[
									"External input coupling (EIC)",
									"The coupled model’s input",
									"A direct child’s input",
								],
								[
									"External output coupling (EOC)",
									"A direct child’s output",
									"The coupled model’s output",
								],
							]}
						/>
						<p>
							To connect a deeply nested component to a model outside its
							parent, expose a boundary port and route through it. Repeat this
							at each boundary. This makes a subsystem reusable without exposing
							its private internal layout.
						</p>
						<Note>
							An input belongs to the receiving side; an output belongs to the
							emitting side. A coupled boundary has an internal and an external
							side, so its handles do not behave exactly like an atomic port.
						</Note>
					</>
				),
			},
			{
				id: "cycles",
				title: "Feedback is not recursive containment",
				content: (
					<>
						<p>
							A output → B input and B output → A input is a valid feedback
							structure. It may still need careful time advance to avoid an
							endless sequence of zero-time events.
						</p>
						<p>
							A containing B while B contains A is different: expanding those
							definitions never terminates. Containment cycles are rejected. The
							generated-structure validator checks references, ports, directions
							and owners; it does not reject a valid DEVS feedback loop merely
							because its coupling graph has a cycle.
						</p>
						<p>
							When a generated hierarchy is saved, children are created before
							the parents that reference them. Existing reusable components
							retain their references.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "instances",
		group: "Modeling",
		title: "Definitions, instances & identity",
		summary:
			"Reuse the same source without sharing the state of two simulated occurrences.",
		sections: [
			{
				id: "identity",
				title: "Three identities with different jobs",
				content: (
					<>
						<Table
							heads={["Identity", "Example", "Meaning"]}
							rows={[
								[
									"Definition ID",
									"switch-definition",
									"The saved code and interface reused from a library.",
								],
								[
									"Instance path",
									"room/switch-left",
									"One occurrence in the expanded composition.",
								],
								[
									"Simulation run ID",
									"run-…",
									"One execution, used to correlate its protocol messages.",
								],
							]}
						/>
						<p>
							Two occurrences of Switch can reference the same definition and
							have different state, timing and parameter overrides. The
							coordinator expands a path through the root and component
							identifiers so that the same nested model used twice produces
							distinct runtime participants.
						</p>
						<CopyCode
							label="Two occurrences, one definition"
							code={
								"Room\n├── switch-left  → Switch definition · period = 1\n└── switch-right → Switch definition · period = 5"
							}
						/>
					</>
				),
			},
			{
				id: "edits",
				title: "What changes when you edit a definition?",
				content: (
					<>
						<p>
							Changing the saved source updates the reusable definition. Future
							simulations that resolve it will use the new source, including
							occurrences in other coupled models that reference it. An instance
							parameter override changes configuration, not the referenced
							source.
						</p>
						<p>
							Changes in a model tab remain local until you save. Switching tabs
							is not a server save. An already created simulation has its own
							prepared manifest; saving a definition is not a live code patch
							into that execution.
						</p>
					</>
				),
			},
			{
				id: "names",
				title: "Names help humans; paths disambiguate machines",
				content: (
					<>
						<p>
							Do not use the displayed name as a unique key in experiments or
							result processing. The event panel can show readable names while
							identifiers still distinguish participants. For parameter
							overrides and WebApp bindings, select the instance path you intend
							to affect.
						</p>
						<p>
							If two components have the same label, inspect their paths before
							comparing results. Renaming a label does not merge their state or
							prove that two runs are equivalent.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "parameters",
		group: "Modeling",
		title: "Parameters & overrides",
		summary:
			"Change a default, an occurrence or a single experiment—with three different scopes.",
		sections: [
			{
				id: "precedence",
				title: "The most specific value wins",
				content: (
					<>
						<Flow
							steps={[
								[
									"Definition · period = 10",
									"The default saved with the reusable atomic model.",
								],
								[
									"Instance · period = 20",
									"An override on one component in a coupled model.",
								],
								[
									"Run · period = 5",
									"An optional override submitted when starting this simulation.",
								],
								[
									"Effective value · 5",
									"This occurrence receives 5 for this run. Other occurrences keep their own values.",
								],
							]}
						/>
						<p>
							Without a run override, the instance value is used. Without an
							instance override, the definition default is used. None of these
							scopes translates the source or changes its integration.
						</p>
					</>
				),
			},
			{
				id: "editing",
				title: "Where to edit each scope",
				content: (
					<>
						<Table
							heads={["You want to…", "Change…", "Persists where?"]}
							rows={[
								[
									"Set the reusable default",
									"The atomic model’s parameter list",
									"Saved definition",
								],
								[
									"Configure one occurrence",
									"The selected child’s parameter values",
									"Parent component metadata",
								],
								[
									"Try a scenario once",
									"Runtime Parameter Overrides in Simulate",
									"That simulation request",
								],
							]}
						/>
						<p>
							Names and types come from the model’s declared interface.
							Overrides target existing compatible parameters. A parameter named{" "}
							<code>period</code> is not automatically a scheduler setting: your
							code must read it and pass it to the appropriate timing operation.
						</p>
						<CopyCode
							label="Python · read a declared parameter"
							code={
								'period = float(self.parameters.get("period", 1.0))\nself.hold_in("ON", period)'
							}
						/>
					</>
				),
			},
			{
				id: "experiment",
				title: "Use overrides to compare experiments",
				content: (
					<>
						<p>
							Run the same saved system with two different periods. Keep the
							horizon and input assumptions fixed, then compare event times and
							outputs. Export each run before clearing its displayed events.
						</p>
						<p>
							A value of zero can create same-time event loops; a negative delay
							is not a sensible waiting time. Domain constraints belong in the
							model logic as well as in your experiment setup. Typed
							configuration alone does not establish physical validity.
						</p>
						<p>
							See {docLink("results", "results and exports")} for preserving the
							evidence of each run.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "parallel-devs",
		group: "Execution",
		title: "Parallel DEVS & logical time",
		summary:
			"Why outputs happen before transitions, and what happens when several events share a timestamp.",
		sections: [
			{
				id: "clock",
				title: "A discrete-event clock",
				content: (
					<>
						<p>
							The coordinator does not advance one wall-clock second at a time.
							Each atomic participant reports its next internal event time. The
							coordinator chooses the minimum, collects outputs from all
							participants imminent at that time, routes their values and then
							orders the relevant transitions.
						</p>
						<EventWalkthrough />
						<p>
							Only after transition completions provide the next internal times
							can the next step begin. A slow process can delay a wall-clock
							run, but it does not itself change the intended logical event
							timestamp.
						</p>
					</>
				),
			},
			{
				id: "confluence",
				title: "Simultaneous events are part of the semantics",
				content: (
					<>
						<Table
							heads={["Internal event due?", "Input arrives?", "Transition"]}
							rows={[
								["Yes", "No", "Internal"],
								["No", "Yes", "External, with elapsed time"],
								["Yes", "Yes", "Confluent"],
							]}
						/>
						<p>
							Parallel DEVS collects outputs from the imminent set before
							applying transitions. The confluent function gives the model an
							explicit rule for an internal event and incoming input at the same
							simulation time. Choosing internal-then-external or another valid
							domain rule is a modeling decision; copying a default without
							considering its effect can change the experiment.
						</p>
						<Note>
							“Parallel” names the DEVS formalism here. It does not promise that
							every model runs on a dedicated CPU core, or that ten models
							execute ten times faster.
						</Note>
					</>
				),
			},
			{
				id: "termination",
				title: "Horizon and passivation",
				content: (
					<>
						<p>
							A positive maximum simulation time bounds the run. Zero means no
							horizon in the current panel. The coordinator also ends when all
							participants have no finite next event. If your model continuously
							schedules events at the current time, a large horizon will not
							solve that loop.
						</p>
						<p>
							A reference for the formalism is the{" "}
							<a
								href="https://simulation.tudelft.nl/SEN9110/lectures/04%20VanTendelooVangheluwe_SpringSim2017_DEVSTutorial.pdf"
								target="_blank"
								rel="noreferrer"
								className="underline"
							>
								Parallel DEVS tutorial by Van Tendeloo and Vangheluwe
							</a>
							. The sequence above describes the coordinator implemented in this
							application.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "languages",
		group: "Execution",
		title: "One simulation, several languages",
		summary:
			"Python, Go and Java keep their own code. A shared execution contract connects them.",
		sections: [
			{
				id: "integration",
				title: "An integration is more than a language",
				content: (
					<>
						<p>
							An atomic model references an integration ID and version: for
							example <code>xdevs-python</code>, version <code>1.0.0</code>.
							That definition supplies a template, modeling sources, wrapper,
							preparation strategy and available capabilities. The language
							shown by the editor is derived from it.
						</p>
						<p>
							A framework can expose a different Atomic class or project
							structure in the same language. Keeping framework and version in
							the identity allows such integrations without treating every Java
							model as the same runtime. The current catalogue contains xDEVS
							Python, xDEVS Go and xDEVS Java; other frameworks need an
							implemented integration.
						</p>
					</>
				),
			},
			{
				id: "bridge",
				title: "The two communication boundaries",
				content: (
					<>
						<ExecutionMap />
						<Flow
							steps={[
								[
									"Coordinator ↔ Kafka ↔ runner",
									"Simulation commands, reports, routing information and logical timestamps.",
								],
								[
									"Runner ↔ gRPC ↔ wrapper",
									"A common DEVS service invokes the model inside its language runtime.",
								],
								[
									"Wrapper ↔ modeling library ↔ user code",
									"Python, Go or Java supplies the behavior with its real library.",
								],
								[
									"Outputs return through the same chain",
									"The coordinator routes values using the coupled model’s connections.",
								],
							]}
						/>
						<p>
							Kafka is the orchestration transport; it is not imported into
							every user model. The wrapper adapts language-specific code to the
							common gRPC service, while the runner bridges that service to the
							simulation protocol.
						</p>
						<p>
							For a Python output consumed by Java, agree on the payload
							structure and meaning—for example an object with a string field
							named <code>state</code>. Language independence does not
							automatically reconcile different units, field names or domain
							semantics.
						</p>
					</>
				),
			},
			{
				id: "preparation",
				title: "What happens before the first event",
				content: (
					<>
						<p>
							The runner prepares the integration’s project, places the user
							source and modeling library, builds where necessary, and launches
							the wrapper. Maven dependency resolution or Go compilation can
							dominate a cold start. Prepared dependencies and build caches
							improve subsequent starts, but a model compilation error still
							prevents execution.
						</p>
						<p>
							The editor’s language assistance also uses integration-specific
							project preparation, without running the model. A successful
							completion or diagnostic check is useful feedback, not proof that
							the simulation behavior is correct.
						</p>
						<p>
							Adding an integration requires its wrapper and preparation,
							template, AI resources where supported, tooling and tests.
							Preparations are registered and compiled into the runner; this is
							not a runtime upload marketplace.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "protocol",
		group: "Execution",
		title: "Messages, Kafka & ISO 21175",
		summary:
			"The explicit contract behind distributed simulation—and the limits of transport-level interoperability.",
		sections: [
			{
				id: "envelope",
				title: "Identify the run, sender, receiver and time",
				content: (
					<>
						<p>
							The application uses a common message envelope to correlate
							distributed participants. Commands and reports carry a message
							type, run identity and participant identities. Time-bearing
							operations carry logical event time. Output values are grouped by
							port.
						</p>
						<CopyCode
							label="Illustrative OutputReport · current application schema"
							code={JSON.stringify(
								{
									messageType: "OutputReport",
									messageId: "message-42",
									simulationRunId: "run-1",
									senderId: "room/switch-1",
									receiverId: "Coordinator",
									eventTime: 1,
									nextInternalTime: 2,
									payload: {
										outputs: [{ portName: "state", value: { state: "ON" } }],
										additionalFields: {},
									},
								},
								null,
								2,
							)}
						/>
						<p>
							The recipient is the coordinator in this report. It determines
							destinations from the manifest; the source model does not need to
							know the language or implementation of each receiving component.
						</p>
					</>
				),
			},
			{
				id: "lifecycle",
				title: "A conversation with explicit phases",
				content: (
					<Table
						heads={["Phase", "Messages", "Purpose"]}
						rows={[
							[
								"Initialize",
								"SimulationInit → NextInternalTimeReport",
								"Create initial scheduling knowledge.",
							],
							[
								"Collect outputs",
								"RequestOutput → OutputReport",
								"Obtain outputs before changing imminent states.",
							],
							[
								"Apply transitions",
								"ExecuteTransition → TransitionComplete",
								"Deliver inputs and obtain the new next-event time.",
							],
							[
								"Finish",
								"SimulationTerminate → ModelTerminated",
								"End participants’ lifecycle.",
							],
							[
								"Observe",
								"MonitoringMessage / ErrorReport",
								"Communicate diagnostics and failures.",
							],
						]}
					/>
				),
			},
			{
				id: "standard",
				title: "How ISO 21175 relates to this project",
				content: (
					<>
						<p>
							<a
								className="underline"
								target="_blank"
								rel="noreferrer"
								href="https://www.iso.org/standard/86670.html"
							>
								ISO 21175-1:2026
							</a>{" "}
							defines a reference model and process for collaboration
							environments for simulation across manufacturing platforms. The
							repository also contains a working draft of Part 2, dated 25 April
							2026, covering message meta-models and exchange formats.
						</p>
						<p>
							The shared Kafka message types explicitly reference that draft.
							The application’s lifecycle, time, port-value and diagnostic
							messages follow that design direction. This is the basis for
							describing the project’s alignment with the draft; it is not a
							claim of certified conformance or an assertion that the draft is a
							published standard.
						</p>
						<p>
							Kafka can transport messages for heterogeneous participants, but a
							new participant must still implement the agreed message semantics,
							timing, addressing and data schema. “Uses Kafka” alone does not
							make an arbitrary simulator interoperable. Adapters and
							compatibility tests are still needed.
						</p>
						<Note>
							For maintainers: compare{" "}
							<code>simulator/shared/kafka/type.go</code> with{" "}
							<code>assets/ISO-21175-2.md</code>. Changing the protocol requires
							coordinated compatibility checks across coordinator, runner and
							event consumers.
						</Note>
					</>
				),
			},
		],
	},
	{
		id: "simulation",
		group: "Experiments",
		title: "Configure & run a simulation",
		summary:
			"Prepare the saved system, choose a horizon and inspect the first run.",
		sections: [
			{
				id: "prepare",
				title: "Before pressing Start",
				content: (
					<>
						<ol className="list-decimal space-y-2 pl-5">
							<li>
								Save the model and any definitions you changed. The simulation
								uses saved data.
							</li>
							<li>
								Open <strong>Simulate</strong> from the active model’s header.
							</li>
							<li>
								Choose a positive maximum simulation time for your first run.
							</li>
							<li>
								If needed, enable runtime parameter overrides on the intended
								instance paths.
							</li>
							<li>
								Press <strong>Start</strong> once and follow preparation and
								execution status.
							</li>
						</ol>
						<SimulationFigure />
					</>
				),
			},
			{
				id: "manifest",
				title: "What is prepared from the diagram",
				content: (
					<>
						<p>
							The system resolves the model hierarchy into a runnable manifest.
							Atomic occurrences get their own identities and effective
							parameters. Coupled boundaries are resolved into routes between
							executable participants. The stored model hierarchy is retained
							for editing; flattening for execution does not overwrite your
							library.
						</p>
						<p>
							A mixed-language system may need several preparations before it
							starts. Compiler errors, missing ports or invalid configuration
							belong to different stages. Read the reported cause before
							changing the simulation horizon.
						</p>
					</>
				),
			},
			{
				id: "control",
				title: "Know what the controls do",
				content: (
					<>
						<Table
							heads={["Control", "Effect"]}
							rows={[
								["Max simulation time", "Logical horizon; 0 means unlimited."],
								[
									"Start",
									"Creates a simulation, starts event polling and requests execution.",
								],
								[
									"Stop",
									"Stops this panel’s polling. It is not a backend cancellation command.",
								],
								["Clear", "Clears the client event view."],
								[
									"Export JSON",
									"Downloads the events currently loaded in the panel and run metadata.",
								],
							]}
						/>
						<p>
							The distinction between stopping observation and stopping
							computation matters for long-running experiments. Inspect server
							status and logs if a run is still consuming resources after you
							close its view.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "results",
		group: "Experiments",
		title: "Results, JSON export & Grafana",
		summary:
			"Read a trace, follow a value across ports, and take the run into your own analysis tools.",
		sections: [
			{
				id: "read",
				title: "Read the trace at the right level",
				content: (
					<>
						<p>
							The simulation panel provides both event inspection and
							routed-message views. Use its search, event-type selector and
							payload filter to narrow a large trace. Expand a message to
							inspect its identifiers and payload instead of relying only on a
							readable model name.
						</p>
						<Table
							heads={["Question", "Look for"]}
							rows={[
								[
									"Did the model emit?",
									"OutputReport.payload.outputs and the expected port name.",
								],
								[
									"Did a receiver get the value?",
									"ExecuteTransition.payload.inputs for its instance.",
								],
								[
									"Why did time advance?",
									"Reported nextInternalTime and the coordinator’s minimum.",
								],
								[
									"Why did the run fail?",
									"ErrorReport severity, origin and message.",
								],
							]}
						/>
						<p>
							An empty output list may be a valid no-output event, an unmatched
							port lookup or a bug in the model. A completed run is not proof
							that the outputs satisfy your requirement.
						</p>
					</>
				),
			},
			{
				id: "export",
				title: "Preserve the events before clearing the view",
				content: (
					<>
						<p>
							Click <strong>Export JSON</strong> after events arrive. The
							download contains <code>eventCount</code>, <code>events</code>,{" "}
							<code>exportedAt</code>, model identity, simulation identity and
							status. It exports the loaded event collection, not only the rows
							left visible by your search filter.
						</p>
						<CopyCode
							label="Export shape · current panel"
							code={JSON.stringify(
								{
									modelName: "Switch",
									simulationStatus: "completed",
									eventCount: 1,
									events: [
										{
											simulationId: "run-1",
											createdAt: "2026-01-01T00:00:00Z",
											message: {
												messageType: "OutputReport",
												senderId: "room/switch-1",
												eventTime: 1,
												payload: {
													outputs: [
														{ portName: "state", value: { state: "ON" } },
													],
												},
											},
										},
									],
								},
								null,
								2,
							)}
						/>
						<p>
							Keep the source/configuration used for a comparison alongside the
							export. A trace records what happened; it is not a full versioned
							backup of all source definitions.
						</p>
					</>
				),
			},
			{
				id: "grafana",
				title: "Use the export in Grafana",
				content: (
					<>
						<ol className="list-decimal space-y-2 pl-5">
							<li>
								Install the{" "}
								<a
									href="https://grafana.com/docs/plugins/yesoreyeram-infinity-datasource/latest/"
									className="underline"
									target="_blank"
									rel="noreferrer"
								>
									Grafana Infinity data source
								</a>{" "}
								in your Grafana instance.
							</li>
							<li>
								Create an Infinity query with JSON data and an Inline source.
								Paste a small exported run.
							</li>
							<li>
								Select the <code>events</code> array as your rows. Start with a
								table.
							</li>
							<li>
								Extract <code>message.messageType</code>,{" "}
								<code>message.senderId</code> and <code>message.eventTime</code>
								. Expand output payloads for domain values.
							</li>
							<li>
								Filter to the relevant output reports and compare their values
								or event counts between runs.
							</li>
						</ol>
						<Note>
							Simulation time is a numeric logical axis, not a Unix timestamp.
							Use an appropriate numeric plot or explicitly define a mapping
							before treating it as a wall-clock time series.
						</Note>
						<p>
							This is an export/import workflow; DEVSForge does not
							automatically provision Grafana or push a live stream into it. The{" "}
							<a
								className="underline"
								target="_blank"
								rel="noreferrer"
								href="https://grafana.com/docs/plugins/yesoreyeram-infinity-datasource/latest/query/"
							>
								Infinity query editor documentation
							</a>{" "}
							explains the available sources and parsers. Older repository
							example exports use a different envelope: check your downloaded
							file rather than assuming legacy field names.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "experimental-frames",
		group: "Experiments",
		title: "Experimental frames",
		summary:
			"Make the conditions, observations and acceptance criteria part of an explicit test system.",
		sections: [
			{
				id: "roles",
				title: "A frame around the model under test",
				content: (
					<>
						<Flow
							steps={[
								["Generator", "Produces the stimuli under defined conditions."],
								[
									"Model under test",
									"The existing atomic or coupled system whose behavior you want to examine.",
								],
								["Transducer", "Observes outputs and derives measurements."],
								[
									"Acceptor",
									"Evaluates the observed experiment against an explicit condition.",
								],
							]}
						/>
						<p>
							A frame separates the system from the experiment used to study it.
							For a cold-chain example, define the stimulus profile, measure
							temperature deviations and state the allowed duration outside a
							range. The question is more precise than “does this model work?”
						</p>
					</>
				),
			},
			{
				id: "workflow",
				title: "Build and review the frame",
				content: (
					<>
						<p>
							Open <strong>Validate</strong> from the target model. Describe the
							experiment, input conditions and acceptance criteria. Review the
							proposed frame structure and its boundary connections before
							generating the new atomic behaviors.
						</p>
						<p>
							The target remains a protected reference. If it is coupled, its
							existing components are preserved; the AI should not invent
							replacements for them. Frame components may use different
							integrations, provided their ports and payload semantics agree.
						</p>
						<p>
							Use the structure conversation to propose a correction, inspect
							the changes and explicitly accept or reject it. Interface changes
							can leave existing code needing revalidation.
						</p>
					</>
				),
			},
			{
				id: "evidence",
				title: "Separate structural validity from a scientific conclusion",
				content: (
					<>
						<p>
							A structurally valid frame has resolvable components and legal
							couplings. It still needs suitable stimuli, measurements and
							acceptance logic. An AI-generated criterion is a proposal, not an
							independently established ground truth.
						</p>
						<p>
							Run the experiment, inspect its event trace and retain its
							configuration. Compare observed invariants—such as “every request
							is eventually answered under these conditions”—instead of
							expecting text-identical generated code across attempts.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "generation",
		group: "Tools",
		title: "Generate, discuss & reuse",
		summary:
			"Move from a description to a reviewed hierarchy, then implement the atomic behaviors.",
		sections: [
			{
				id: "description",
				title: "Describe a system that can be checked",
				content: (
					<>
						<p>
							Provide component roles, input/output names, timing and the
							payloads that cross each connection. If you want nested
							subsystems, describe their boundaries and the ports exposed at
							each level.
						</p>
						<CopyCode
							label="Example request"
							code={
								'Create a Room containing a Switch and a Light.\nSwitch starts ON and alternates ON/OFF every 10 time units.\nIts output port state emits {"state": "ON"} or {"state": "OFF"}.\nConnect it to Light.state (input).\nLight stores the received state; it must not schedule periodic outputs.\nKeep both components inside Room. No cross-level connections.'
							}
						/>
						<p>
							Configure your own provider and key in Settings before requesting
							generation. Manual modeling remains available without it. Review
							the request before submitting; generation invokes that configured
							provider.
						</p>
					</>
				),
			},
			{
				id: "proposals",
				title: "Structure is a separate decision from code",
				content: (
					<>
						<p>
							The structure phase shows a nested diagram and a conversation. A
							correction includes the current structure and a bounded history.
							You can explicitly attach relevant model code when needed.
						</p>
						<p>
							A correction becomes a proposal. It does not replace the current
							structure until you accept it. Invalid proposals show their
							problems and cannot be accepted. Rejecting one leaves the current
							structure intact.
						</p>
						<p>
							After accepting an interface change, existing code is preserved
							and affected models are marked for revalidation. Acceptance and
							draft recovery do not automatically purchase another generation
							call.
						</p>
					</>
				),
			},
			{
				id: "reuse",
				title: "Choose the integration before generating behavior",
				content: (
					<>
						<p>
							For each atomic model, select the integration and write its
							behavior requirements. Reuse candidates are matched by integration
							and version, then ownership. A Go definition is not a Python
							candidate just because its name is similar.
						</p>
						<p>
							Review generated code, library calls, timing and payload fields.
							Complete the remaining atomic components, then save the structure
							to a library. The save path creates referenced children before
							their coupled parents.
						</p>
						<p>
							Run a small bounded experiment before relying on a larger
							generated system. The{" "}
							{docLink("experimental-frames", "experimental-frame workflow")}{" "}
							provides a way to specify what you intend to validate.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "webapps",
		group: "Tools",
		title: "Deploy a model as a WebApp",
		summary:
			"Give a saved model a focused interface for parameters, simulation and outputs.",
		sections: [
			{
				id: "contract",
				title: "The contract comes from the model",
				content: (
					<>
						<p>
							Open <strong>Deploy</strong> from the model header. DEVSForge
							derives a contract from the selected model: parameter bindings,
							input/output bindings and the paths that identify their instances.
							The UI is configured against that contract.
						</p>
						<p>
							Bindings distinguish repeated occurrences of the same definition.
							A control for <code>room/left.period</code> must not accidentally
							change <code>room/right.period</code>. The WebApp runs the same
							underlying simulation backend; it is not a separate
							reimplementation of model behavior.
						</p>
					</>
				),
			},
			{
				id: "publish",
				title: "Prepare a usable interface",
				content: (
					<>
						<ol className="list-decimal space-y-2 pl-5">
							<li>Save and test the model first.</li>
							<li>
								Prepare the contract and choose the visible controls and
								sections.
							</li>
							<li>
								Review generated UI configuration against the actual bindings.
							</li>
							<li>Save the deployment, then open it from the WebApps list.</li>
							<li>Test representative parameter values and inspect outputs.</li>
						</ol>
						<p>
							Use the list’s search to find a deployment by its name, slug or
							source model. The runtime page exposes the selected parameters,
							outputs and simulation controls.
						</p>
					</>
				),
			},
			{
				id: "access",
				title: "Keep source, deployment and access distinct",
				content: (
					<>
						<p>
							A deployment references a model; it is not a frozen source-code
							archive. Review the contract when the underlying interface
							changes. A visibility field alone should not be taken as proof
							that a route is available to anonymous visitors: access also
							depends on the application’s authentication and server routes.
						</p>
						<p>
							For debugging missing values, inspect the instance binding first,
							then the underlying model’s event trace. A polished UI does not
							replace validation of its model.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "editing",
		group: "Tools",
		title: "Editor, tabs & recovery",
		summary:
			"Keep work in progress while switching models, and know when it reaches the server.",
		sections: [
			{
				id: "tabs",
				title: "One workspace, several model tabs",
				content: (
					<>
						<p>
							Opening a model adds or activates its tab. Drag tabs to reorder
							them. Switching tabs preserves the in-memory code or diagram,
							properties and viewport, and does not save to the server. Actions
							such as Save, Simulate and Validate refer to the active model.
						</p>
						<p>
							A modified tab offers Save, Discard or Cancel when closed. Save
							with <strong>⌘S</strong> on macOS or <strong>Ctrl+S</strong> on
							Windows and Linux. Keep track of the modified indicator before
							running saved definitions.
						</p>
					</>
				),
			},
			{
				id: "recovery",
				title: "Local recovery has a specific scope",
				content: (
					<>
						<p>
							The browser stores workspace tabs and drafts locally, separated by
							account and window identity. A reload restores drafts, including
							generator conversations. Duplicating a window creates an
							independent workspace copy.
						</p>
						<p>
							This is recovery on that browser, not cross-device synchronization
							or a server backup. Clearing browser storage can remove unsaved
							recovery data. Monaco’s undo history survives tab navigation but
							is not the same as a durable edit history after reload.
						</p>
					</>
				),
			},
			{
				id: "assistance",
				title: "Language help uses the actual modeling library",
				content: (
					<>
						<p>
							Python uses Pyright and Ruff, Go uses gopls, and Java uses Eclipse
							JDT LS. Project preparation exposes the integration’s actual
							modeling sources and language dependencies. Completion can
							therefore include inherited modeling methods as well as
							standard-library imports.
						</p>
						<p>
							Documents in the same account, workspace, integration and version
							can share server processes while keeping their projects distinct.
							Capacity limits or a failed startup can temporarily make
							assistance unavailable; the editor still accepts changes. This
							analysis does not execute your model.
						</p>
					</>
				),
			},
		],
	},
	{
		id: "architecture",
		group: "Reference",
		title: "Services & deployment architecture",
		summary:
			"Where editing, preparation, coordination, execution and observation happen.",
		sections: [
			{
				id: "services",
				title: "Separate responsibilities",
				content: (
					<>
						<ExecutionMap />
						<Table
							heads={["Component", "Responsibility"]}
							rows={[
								[
									"Frontend",
									"Library navigation, model editing, generation review and run inspection.",
								],
								[
									"Backend + PostgreSQL",
									"Authentication, ownership, persisted definitions, contracts and run events.",
								],
								[
									"Coordinator",
									"Global logical time, imminent sets, output routing and transition coordination.",
								],
								[
									"Runner",
									"Prepare integrations, launch wrappers, bridge gRPC and Kafka messages.",
								],
								[
									"Wrappers",
									"Execute user model operations in Python, Go or Java.",
								],
								[
									"Kafka",
									"Transport simulation commands and reports between protocol participants.",
								],
								[
									"LSP service",
									"Maintain isolated analysis workspaces and language servers.",
								],
							]}
						/>
						<p>
							The backend does not interpret every language’s source. That
							responsibility stays in the integration’s preparation and wrapper.
							The catalogue supplies the common identity and resources used by
							the other services.
						</p>
					</>
				),
			},
			{
				id: "layouts",
				title: "Packaging is not simulation semantics",
				content: (
					<>
						<p>
							The repository contains development, combined and islands
							deployment arrangements. A combined image groups services
							operationally; islands separate the coordinator and runner into
							services. Both still use the same timing and communication
							contracts.
						</p>
						<p>
							Separating services enables different placements, but starting
							more containers does not by itself establish transparent load
							balancing, failure recovery or unlimited scalability. Capacity
							depends on preparations, process count, broker behavior and model
							workload.
						</p>
						<p>
							The familiar developer entry points remain{" "}
							<code>task back:dev</code> and <code>task front:dev</code>.
							Changing the frontend documentation does not change the VPS
							deployment.
						</p>
					</>
				),
			},
			{
				id: "resources",
				title: "Sources and maintenance",
				content: (
					<>
						<Table
							heads={["Repository location", "What to look for"]}
							rows={[
								[
									"simulator/runner/integrations/",
									"Versioned integration definitions, modeling code, preparation and templates.",
								],
								[
									"simulator/coordinator/internal/simulation/",
									"The scheduling loop, routing and runtime manifest handling.",
								],
								[
									"simulator/shared/kafka/type.go",
									"Application command/report envelopes.",
								],
								["simulator/shared/proto/", "The shared wrapper RPC contract."],
								[
									"assets/ISO-21175-2.md",
									"The working draft referenced by the message implementation.",
								],
								[
									"docs/reproducibility.md",
									"Experiment walkthrough and external result analysis.",
								],
								[
									"docs/architecture-lsp-et-editeur.md",
									"Editor workspace and LSP architecture in French.",
								],
							]}
						/>
						<p>
							This documentation uses React pages so diagrams and real editor
							controls can sit next to explanations. Chapters live in{" "}
							<code>front/src/pages/help/documentation/chapters.tsx</code>; page
							navigation and search are shared.
						</p>
					</>
				),
			},
		],
	},
];
