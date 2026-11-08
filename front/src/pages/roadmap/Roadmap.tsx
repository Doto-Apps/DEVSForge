import {
	ArrowRight,
	Check,
	ChevronRight,
	Circle,
	ExternalLink,
	Github,
	Mail,
	Map as MapIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { projectLinks, roadmap, roadmapStatuses } from "./roadmap-data";

export function RoadmapContact({ compact = false }: { compact?: boolean }) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
			<a
				className="inline-flex items-center gap-1.5 hover:text-foreground"
				href={`${projectLinks.github}/issues/new`}
				rel="noreferrer"
				target="_blank"
			>
				<Github size={13} />
				{compact ? "Report / suggest" : "Report a problem or suggest an idea"}
				<ExternalLink size={11} />
			</a>
			<a
				className="inline-flex items-center gap-1.5 hover:text-foreground"
				href={`mailto:${projectLinks.email}`}
			>
				<Mail size={13} />
				{compact ? "Contact" : projectLinks.email}
			</a>
		</div>
	);
}

export function RoadmapPreview() {
	const completed = roadmap.filter((item) => item.status === "done").length;
	const next = roadmap
		.filter((item) => item.status !== "done")
		.sort(
			(a, b) =>
				roadmapStatuses.findIndex((status) => status.id === b.status) -
				roadmapStatuses.findIndex((status) => status.id === a.status),
		)
		.slice(0, 3);
	return (
		<section
			aria-labelledby="roadmap-preview-title"
			className="mb-7 border-b pb-5"
		>
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2
					className="flex items-center gap-2 text-sm font-medium"
					id="roadmap-preview-title"
				>
					<MapIcon size={15} />
					On the roadmap
					<span className="ml-1 text-xs font-normal text-muted-foreground">
						{completed}/{roadmap.length} completed
					</span>
				</h2>
				<Link
					className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					to="/roadmap"
				>
					View all
					<ArrowRight size={13} />
				</Link>
			</div>
			<ul className="grid gap-x-6 gap-y-3 md:grid-cols-3">
				{next.map((item) => (
					<li key={item.id}>
						<Link className="group block" to={`/roadmap#${item.id}`}>
							<p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
								{item.category} ·{" "}
								{
									roadmapStatuses.find((status) => status.id === item.status)
										?.label
								}
							</p>
							<p className="text-sm leading-5 group-hover:underline">
								{item.title}
							</p>
						</Link>
					</li>
				))}
			</ul>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<p className="text-xs text-muted-foreground">
					Already available:{" "}
					{roadmap
						.filter((item) => item.status === "done")
						.map((item) => item.title)
						.join(", ") || "No completed items yet"}
				</p>
				<RoadmapContact compact />
			</div>
		</section>
	);
}

