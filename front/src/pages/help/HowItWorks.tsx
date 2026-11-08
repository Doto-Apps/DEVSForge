import { ArrowLeft, ArrowRight, BookOpenText, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chapters } from "./documentation/chapters";

// Preserve bookmarks from the previous single-page documentation.
export function LegacyDocumentation() {
	const { hash } = useLocation();
	const id = hash.slice(1);
	return (
		<Navigate
			replace
			to={`/documentation/${chapters.some((chapter) => chapter.id === id) ? id : "overview"}`}
		/>
	);
}
export function HowItWorks() {
	const { topic = "overview" } = useParams();
	const { hash } = useLocation();
	const [query, setQuery] = useState("");
	const scroller = useRef<HTMLDivElement>(null);
	const index = chapters.findIndex((chapter) => chapter.id === topic);
	const chapter = chapters[index];
	const matches = chapters.filter((item) =>
		`${item.title} ${item.summary} ${item.sections.map((section) => section.title).join(" ")}`
			.toLowerCase()
			.includes(query.toLowerCase()),
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset scroll when the route changes, including browser history.
	useEffect(() => {
		if (hash)
			document
				.getElementById(hash.slice(1))
				?.scrollIntoView({ block: "start" });
		else scroller.current?.scrollTo({ top: 0 });
	}, [topic, hash]);
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[
					{ href: "/documentation", label: "Documentation" },
					...(chapter && topic !== "overview"
						? [{ label: chapter.title }]
						: []),
				]}
				showModeToggle
				showNavActions={false}
			/>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="shrink-0 border-b lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-60">
					<div className="px-4 pb-3 pt-5">
						<Link
							className="mb-4 hidden items-center gap-2 text-sm font-semibold lg:flex"
							to="/documentation"
						>
							<BookOpenText size={16} />
							Field guide
						</Link>
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
							<Input
								aria-label="Find a documentation topic"
								className="h-8 pl-8 text-xs"
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Find a topic…"
								value={query}
							/>
						</div>
					</div>
					<nav
						aria-label="Documentation chapters"
						className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block"
					>
						{[...new Set(chapters.map((item) => item.group))].map((group) => (
							<div className="flex shrink-0 gap-1 lg:block" key={group}>
								<p className="mb-2 mt-4 hidden px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground lg:block">
									{matches.some((item) => item.group === group) ? group : ""}
								</p>
								{matches
									.filter((item) => item.group === group)
									.map((item) => (
										<Link
											aria-current={topic === item.id ? "page" : undefined}
											className={`block whitespace-nowrap rounded px-2 py-2 text-xs lg:whitespace-normal ${topic === item.id ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
											key={item.id}
											to={`/documentation/${item.id}`}
										>
											{item.id === "overview" ? "Overview" : item.title}
										</Link>
									))}
							</div>
						))}
						{!matches.length && (
							<p className="p-2 text-xs text-muted-foreground">
								No matching topic.
							</p>
						)}
					</nav>
				</aside>
				<div
					className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-9"
					ref={scroller}
				>
					{chapter ? (
						<div className="grid items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_180px]">
							<article className="min-w-0 max-w-4xl" key={topic}>
								<header className="mb-8 border-b pb-6">
									<p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
										{chapter.group} / {String(index + 1).padStart(2, "0")}
									</p>
									<h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
										{chapter.title}
									</h1>
									<p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
										{chapter.summary}
									</p>
								</header>
								<div className="space-y-10">
									{chapter.sections.map((section) => (
										<section
											className="scroll-mt-6"
											id={section.id}
											key={section.id}
										>
											<h2 className="mb-4 text-lg font-semibold tracking-tight">
												<a className="hover:underline" href={`#${section.id}`}>
													{section.title}
												</a>
											</h2>
											<div className="space-y-4 text-sm leading-7 [&_code]:break-words [&_code]:text-xs [&_pre_code]:break-normal">
												{section.content}
											</div>
										</section>
									))}
								</div>
								<footer className="mt-10 flex items-start justify-between gap-4 border-t pt-5">
									{index > 0 ? (
										<Link
											className="max-w-[45%] text-xs text-muted-foreground hover:text-foreground"
											to={`/documentation/${chapters[index - 1].id}`}
										>
											<span className="mb-2 flex items-center gap-1">
												<ArrowLeft size={12} />
												Previous
											</span>
											{chapters[index - 1].title}
										</Link>
									) : (
										<span />
									)}
									{index < chapters.length - 1 && (
										<Link
											className="max-w-[45%] text-right text-xs text-muted-foreground hover:text-foreground"
											to={`/documentation/${chapters[index + 1].id}`}
										>
											<span className="mb-2 flex items-center justify-end gap-1">
												Next
												<ArrowRight size={12} />
											</span>
											{chapters[index + 1].title}
										</Link>
									)}
								</footer>
							</article>
							<nav
								aria-label="On this page"
								className="order-first flex flex-wrap gap-3 text-xs 2xl:sticky 2xl:top-0 2xl:order-last 2xl:block 2xl:space-y-3"
							>
								<p className="hidden font-medium 2xl:block">On this page</p>
								{chapter.sections.map((section) => (
									<a
										className="block text-muted-foreground hover:text-foreground"
										href={`#${section.id}`}
										key={section.id}
									>
										{section.title}
									</a>
								))}
							</nav>
						</div>
					) : (
						<div>
							<h1 className="text-2xl font-semibold">Topic not found</h1>
							<p className="my-4 text-sm text-muted-foreground">
								Choose a chapter from the documentation index.
							</p>
							<Button asChild>
								<Link to="/documentation">Open documentation</Link>
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
