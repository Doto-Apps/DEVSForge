import NavHeader from "@/components/nav/nav-header";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	Binary,
	Bot,
	Braces,
	CheckCheck,
	Database,
	FileCheck2,
	Languages,
	MessageSquareShare,
	MonitorCog,
	Network,
	Router,
	Workflow,
} from "lucide-react";

const contracts = [
	{
		endpoint: "/ai/generate-ef-structure",
		output: "response.ExperimentalFrameStructureResponse",
		notes:
			"Target model context is injected. Server validates MUT, root EF coupled, port/link consistency.",
	},
	{
		endpoint: "/ai/generate-model",
		output: "response.GeneratedModelResponse",
		notes:
			"Reuse-first shortlist can be returned before code generation. Final code response remains structured.",
	},
	{
		endpoint: "/ai/generate-documentation",
		output: "response.GeneratedDocumentationResponse",
		notes:
			"Documentation blocks (description, keywords, role) are emitted as structured JSON.",
	},
];

const loopSteps = [
	"Compute global minimum simulation time across runners.",
	"Select imminent runners at tmin and send devs.msg.SendOutput.",
	"Collect devs.msg.ModelOutputMessage from runners.",
	"Route output port values through manifest connections into target inboxes.",
	"Send devs.msg.ExecuteTransition with modelInputsOption.portValueList.",
	"Collect devs.msg.TransitionDone and update each runner nextTime.",
	"Stop on max simulation time, SimulationDone, or fatal ErrorReport.",
];

