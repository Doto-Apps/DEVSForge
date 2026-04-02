import {
	Bot,
	ChevronRight,
	FlaskConical,
	KeyRound,
	PlayCircle,
	SquarePen,
	Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const manualPath = [
	"Create a library, then add atomic/coupled models manually.",
	"Define interface first: ports, parameters, and model role.",
	"Write or edit behavior code directly in the model editor.",
	"Compose coupled structure with explicit components and links.",
	"Open Validate to build an Experimental Frame, then simulate.",
];

const fastPath = [
	"Open Settings and configure your own AI provider (URL, key, model).",
	"Use DEVS Generator with prompt-based creation + reuse candidates.",
	"Review generated structure/code before saving anything.",
	"Generate an Experimental Frame around your model under test.",
	"Run simulation, inspect event flow, then iterate quickly.",
];

export function GettingStarted() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/", label: "Home" },
					{ label: "Getting Started" },
				]}
				showModeToggle
				showNavActions={false}
			/>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-6xl p-6 space-y-6">
					<Card className="relative overflow-hidden">
						<div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
						<CardHeader className="relative space-y-3">
							<Badge className="w-fit">DEVSForge Guide</Badge>
							<CardTitle className="text-3xl">Getting Started</CardTitle>
							<CardDescription className="max-w-3xl text-base">
								DEVSForge supports two practical ways of working: a manual path
								for full control, and a fast AI-assisted path for rapid
								iteration.
							</CardDescription>
						</CardHeader>
						<CardContent className="relative flex flex-wrap items-center gap-2 text-sm">
							<Badge variant="secondary">Manual Path</Badge>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<Badge variant="secondary">AI Path</Badge>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<Badge variant="secondary">Validation (EF)</Badge>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<Badge variant="secondary">Simulation</Badge>
						</CardContent>
					</Card>

					<div className="grid gap-6 lg:grid-cols-2">
						<Card className="border-primary/30">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<SquarePen className="h-4 w-4 text-primary" />
									<Badge variant="outline">Path A</Badge>
								</div>
								<CardTitle>Old-School Craft (Manual)</CardTitle>
								<CardDescription>
									Best when you want deterministic control over each model
									decision.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2 text-sm text-muted-foreground">
									{manualPath.map((item, index) => (
										<div className="flex items-start gap-2" key={item}>
											<Badge variant="secondary">{index + 1}</Badge>
											<p>{item}</p>
										</div>
									))}
								</div>
								<Separator />
								<div className="flex flex-wrap gap-2">
									<Button asChild size="sm" variant="outline">
										<Link to="/library/new">
											<SquarePen />
											Start Manual Modeling
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card className="border-primary/30">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<Zap className="h-4 w-4 text-primary" />
									<Badge variant="outline">Path B</Badge>
								</div>
								<CardTitle>Ready to Go Fast (AI)</CardTitle>
								<CardDescription>
									Best when you want rapid bootstrap + guided refinement.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2 text-sm text-muted-foreground">
									{fastPath.map((item, index) => (
										<div className="flex items-start gap-2" key={item}>
											<Badge variant="secondary">{index + 1}</Badge>
											<p>{item}</p>
										</div>
									))}
								</div>
								<Separator />
								<div className="flex flex-wrap gap-2">
									<Button asChild size="sm">
										<Link to="/settings">
											<KeyRound />
											Set API Credentials
										</Link>
									</Button>
									<Button asChild size="sm" variant="outline">
										<Link to="/devs-generator">
											<Bot />
											Open DEVS Generator
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>After Either Path</CardTitle>
							<CardDescription>
								Both paths converge on validation and execution.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<FlaskConical className="h-4 w-4 text-primary" />
									<p className="font-medium">Experimental Frame Validation</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Generate or edit EF around the model under test. Ensure ports
									and couplings are coherent before execution.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
								<div className="flex items-center gap-2">
									<PlayCircle className="h-4 w-4 text-primary" />
									<p className="font-medium">Simulation & Message Flow</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Run simulation and inspect runtime event flow between models
									and ports over simulation time.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
