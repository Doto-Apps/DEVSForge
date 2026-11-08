import {
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	Folder,
	Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "@/api/v1";
import { ModelView } from "@/components/custom/ModelView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { libraryPreview } from "@/lib/libraryPreview";
import { useGetLibraries } from "@/queries/library/useGetLibraries";
import { useGetModels } from "@/queries/model/useGetModels";

type Model = components["schemas"]["response.ModelResponse"];

function LibrarySheet({
	id,
	title,
	description,
	models,
	allModels,
}: {
	id: string;
	title: string;
	description?: string;
	models: Model[];
	allModels: Model[];
}) {
	const [page, setPage] = useState(0);
	const [selectedId, setSelectedId] = useState<string>();
	const [focusId, setFocusId] = useState<string>();
	const [visible, setVisible] = useState(false);
	const container = useRef<HTMLDivElement>(null);
	const pageCount = Math.max(1, Math.ceil(models.length / 4));
	const currentPage = Math.min(page, pageCount - 1);
	const displayed = useMemo(
		() => models.slice(currentPage * 4, currentPage * 4 + 4),
		[models, currentPage],
	);
	const graph = useMemo(
		() =>
			visible ? libraryPreview(displayed, allModels) : { edges: [], nodes: [] },
		[displayed, allModels, visible],
	);
	const selected =
		allModels.find((model) => model.id === selectedId) ?? displayed[0];
	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => setVisible(entry.isIntersecting),
			{ rootMargin: "100px" },
		);
		if (container.current) observer.observe(container.current);
		return () => observer.disconnect();
	}, []);
	return (
		<section
			aria-label={`${title} library`}
			className="min-w-0 overflow-hidden rounded-lg border bg-background"
		>
			<header className="flex items-center gap-3 px-4 py-3">
				<Folder className="shrink-0 text-muted-foreground" size={17} />
				<div className="min-w-0 flex-1">
					<Link
						className="block truncate font-medium hover:underline"
						to={`/library/${id}`}
					>
						{title}
					</Link>
					<p className="truncate text-xs text-muted-foreground">
						{description || `${models.length} model definitions`}
					</p>
				</div>
				<Button asChild className="size-8" size="icon" variant="ghost">
					<Link
						aria-label={`Add model to ${title}`}
						to={`/library/${id}/model/new`}
					>
						<Plus size={16} />
					</Link>
				</Button>
			</header>
			<div className="relative h-72 bg-muted/20 sm:h-80" ref={container}>
				{graph.nodes.some((node) =>
					node.data.description.startsWith("Some components are unavailable"),
				) && (
					<p className="absolute bottom-2 left-2 right-2 z-10 rounded bg-background/90 px-2 py-1 text-[10px] text-muted-foreground">
						Partial preview: nested components are missing, cyclic or too large.
						Open the model for details.
					</p>
				)}
				{focusId && (
					<Button
						className="absolute right-2 top-2 z-10 h-7 text-xs"
						onClick={() => setFocusId(undefined)}
						size="sm"
						variant="secondary"
					>
						Show all
					</Button>
				)}
				{models.length ? (
					visible ? (
						<ModelView
							focusId={focusId}
							key={displayed.map((m) => m.id).join(":")}
							models={graph}
							onInspect={setSelectedId}
						/>
					) : (
						<Skeleton className="h-full w-full" />
					)
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
						<p>This library is an empty canvas.</p>
						<Button asChild size="sm" variant="outline">
							<Link to={`/library/${id}/model/new`}>Add your first model</Link>
						</Button>
					</div>
				)}
			</div>
			<div className="flex min-h-12 items-center gap-2 border-t px-3 py-2">
				<div className="flex min-w-0 flex-1 flex-wrap gap-1">
					{displayed.map((model) => (
						<button
							aria-pressed={selected?.id === model.id}
							className={`max-w-36 truncate rounded px-2 py-1 text-xs transition-colors ${selected?.id === model.id ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted"}`}
							key={model.id}
							onClick={() => {
								setSelectedId(model.id);
								setFocusId(`${model.id}::${model.id}`);
							}}
							onFocus={() => {
								setSelectedId(model.id);
								setFocusId(`${model.id}::${model.id}`);
							}}
							onMouseEnter={() => {
								setSelectedId(model.id);
								setFocusId(`${model.id}::${model.id}`);
							}}
							type="button"
						>
							{model.name}
						</button>
					))}
				</div>
				{pageCount > 1 && (
					<div className="flex shrink-0 items-center gap-1">
						<Button
							aria-label={`Previous models in ${title}`}
							className="size-7"
							disabled={currentPage === 0}
							onClick={() => {
								setPage(currentPage - 1);
								setSelectedId(undefined);
								setFocusId(undefined);
							}}
							size="icon"
							variant="ghost"
						>
							<ChevronLeft size={14} />
						</Button>
						<span className="text-[10px] tabular-nums text-muted-foreground">
							{currentPage + 1}/{pageCount}
						</span>
						<Button
							aria-label={`Next models in ${title}`}
							className="size-7"
							disabled={currentPage === pageCount - 1}
							onClick={() => {
								setPage(currentPage + 1);
								setSelectedId(undefined);
								setFocusId(undefined);
							}}
							size="icon"
							variant="ghost"
						>
							<ChevronRight size={14} />
						</Button>
					</div>
				)}
			</div>
			{selected && (
				<div className="flex min-h-16 items-center justify-between gap-3 bg-muted/30 px-4 py-3">
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">{selected.name}</p>
						<p className="text-xs text-muted-foreground">
							{selected.type === "coupled"
								? `${selected.components.length} components`
								: selected.integrationId?.replace("xdevs-", "xDEVS ") ||
									"Atomic"}{" "}
							· {selected.ports.filter((p) => p.type === "in").length} in /{" "}
							{selected.ports.filter((p) => p.type === "out").length} out
						</p>
					</div>
					<Button asChild size="sm" variant="ghost">
						<Link to={`/library/${selected.libId || id}/model/${selected.id}`}>
							Open
							<ArrowRight size={14} />
						</Link>
					</Button>
				</div>
			)}
		</section>
	);
}