export function HowItWorks() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "How It Works" },
				]}
				showNavActions={false}
				showModeToggle
			/>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-6xl p-6 space-y-6">
					<Card className="relative overflow-hidden">
						<div className="absolute -left-12 -top-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
						<CardHeader className="relative space-y-3">
							<Badge className="w-fit">DEVSForge Architecture</Badge>
							<CardTitle className="text-3xl">How It Works</CardTitle>
							<CardDescription className="max-w-4xl text-base">
								DEVSForge combines strict structured AI outputs, deterministic
								server validation, and a simulator runtime based on
								Coordinator/Runner orchestration with RPC wrappers for
								multi-language models.
							</CardDescription>
						</CardHeader>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>High-Level System Layers</CardTitle>
							<CardDescription>
								From UI action to executable DEVS transitions.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<Router className="h-4 w-4 text-primary" />
									<p className="font-medium">Frontend</p>
								</div>
								<p className="text-sm text-muted-foreground">
									React + shadcn/ui + React Flow. Users model manually or trigger
									AI workflows.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<Bot className="h-4 w-4 text-primary" />
									<p className="font-medium">AI API Layer</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Go/Fiber endpoints with per-user provider settings and strict
									JSON-schema response format.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<Database className="h-4 w-4 text-primary" />
									<p className="font-medium">Persistence</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Models, metadata, simulations, and event streams persisted in
									backend storage.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<MonitorCog className="h-4 w-4 text-primary" />
									<p className="font-medium">Simulator Runtime</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Coordinator + runner processes exchange DEVS messages and drive
									time-ordered execution.
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Structured Output Contracts</CardTitle>
							<CardDescription>
								AI responses are constrained to typed JSON contracts, not free
								text.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border bg-muted/30 p-4">
								<div className="flex items-center gap-2 mb-2">
									<Braces className="h-4 w-4 text-primary" />
									<p className="font-medium">Contract Pattern</p>
								</div>
								<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
{`Prompt + Context
  -> OpenAI ChatCompletion
  -> response_format = json_schema (strict = true)
  -> Parse JSON
  -> Server-side guardrails
  -> Typed API response`}
								</pre>
							</div>

							<div className="grid gap-3">
								{contracts.map((c) => (
									<div
										key={c.endpoint}
										className="rounded-lg border bg-muted/30 p-4 space-y-2"
									>
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="secondary">{c.endpoint}</Badge>
											<Badge variant="outline">{c.output}</Badge>
										</div>
										<p className="text-sm text-muted-foreground">{c.notes}</p>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Server Guardrails and Validation</CardTitle>
							<CardDescription>
								Generation is accepted only after deterministic checks.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<FileCheck2 className="h-4 w-4 text-primary" />
									<p className="font-medium">EF Structure Rules</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Single MUT, single EF root, root must be coupled, connected
									port directions must be valid, and MUT interface must match the
									target model interface.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<CheckCheck className="h-4 w-4 text-primary" />
									<p className="font-medium">Simulation Preconditions</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Manifest generation validates runnable graph consistency before
									the simulation service launches coordinator/runner processes.
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Simulation Runtime: Coordinator and Runners</CardTitle>
							<CardDescription>
								Execution is event-driven and synchronized by simulation time.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border bg-muted/30 p-4">
								<div className="flex items-center gap-2 mb-2">
									<Workflow className="h-4 w-4 text-primary" />
									<p className="font-medium">Coordinator Loop</p>
								</div>
								<div className="space-y-2 text-sm text-muted-foreground">
									{loopSteps.map((step, index) => (
										<div key={step} className="flex items-start gap-2">
											<Badge variant="secondary">{index + 1}</Badge>
											<p>{step}</p>
										</div>
									))}
								</div>
							</div>

							<Separator />

							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<MessageSquareShare className="h-4 w-4 text-primary" />
									<p className="font-medium">Transport Message Types</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Runtime uses DEVS transport events such as
									<code className="mx-1">devs.msg.ExecuteTransition</code>,
									<code className="mx-1">devs.msg.SendOutput</code>,
									<code className="mx-1">devs.msg.ModelOutputMessage</code>,
									<code className="mx-1">devs.msg.TransitionDone</code> and
									<code className="mx-1">devs.msg.SimulationDone</code>. ISO-like
									<code className="mx-1">ErrorReport</code> is also consumed and
									can mark the run as failed.
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Runner RPC Boundary and Multi-Language Support</CardTitle>
							<CardDescription>
								Go and Python models execute behind one shared RPC contract.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 lg:grid-cols-2">
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<Network className="h-4 w-4 text-primary" />
									<p className="font-medium">AtomicModelService (gRPC)</p>
								</div>
								<p className="text-sm text-muted-foreground flex flex-wrap" >
									Runners call a stable RPC interface:
									<code className="mx-1">Initialize</code>,
									<code className="mx-1">Finalize</code>,
									<code className="mx-1">TimeAdvance</code>,
									<code className="mx-1">InternalTransition</code>,
									<code className="mx-1">ExternalTransition</code>,
									<code className="mx-1">ConfluentTransition</code>,
									<code className="mx-1">Output</code>,
									<code className="mx-1">AddInput</code>.
								</p>
							</div>

							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<Languages className="h-4 w-4 text-primary" />
									<p className="font-medium">Language Wrappers</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Each runner prepares a language-specific bootstrap (Go or
									Python), starts the model process, and waits until the gRPC
									service is ready. Once ready, coordinator-driven DEVS messages
									are translated into RPC calls in a uniform way.
								</p>
							</div>

							<div className="rounded-lg border bg-muted/30 p-4 space-y-2 lg:col-span-2">
								<div className="flex items-center gap-2">
									<Binary className="h-4 w-4 text-primary" />
									<p className="font-medium">Execution Mapping</p>
								</div>
								<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
{`ExecuteTransition(portValueList)
  -> AddInput(portName, valueJson)
  -> choose Internal / External / Confluent transition
  -> TimeAdvance -> nextTime
  -> emit TransitionDone

SendOutput
  -> Output()
  -> emit ModelOutputMessage(portValueList)`}
								</pre>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Failure Handling and Event Persistence</CardTitle>
							<CardDescription>
								Simulation state is finalized from consumed event stream.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="persist">
									<AccordionTrigger>
										Event Consumer and Database Writes
									</AccordionTrigger>
									<AccordionContent className="text-sm text-muted-foreground">
										A backend Kafka consumer stores batches of runtime events into
										simulation_events and updates simulation status. It handles
										both DEVS and ISO-like message envelopes.
									</AccordionContent>
								</AccordionItem>
								<AccordionItem value="error">
									<AccordionTrigger>
										ErrorReport Priority and Failure Status
									</AccordionTrigger>
									<AccordionContent className="text-sm text-muted-foreground">
										If an ErrorReport with severity error/fatal is received, it
										takes priority and marks simulation as failed, including
										error_message propagation to frontend polling.
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