export function Roadmap() {
	const { hash } = useLocation();
	const navigate = useNavigate();
	const [status, setStatus] = useState("all");
	const [category, setCategory] = useState("all");
	const lastTrigger = useRef<HTMLButtonElement | null>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const selected = roadmap.find((item) => hash === `#${item.id}`);
	const categories = [...new Set(roadmap.map((item) => item.category))];
	const filtered = roadmap.filter(
		(item) =>
			(status === "all" || item.status === status) &&
			(category === "all" || item.category === category),
	);
	const counts = (id: string) =>
		roadmap.filter((item) => item.status === id).length;
	return (
		<Sheet
			onOpenChange={(open) => {
				if (!open) void navigate({ hash: "" }, { replace: true });
			}}
			open={!!selected}
		>
			<div className="flex h-screen min-w-0 w-full flex-col">
				<NavHeader
					breadcrumbs={[{ label: "Roadmap" }]}
					showModeToggle
					showNavActions={false}
				/>
				<main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
					<header className="mb-4 border-b pb-4">
						<p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
							DEVSForge / Open development
						</p>
						<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
							<div>
								<h1
									className="text-3xl font-semibold tracking-tight"
									ref={heading}
									tabIndex={-1}
								>
									What’s next
								</h1>
								<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
									The planned work, the tasks behind it, and what is already
									available. The order is provisional; no delivery dates are
									committed.
								</p>
							</div>
							<RoadmapContact />
						</div>
					</header>
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<fieldset
							aria-label="Filter by roadmap status"
							className="flex flex-wrap gap-1"
						>
							{[{ id: "all", label: "All" }, ...roadmapStatuses].map((item) => (
								<Button
									aria-pressed={status === item.id}
									key={item.id}
									onClick={() => setStatus(item.id)}
									size="sm"
									variant={status === item.id ? "secondary" : "ghost"}
								>
									{item.label}
									<span className="ml-1 text-xs tabular-nums text-muted-foreground">
										{item.id === "all" ? roadmap.length : counts(item.id)}
									</span>
								</Button>
							))}
						</fieldset>
						<Select onValueChange={setCategory} value={category}>
							<SelectTrigger
								aria-label="Filter roadmap by topic"
								className="h-8 w-full sm:w-52"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All topics</SelectItem>
								{categories.map((topic) => (
									<SelectItem key={topic} value={topic}>
										{topic}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{!filtered.length && (
						<p
							className="py-12 text-center text-sm text-muted-foreground"
							role="status"
						>
							No items in this selection yet.
						</p>
					)}
					<div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
						{categories
							.filter((topic) =>
								filtered.some((item) => item.category === topic),
							)
							.map((topic) => {
								const items = filtered.filter(
									(item) => item.category === topic,
								);
								return (
									<section
										aria-label={topic}
										className="min-w-0 overflow-hidden rounded-lg border bg-card"
										key={topic}
									>
										<header className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2.5">
											<h2 className="text-xs font-medium">{topic}</h2>
											<span className="text-[10px] tabular-nums text-muted-foreground">
												{items.filter((item) => item.status === "done").length}/
												{items.length} completed
											</span>
										</header>
										<ul className="divide-y">
											{items.map((item) => (
												<li key={item.id}>
													<button
														aria-haspopup="dialog"
														className="group flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
														data-roadmap-id={item.id}
														onClick={(event) => {
															lastTrigger.current = event.currentTarget;
															void navigate(
																{ hash: `#${item.id}` },
																{ replace: true },
															);
														}}
														type="button"
													>
														<span className="mt-0.5 shrink-0 text-muted-foreground">
															{item.status === "done" ? (
																<Check size={14} />
															) : (
																<Circle size={13} />
															)}
														</span>
														<span className="min-w-0 flex-1">
															<span className="block text-[13px] font-medium leading-5">
																{item.title}
															</span>
															<span className="mt-1 block text-[11px] text-muted-foreground">
																{
																	roadmapStatuses.find(
																		(s) => s.id === item.status,
																	)?.label
																}{" "}
																·{" "}
																{item.tasks.filter((task) => task.done).length}/
																{item.tasks.length} tasks
															</span>
														</span>
														<ChevronRight
															className="mt-1 shrink-0 text-muted-foreground group-hover:text-foreground"
															size={13}
														/>
													</button>
												</li>
											))}
										</ul>
									</section>
								);
							})}
					</div>
					<footer className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">
						Progress is maintained with the application’s releases. Task lists
						describe the planned scope and may evolve as the work is refined.
					</footer>
				</main>
			</div>
			{selected && (
				<SheetContent
					className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						if (
							lastTrigger.current?.isConnected &&
							lastTrigger.current.dataset.roadmapId === selected.id
						)
							lastTrigger.current.focus();
						else heading.current?.focus();
					}}
					side="right"
				>
					<SheetHeader className="pr-6 text-left">
						<p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
							{selected.category}
						</p>
						<SheetTitle className="leading-7">{selected.title}</SheetTitle>
						<SheetDescription className="leading-6">
							{selected.description}
						</SheetDescription>
					</SheetHeader>
					<div>
						<div className="mb-4 flex items-center justify-between gap-3 border-b pb-3 text-xs">
							<span className="font-medium">
								{roadmapStatuses.find((s) => s.id === selected.status)?.label}
							</span>
							<span className="tabular-nums text-muted-foreground">
								{selected.tasks.filter((task) => task.done).length}/
								{selected.tasks.length} tasks completed
							</span>
						</div>
						<ul className="space-y-4">
							{selected.tasks.map((task) => (
								<li
									className="flex items-start gap-2.5 text-sm leading-6"
									key={task.text}
								>
									<span className="mt-1 shrink-0 text-muted-foreground">
										{task.done ? (
											<Check aria-label="Completed" size={14} />
										) : (
											<Circle aria-label="Not completed" size={14} />
										)}
									</span>
									<span>{task.text}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="flex flex-wrap gap-x-5 gap-y-3 border-t pt-4 text-xs text-muted-foreground">
						<a
							className="inline-flex items-center gap-1 hover:text-foreground"
							href={`${projectLinks.github}/issues/new?title=${encodeURIComponent(`[Roadmap] ${selected.title}`)}&body=${encodeURIComponent(`Roadmap item: ${selected.title}\n\nMy suggestion or feedback:\n`)}`}
							rel="noreferrer"
							target="_blank"
						>
							Discuss on GitHub
							<ExternalLink size={11} />
						</a>
						{"reference" in selected && (
							<a
								className="inline-flex items-center gap-1 hover:text-foreground"
								href={selected.reference.url}
								rel="noreferrer"
								target="_blank"
							>
								{selected.reference.label}
								<ExternalLink size={11} />
							</a>
						)}
					</div>
				</SheetContent>
			)}
		</Sheet>
	);
}
