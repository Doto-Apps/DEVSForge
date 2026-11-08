import { ArrowRight, BookOpenText, Network, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { LibraryGallery } from "@/components/custom/library/LibraryGallery";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import { RoadmapPreview } from "@/pages/roadmap/Roadmap";
import { useOptionalWorkbench } from "@/providers/WorkbenchProvider";

export function ModelerHome() {
	const workbench = useOptionalWorkbench();
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Home" }]}
				showModeToggle
				showNavActions={false}
			/>
			<main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
				<header className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b pb-6">
					<div>
						<p className="mb-3 font-mono text-[11px] tracking-widest text-muted-foreground">
							DEVSFORGE / MODELING WORKSPACE
						</p>
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							Small models.
							<br />
							<span className="text-muted-foreground">Bigger systems.</span>
						</h1>
						<p className="mt-3 max-w-md text-sm text-muted-foreground">
							Your workspace, drawn from the models you build.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<Link to="/devs-generator">
								<Network />
								Generate a system
							</Link>
						</Button>
						<Button asChild size="sm">
							<Link to="/library/new">
								<Plus />
								New library
							</Link>
						</Button>
					</div>
				</header>
				{!!workbench?.tabs.length && (
					<div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2">
						<span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
							On your desk
						</span>
						{workbench.tabs.map((tab) => (
							<Button asChild key={tab.id} size="sm" variant="secondary">
								<Link to={`/library/${tab.libraryId}/model/${tab.id}`}>
									{tab.name}
									<ArrowRight size={13} />
								</Link>
							</Button>
						))}
					</div>
				)}
				<RoadmapPreview />
				<LibraryGallery />
				<footer className="mt-8 grid gap-6 border-t py-5 sm:grid-cols-2">
					<Link className="group flex items-start gap-3" to="/getting-started">
						<BookOpenText className="mt-1 size-5 text-muted-foreground" />
						<div>
							<h2 className="text-sm font-medium group-hover:underline">
								Build a switch. Follow its first event.{" "}
								<span aria-hidden="true">↗</span>
							</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								A hands-on tutorial with the actual editor controls.
							</p>
						</div>
					</Link>
					<Link className="group" to="/documentation">
						<h2 className="text-sm font-medium group-hover:underline">
							Inside DEVSForge <span aria-hidden="true">↗</span>
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Parallel DEVS, multilingual execution, parameter overrides and
							results.
						</p>
					</Link>
				</footer>
			</main>
		</div>
	);
}
