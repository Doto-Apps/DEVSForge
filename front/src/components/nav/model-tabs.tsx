import { FileCode, Network, X } from "lucide-react";
import { type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useOptionalWorkbench } from "@/providers/WorkbenchProvider";
export function ModelTabs() {
	const workbench = useOptionalWorkbench();
	const navigate = useNavigate();
	const { modelId } = useParams();
	const [closing, setClosing] = useState<string>();
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const list = useRef<HTMLDivElement>(null);
	const helpId = useId();
	const drag = useRef<{
		id: string;
		pointerId: number;
		x: number;
		active: boolean;
		target?: { id: string; after: boolean };
	}>();
	const suppressClick = useRef(false);
	const [draggedId, setDraggedId] = useState<string>();
	const [dropTarget, setDropTarget] = useState<{
		id: string;
		after: boolean;
	}>();
	const tabCount = workbench?.tabs.length ?? 0;
	useEffect(() => {
		if (!modelId || !tabCount) return;
		list.current
			?.querySelector<HTMLElement>("[aria-selected=true]")
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [modelId, tabCount]);
	const finishDrag = (
		event: PointerEvent<HTMLButtonElement>,
		cancel = false,
	) => {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		drag.current = undefined;
		suppressClick.current = current.active && !cancel;
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (!cancel && current.active && current.target)
			workbench?.reorder(current.id, current.target.id, current.target.after);
		setDraggedId(undefined);
		setDropTarget(undefined);
	};
	if (!workbench?.tabs.length) return null;
	const close = (id: string) => {
		const index = workbench.tabs.findIndex((t) => t.id === id);
		workbench.remove(id);
		if (id === modelId) {
			const next = workbench.tabs[index - 1] ?? workbench.tabs[index + 1];
			navigate(
				next ? `/library/${next.libraryId}/model/${next.id}` : "/library",
			);
		}
		setClosing(undefined);
	};
	return (
		<>
			<div
				aria-describedby={helpId}
				aria-label="Open models"
				className="flex h-[34px] min-w-0 overflow-x-auto border-b bg-background [scrollbar-width:thin]"
				ref={list}
				role="tablist"
			>
				{workbench.tabs.map((tab) => (
					<div
						className={`relative flex h-full shrink-0 items-center border-r px-1 ${modelId === tab.id ? "bg-muted text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:bg-muted/50"} ${draggedId === tab.id ? "opacity-50" : ""}`}
						data-model-tab={tab.id}
						key={tab.id}
						title={`${tab.libraryName}/${tab.name}${tab.integration ? ` · ${tab.integration}` : ""}`}
					>
						<button
							aria-selected={tab.id === modelId}
							className="flex h-full touch-pan-y select-none items-center gap-2 px-2 text-xs cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							onClick={(e) => {
								if (suppressClick.current) {
									suppressClick.current = false;
									e.preventDefault();
									return;
								}
								navigate(`/library/${tab.libraryId}/model/${tab.id}`);
							}}
							onKeyDown={(e) => {
								suppressClick.current = false;
								if (e.altKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
									e.preventDefault();
									const index = workbench.tabs.findIndex(
										(t) => t.id === tab.id,
									);
									const after = e.key === "ArrowRight";
									const target = workbench.tabs[index + (after ? 1 : -1)];
									if (target) workbench.reorder(tab.id, target.id, after);
									return;
								}
								if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
									return;
								e.preventDefault();
								const index = workbench.tabs.findIndex((t) => t.id === tab.id);
								const next =
									workbench.tabs[
										e.key === "Home"
											? 0
											: e.key === "End"
												? workbench.tabs.length - 1
												: (index +
														(e.key === "ArrowRight" ? 1 : -1) +
														workbench.tabs.length) %
													workbench.tabs.length
									];
								navigate(`/library/${next.libraryId}/model/${next.id}`);
								const list = e.currentTarget.closest("[role=tablist]");
								requestAnimationFrame(() =>
									list
										?.querySelector<HTMLButtonElement>("[aria-selected=true]")
										?.focus(),
								);
							}}
							onLostPointerCapture={(e) => finishDrag(e, true)}
							onPointerCancel={(e) => finishDrag(e, true)}
							onPointerDown={(e) => {
								if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey)
									return;
								suppressClick.current = false;
								drag.current = {
									active: false,
									id: tab.id,
									pointerId: e.pointerId,
									x: e.clientX,
								};
								e.currentTarget.setPointerCapture(e.pointerId);
							}}
							onPointerMove={(e) => {
								const current = drag.current;
								if (!current || current.pointerId !== e.pointerId) return;
								if (!current.active && Math.abs(e.clientX - current.x) < 6)
									return;
								current.active = true;
								setDraggedId(current.id);
								e.preventDefault();
								const target = document
									.elementFromPoint(e.clientX, e.clientY)
									?.closest<HTMLElement>("[data-model-tab]");
								const id = target?.dataset.modelTab;
								const bounds = target?.getBoundingClientRect();
								current.target =
									id &&
									id !== current.id &&
									bounds &&
									list.current?.contains(target)
										? { after: e.clientX > bounds.left + bounds.width / 2, id }
										: undefined;
								setDropTarget(current.target);
								const viewport = list.current?.getBoundingClientRect();
								if (viewport && list.current) {
									if (e.clientX < viewport.left + 24)
										list.current.scrollLeft -= 20;
									else if (e.clientX > viewport.right - 24)
										list.current.scrollLeft += 20;
								}
							}}
							onPointerUp={(e) => finishDrag(e)}
							role="tab"
							tabIndex={tab.id === modelId ? 0 : -1}
							type="button"
						>
							{tab.integration && (
								<span
									aria-hidden="true"
									className="text-[10px] text-muted-foreground"
								>
									{tab.integration.replace("xdevs-", "")}
								</span>
							)}
							{tab.kind === "coupled" ? (
								<Network size={14} />
							) : (
								<FileCode size={14} />
							)}
							<span className="max-w-40 truncate">{tab.name}</span>
							{workbench.tabs.some(
								(t) => t.id !== tab.id && t.name === tab.name,
							) && (
								<span className="text-xs text-muted-foreground">
									{tab.libraryName}
								</span>
							)}
							{workbench.dirty(tab) && (
								<span
									aria-label="Unsaved changes"
									className="size-1.5 shrink-0 rounded-full bg-current"
									role="img"
								/>
							)}
						</button>
						<button
							aria-label={`Close ${tab.name}`}
							className="rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() =>
								workbench.dirty(tab) ? setClosing(tab.id) : close(tab.id)
							}
							type="button"
						>
							<X size={13} />
						</button>
						{dropTarget?.id === tab.id && (
							<span
								aria-hidden="true"
								className={`pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary ${dropTarget.after ? "right-0" : "left-0"}`}
							/>
						)}
					</div>
				))}
			</div>
			<p className="sr-only" id={helpId}>
				Drag tabs to reorder, or use Alt and the left or right arrow key. Use
				the arrow keys to switch models.
			</p>
			<Dialog
				onOpenChange={(open) => {
					if (!open && !saving) setClosing(undefined);
				}}
				open={!!closing}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unsaved model</DialogTitle>
						<DialogDescription>
							Save your changes before closing this model?
						</DialogDescription>
					</DialogHeader>
					{error && <p role="alert">{error}</p>}
					<DialogFooter>
						<Button
							disabled={saving}
							onClick={() => setClosing(undefined)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={saving}
							onClick={() => closing && close(closing)}
							variant="destructive"
						>
							Discard
						</Button>
						<Button
							disabled={saving}
							onClick={async () => {
								if (!closing) return;
								setSaving(true);
								setError("");
								try {
									await workbench.save(closing);
									close(closing);
								} catch (e) {
									setError(String(e));
								} finally {
									setSaving(false);
								}
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