export function LibraryGallery({ libraryId }: { libraryId?: string }) {
	const librariesQuery = useGetLibraries();
	const modelsQuery = useGetModels();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);
	const models = modelsQuery.data ?? [];
	const libraries = (librariesQuery.data ?? []).filter(
		(library) =>
			(!libraryId || library.id === libraryId) &&
			((library.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
				models.some(
					(model) =>
						model.libId === library.id &&
						model.name.toLowerCase().includes(search.toLowerCase()),
				)),
	);
	const count = Math.max(1, Math.ceil(libraries.length / 4));
	const currentPage = Math.min(page, count - 1);
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-base font-medium">
						{libraryId ? "Model collection" : "Your model collections"}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						Hover or focus a name to inspect its model. Select Open to edit.
					</p>
				</div>
				<Input
					aria-label="Find a library or model"
					className="h-8 w-full sm:w-56"
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(0);
					}}
					placeholder="Find a library or model…"
					value={search}
				/>
			</div>
			{librariesQuery.error || modelsQuery.error ? (
				<div className="py-12 text-sm" role="alert">
					Collections could not be loaded.{" "}
					<Button
						onClick={() => {
							void librariesQuery.mutate();
							void modelsQuery.mutate();
						}}
						size="sm"
						variant="outline"
					>
						Retry
					</Button>
				</div>
			) : librariesQuery.isLoading || modelsQuery.isLoading ? (
				<div className="grid gap-5 lg:grid-cols-2">
					<Skeleton className="h-96" />
					<Skeleton className="h-96" />
				</div>
			) : libraries.length ? (
				<div className="grid items-start gap-5 lg:grid-cols-2">
					{libraries
						.slice(currentPage * 4, currentPage * 4 + 4)
						.filter((library) => library.id)
						.map((library) => (
							<LibrarySheet
								allModels={models}
								description={library.description}
								id={library.id!}
								key={library.id}
								models={models.filter((model) => model.libId === library.id)}
								title={library.title ?? "Untitled library"}
							/>
						))}
				</div>
			) : (
				<div className="py-16 text-center">
					<p className="mb-4 text-muted-foreground">
						{search
							? "No matching library or model."
							: libraryId
								? "This library is unavailable."
								: "Your first library starts here."}
					</p>
					{!search && !libraryId && (
						<Button asChild>
							<Link to="/library/new">Create a library</Link>
						</Button>
					)}
				</div>
			)}
			{count > 1 && (
				<div className="flex items-center justify-end gap-3 text-xs">
					<Button
						disabled={currentPage === 0}
						onClick={() => setPage(currentPage - 1)}
						size="sm"
						variant="outline"
					>
						Previous libraries
					</Button>
					{currentPage + 1} / {count}
					<Button
						disabled={currentPage === count - 1}
						onClick={() => setPage(currentPage + 1)}
						size="sm"
						variant="outline"
					>
						Next libraries
					</Button>
				</div>
			)}
		</div>
	);
}
