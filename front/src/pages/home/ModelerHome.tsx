import NavHeader from "@/components/nav/nav-header";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
	ArrowRight,
	BrainCircuit,
	CheckCircle2,
	FilePenLine,
	FolderPlus,
	LayoutDashboard,
	PlayCircle,
	Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

export function ModelerHome() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[{ label: "Home" }]}
				showNavActions={false}
				showModeToggle
			/>
			<div className="flex-1 overflow-y-auto">
				<div className="relative">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary))/0.08,_transparent_55%)]" />
					<div className="relative mx-auto max-w-6xl px-6 py-8 space-y-8">
						<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
							<Card className="relative overflow-hidden">
								<div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
								<CardHeader className="space-y-3">
									<Badge className="w-fit">DEVS Modeler</Badge>
									<CardTitle className="text-3xl lg:text-4xl">
										Design, simulate, and refine DEVS models with focus.
									</CardTitle>
									<CardDescription className="text-base">
										A clean workspace for atomic and coupled models, versioned
										libraries, and fast iteration. Build structure first, then
										bring behavior to life.
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-3">
									<Button asChild>
										<Link to="/library/new">
											<FolderPlus />
											Create a Library
										</Link>
									</Button>
									<Button asChild variant="secondary">
										<Link to="/devs-generator">
											<Sparkles />
											Generate a Diagram
										</Link>
									</Button>
									<Button asChild variant="outline">
										<Link to="/workspace/new">
											<LayoutDashboard />
											New Workspace
										</Link>
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Modeling Focus</CardTitle>
									<CardDescription>
										Keep the basics sharp before expanding your system.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4 text-sm">
									<div className="flex items-start gap-3">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
										<div>
											<p className="font-medium">Atomic behavior first</p>
											<p className="text-muted-foreground">
												Define ports, states, and transitions before wiring
												large structures.
											</p>
										</div>
									</div>
									<div className="flex items-start gap-3">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
										<div>
											<p className="font-medium">Coupled composition</p>
											<p className="text-muted-foreground">
												Compose reusable models to keep your system modular and
												testable.
											</p>
										</div>
									</div>
									<div className="flex items-start gap-3">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
										<div>
											<p className="font-medium">Simulation feedback</p>
											<p className="text-muted-foreground">
												Validate assumptions with repeatable runs and traceable
												results.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
							<Card className="h-full">
								<CardHeader className="space-y-2">
									<FilePenLine className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">Model Library</CardTitle>
									<CardDescription>
										Organize atomic and coupled models into reusable libraries.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button asChild variant="ghost" className="px-0">
										<Link to="/library/new">
											Library setup
											<ArrowRight />
										</Link>
									</Button>
								</CardContent>
							</Card>

							<Card className="h-full">
								<CardHeader className="space-y-2">
									<BrainCircuit className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">AI Diagram Maker</CardTitle>
									<CardDescription>
										Describe the system and let the generator draft the
										structure.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button asChild variant="ghost" className="px-0">
										<Link to="/devs-generator">
											Try the generator
											<ArrowRight />
										</Link>
									</Button>
								</CardContent>
							</Card>

							<Card className="h-full">
								<CardHeader className="space-y-2">
									<LayoutDashboard className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">Workspace Setup</CardTitle>
									<CardDescription>
										Spin up a workspace to iterate diagrams and documentation
										together.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button asChild variant="ghost" className="px-0">
										<Link to="/workspace/new">
											Create workspace
											<ArrowRight />
										</Link>
									</Button>
								</CardContent>
							</Card>

							<Card className="h-full">
								<CardHeader className="space-y-2">
									<PlayCircle className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">DEVS Editor</CardTitle>
									<CardDescription>
										Open the online editor to refine behavior, ports, and
										transitions.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button asChild variant="ghost" className="px-0">
										<Link to="/online-devs">
											Open editor
											<ArrowRight />
										</Link>
									</Button>
								</CardContent>
							</Card>
						</div>

						<Card>
							<CardHeader className="space-y-2">
								<CardTitle className="text-lg">DEVS Modeling Flow</CardTitle>
								<CardDescription>
									A lightweight path from idea to verified simulation.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid gap-4 md:grid-cols-3">
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary">01</Badge>
											<span className="font-medium">Define atomic logic</span>
										</div>
										<p className="text-sm text-muted-foreground">
											Set ports, state variables, and internal/external
											transitions.
										</p>
									</div>
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary">02</Badge>
											<span className="font-medium">
												Compose coupled structures
											</span>
										</div>
										<p className="text-sm text-muted-foreground">
											Wire atomic and coupled models into a coherent system
											topology.
										</p>
									</div>
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary">03</Badge>
											<span className="font-medium">Simulate and iterate</span>
										</div>
										<p className="text-sm text-muted-foreground">
											Run scenarios, validate assumptions, and refine behavior
											quickly.
										</p>
									</div>
								</div>

								<Separator />

								<div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
									<div className="space-y-3">
										<p className="text-sm text-muted-foreground">
											Use the sidebar to open existing libraries and workspaces.
											Every action stays close to the modeler flow so you can
											iterate without context switching.
										</p>
										<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
											<Badge variant="outline">Atomic</Badge>
											<Badge variant="outline">Coupled</Badge>
											<Badge variant="outline">Ports</Badge>
											<Badge variant="outline">Transitions</Badge>
											<Badge variant="outline">Simulation</Badge>
										</div>
									</div>
									<Card className="bg-muted/30">
										<CardHeader className="space-y-2">
											<CardTitle className="text-base">
												Suggested Next Step
											</CardTitle>
											<CardDescription>
												Start with a library, then generate your first diagram.
											</CardDescription>
										</CardHeader>
										<CardContent className="flex flex-col gap-2">
											<Button asChild>
												<Link to="/library/new">
													<FolderPlus />
													New library
												</Link>
											</Button>
											<Button asChild variant="outline">
												<Link to="/devs-generator">
													<Sparkles />
													Generate diagram
												</Link>
											</Button>
										</CardContent>
									</Card>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="space-y-2">
								<CardTitle className="text-lg">Modeler Notes</CardTitle>
								<CardDescription>
									Short reminders that help keep your models clean and scalable.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Accordion type="single" collapsible className="w-full">
									<AccordionItem value="ports">
										<AccordionTrigger>Keep ports intentional</AccordionTrigger>
										<AccordionContent>
											Prefer a small set of expressive ports over many loosely
											defined ones. It keeps transitions easier to reason about.
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="coupling">
										<AccordionTrigger>Document coupling rules</AccordionTrigger>
										<AccordionContent>
											Write down why each connection exists so future updates
											stay safe and consistent.
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="simulation">
										<AccordionTrigger>Plan simulations early</AccordionTrigger>
										<AccordionContent>
											Define your validation scenarios while modeling. It saves
											time when you run the first simulation pass.
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
