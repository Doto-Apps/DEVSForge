import {
	ArrowUp,
	CheckCircle2,
	FileCode2,
	FolderOpen,
	LoaderCircle,
	MessageSquare,
	Paperclip,
	Play,
	RotateCcw,
	Sparkles,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { integrationKey, useIntegrations } from "@/hooks/useIntegrations";
import { cn } from "@/lib/utils";
import { useGetLibraries } from "@/queries/library/useGetLibraries";
import { useGetModels } from "@/queries/model/useGetModels";
import { ImportDrafts } from "./ImportDrafts";
import { ImportPreview } from "./ImportPreview";

type Job = components["schemas"]["handler.ImportJob"];
type Turn = "discuss" | "adapt" | "test" | "restore";
function encode(
	file: File,
): Promise<components["schemas"]["handler.ImportFile"]> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			resolve({
				base64: String(reader.result).split(",")[1],
				name: file.webkitRelativePath || file.name,
			});
		reader.onerror = () => reject(Error(`Cannot read ${file.name}`));
		reader.readAsDataURL(file);
	});
}

export function ImportModels() {
	const [query, setQuery] = useSearchParams();
	const jobID = query.get("job");
	const [job, setJob] = useState<Job>();
	const [mode, setMode] = useState<"ai" | "iso">("ai");
	const [files, setFiles] = useState<File[]>([]);
	const [text, setText] = useState("");
	const [target, setTarget] = useState("");
	const [root, setRoot] = useState("");
	const [maxTime, setMaxTime] = useState("100");
	const [library, setLibrary] = useState("");
	const [reviewed, setReviewed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [pollEpoch, setPollEpoch] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [showSave, setShowSave] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const directory = useRef<HTMLInputElement>(null);
	const messagesEnd = useRef<HTMLDivElement>(null);
	const { data: integrations } = useIntegrations();
	const { data: libraries } = useGetLibraries();
	const { mutate } = useGetModels();
	const navigate = useNavigate();
	const running = busy || job?.state === "running";
	const models = job?.package?.models ?? [];
	const blocked = models.filter((m) => m.blockedReason);
	const ready = job?.state === "ready" && !!job.package;
	const roots = job?.package?.roots ?? [];
	const selectedRoot = roots.includes(root) ? root : (roots[0] ?? "");
	const horizonValid =
		Number.isFinite(Number(maxTime)) &&
		Number(maxTime) > 0 &&
		Number(maxTime) <= 1000000;
	useEffect(() => {
		directory.current?.setAttribute("webkitdirectory", "");
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A new turn or retry explicitly restarts polling for the same job.
	useEffect(() => {
		if (!jobID) {
			setJob(undefined);
			return;
		}
		let active = true;
		let timer: ReturnType<typeof setTimeout>;
		const poll = async () => {
			try {
				const result = await client.GET("/imports/{id}", {
					params: { path: { id: jobID } },
				});
				if (!active) return;
				if (!result.data || result.error)
					throw Error("Import unavailable. Retry or start a new import.");
				setJob(result.data);
				if (result.data.state === "running") timer = setTimeout(poll, 1200);
			} catch (e) {
				if (active) setError(String(e));
			}
		};
		void poll();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [jobID, pollEpoch]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Scroll only for new messages and progress changes.
	useEffect(() => {
		messagesEnd.current?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	}, [job?.messages?.length, job?.progress]);
	const analyze = async () => {
		setBusy(true);
		setError("");
		try {
			if (
				!files.length ||
				files.length > 500 ||
				files.reduce((s, f) => s + f.size, 0) > 12 * 1024 * 1024
			)
				throw Error(
					"Choose up to 500 files and 12 MB, including archive contents.",
				);
			const { data, error } = await client.POST("/imports", {
				body: {
					files: await Promise.all(files.map(encode)),
					instructions: text,
					mode,
				},
			});
			if (error || !data?.id)
				throw Error(
					"Analysis could not start. Check the import service and AI settings.",
				);
			setJob(data);
			setQuery({ job: data.id });
			setText("");
			setReviewed(false);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	};
	const turn = async (action: Turn, instructions = text) => {
		if (!jobID || running) return;
		setBusy(true);
		setError("");
		try {
			if ((action === "test" || action === "adapt") && !horizonValid)
				throw Error(
					"Choose a simulation horizon greater than 0 and no greater than 1,000,000.",
				);
			const selected = integrations.find((d) => integrationKey(d) === target);
			if (action === "adapt" && !selected)
				throw Error("Choose the framework you want to run on.");
			const { data, error } = await client.POST("/imports/{id}/turns", {
				body: {
					action,
					instructions,
					maxTime: Number(maxTime) || 100,
					rootId: selectedRoot,
					...(action === "adapt" && selected
						? {
								targetIntegrationId: selected.id,
								targetIntegrationVersion: selected.version,
							}
						: {}),
				},
				params: { path: { id: jobID } },
			});
			if (error || !data)
				throw Error(
					"This step could not start. Check your AI settings or retry. Your draft is preserved.",
				);
			setJob(data);
			setText("");
			setReviewed(false);
			setShowSave(false);
			setPollEpoch((n) => n + 1);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	};
	const discard = async () => {
		setBusy(true);
		setError("");
		try {
			if (jobID) {
				const { response } = await client.DELETE("/imports/{id}", {
					params: { path: { id: jobID } },
				});
				if (!response.ok && response.status !== 404)
					throw Error("Could not discard the import. Retry.");
			}
			setQuery({});
			setJob(undefined);
			setReviewed(false);
			setShowSave(false);
			setText("");
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	};
	const save = async () => {
		if (!jobID) return;
		setBusy(true);
		setError("");
		try {
			const { data, error } = await client.POST("/imports/{id}/commit", {
				body: { libraryId: library, reviewed, revision: job?.revision },
				params: { path: { id: jobID } },
			});
			if (error || !data)
				throw Error(
					"Could not save the import. Check the destination and retry.",
				);
			await mutate();
			navigate(
				data.rootIds?.[0]
					? `/library/${library}/model/${data.rootIds[0]}?layout=import`
					: `/library/${library}`,
			);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="flex h-screen min-w-0 flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Import models" }]}
				showModeToggle
				showNavActions={false}
			/>
			<input
				aria-label="Files or ZIP archive"
				className="hidden"
				multiple
				onChange={(e) => {
					setFiles(Array.from(e.target.files ?? []));
					e.target.value = "";
				}}
				ref={fileInput}
				type="file"
			/>
			<input
				aria-label="Folder"
				className="hidden"
				multiple
				onChange={(e) => {
					setFiles(Array.from(e.target.files ?? []));
					e.target.value = "";
				}}
				ref={directory}
				type="file"
			/>
			<div className="flex min-h-0 flex-1 flex-col overflow-auto xl:flex-row xl:overflow-hidden">
				<main className="flex min-h-[65vh] min-w-0 shrink-0 flex-col xl:min-h-0 xl:flex-1">
					<header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
						<div>
							<h1 className="text-lg font-semibold">Import workspace</h1>
							<p className="text-xs text-muted-foreground">
								Understand, adapt and verify your models.
							</p>
						</div>
						{jobID && (
							<Button
								disabled={busy}
								onClick={() => void discard()}
								size="sm"
								variant="ghost"
							>
								<X className="mr-2 size-4" />
								{running ? "Stop and discard" : "Discard import"}
							</Button>
						)}
					</header>
					<div
						aria-label="Import conversation"
						className="flex-1 space-y-6 overflow-y-auto px-4 py-8 sm:px-8"
						role="log"
					>
						{!jobID ? (
							<section className="mx-auto max-w-2xl space-y-6 pt-4 sm:pt-12">
								<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
									<Sparkles className="size-6 text-primary" />
								</div>
								<ImportDrafts
									onResume={(id) => {
										setError("");
										setReviewed(false);
										setShowSave(false);
										setText("");
										setQuery({ job: id });
									}}
								/>
								<div>
									<h2 className="text-3xl font-semibold tracking-tight">
										Bring your models with you.
									</h2>
									<p className="mt-3 text-muted-foreground">
										Drop a project, an archive or a single model. We will
										recover its structure, explain what can run, and help you
										with the rest.
									</p>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									{(["ai", "iso"] as const).map((value) => (
										<button
											aria-pressed={mode === value}
											className={cn(
												"rounded-xl border p-4 text-left transition-colors",
												mode === value
													? "border-primary bg-primary/5"
													: "hover:bg-muted/50",
											)}
											key={value}
											onClick={() => setMode(value)}
											type="button"
										>
											<span className="block text-sm font-semibold">
												{value === "ai"
													? "Explore with AI"
													: "Standard ISO package"}
											</span>
											<span className="mt-1 block text-xs text-muted-foreground">
												{value === "ai"
													? "Code, folders and unfamiliar formats"
													: "Read a supported ISO JSON package directly"}
											</span>
										</button>
									))}
								</div>
								<section
									aria-label="Upload files"
									className={cn(
										"rounded-xl border-2 border-dashed p-7 text-center",
										dragging && "border-primary bg-primary/5",
									)}
									onDragLeave={() => setDragging(false)}
									onDragOver={(e) => {
										e.preventDefault();
										setDragging(true);
									}}
									onDrop={(e) => {
										e.preventDefault();
										setDragging(false);
										setFiles(Array.from(e.dataTransfer.files));
									}}
								>
									<Upload className="mx-auto mb-3 size-6 text-muted-foreground" />
									<p className="text-sm">Drop your files here</p>
									<div className="mt-4 flex flex-wrap justify-center gap-2">
										<Button
											onClick={() => fileInput.current?.click()}
											variant="outline"
										>
											<Paperclip className="mr-2 size-4" />
											Choose files
										</Button>
										{mode === "ai" && (
											<Button
												onClick={() => directory.current?.click()}
												variant="outline"
											>
												<FolderOpen className="mr-2 size-4" />
												Choose folder
											</Button>
										)}
									</div>
									<p className="mt-3 text-xs text-muted-foreground">
										Up to 500 files and 12 MB, including archive contents
									</p>
								</section>
								{files.length > 0 && (
									<div className="flex flex-wrap gap-2">
										{files.slice(0, 8).map((file, index) => (
											<Badge
												className="max-w-full gap-2 py-1.5"
												key={file.webkitRelativePath || file.name}
												variant="secondary"
											>
												<FileCode2 className="size-3 shrink-0" />
												<span className="truncate">{file.name}</span>
												<button
													aria-label={`Remove ${file.name}`}
													onClick={() =>
														setFiles(files.filter((_, i) => i !== index))
													}
													type="button"
												>
													<X className="size-3" />
												</button>
											</Badge>
										))}
										{files.length > 8 && (
											<span className="text-xs">+{files.length - 8} files</span>
										)}
									</div>
								)}
							</section>
						) : (
							<div className="mx-auto max-w-3xl space-y-6">
								{!job?.messages?.length && (
									<p className="text-sm text-muted-foreground">
										{job?.progress || "Opening your import…"}
									</p>
								)}
								{job?.messages?.map((message) => (
									<article
										className={cn(
											"max-w-full",
											message.role === "user" &&
												"ml-auto w-fit max-w-[90%] rounded-2xl bg-muted px-4 py-3",
											message.role === "system" &&
												"rounded-lg border border-dashed p-3 text-muted-foreground",
										)}
										key={message.id}
									>
										<p className="mb-1 text-xs font-medium text-muted-foreground">
											{message.role === "user"
												? "You"
												: message.role === "system"
													? "Verification"
													: "Import assistant"}
										</p>
										<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
											{message.content}
										</p>
									</article>
								))}
								{job?.error && (
									<p
										className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
										role="alert"
									>
										{job.error}
									</p>
								)}
								{running && (
									<div
										aria-live="polite"
										className="flex items-center gap-3 rounded-xl border p-4"
										role="status"
									>
										<LoaderCircle className="size-4 shrink-0 animate-spin" />
										<p className="text-sm">
											{job?.progress || "Preparing your files…"}
										</p>
									</div>
								)}
								{ready && !running && (
									<div className="flex flex-wrap gap-2">
										<Button
											onClick={() =>
												void turn(
													"discuss",
													"Explain what prevents these models from running, using the files and verification results. Propose the smallest adaptation that preserves behavior.",
												)
											}
											size="sm"
											variant="outline"
										>
											<MessageSquare className="mr-2 size-4" />
											Explain the report
										</Button>
										<Button
											onClick={() => setShowSave(true)}
											size="sm"
											variant="outline"
										>
											<CheckCircle2 className="mr-2 size-4" />
											Keep this version
										</Button>
									</div>
								)}
								<div ref={messagesEnd} />
							</div>
						)}
					</div>
					<div className="shrink-0 border-t bg-background px-4 py-4 sm:px-8">
						<div className="mx-auto max-w-3xl">
							{error && (
								<div
									className="mb-3 flex flex-wrap items-center gap-2 text-sm text-destructive"
									role="alert"
								>
									<p className="min-w-0 flex-1 break-words">{error}</p>
									{jobID && (
										<Button
											onClick={() => {
												setError("");
												setPollEpoch((n) => n + 1);
											}}
											size="sm"
											variant="ghost"
										>
											Retry
										</Button>
									)}
								</div>
							)}
							<form
								className="rounded-2xl border bg-card p-2 shadow-sm"
								onSubmit={(e) => {
									e.preventDefault();
									if (!running) void (jobID ? turn("discuss") : analyze());
								}}
							>
								<Label className="sr-only" htmlFor="import-message">
									Message to the import assistant
								</Label>
								<Textarea
									className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
									disabled={running}
									id="import-message"
									maxLength={12000}
									onChange={(e) => setText(e.target.value)}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" &&
											!e.shiftKey &&
											!e.nativeEvent.isComposing
										) {
											e.preventDefault();
											if (!running && (jobID ? text.trim() : files.length))
												void (jobID ? turn("discuss") : analyze());
										}
									}}
									placeholder={
										jobID
											? "Ask about the report, explain your goal, or answer the assistant…"
											: "What would you like to import? Add context if you have it…"
									}
									value={text}
								/>
								<div className="flex items-center justify-between gap-3 px-2 pb-1">
									<span className="text-xs text-muted-foreground">
										{jobID
											? "Discuss first. Adaptations are a separate action."
											: `${files.length} file${files.length === 1 ? "" : "s"} selected`}
									</span>
									<Button
										aria-label={jobID ? "Send message" : "Analyze files"}
										disabled={running || (jobID ? !text.trim() : !files.length)}
										size="icon"
										type="submit"
									>
										{running ? (
											<LoaderCircle className="size-4 animate-spin" />
										) : (
											<ArrowUp className="size-4" />
										)}
									</Button>
								</div>
							</form>
							<p className="mt-2 text-center text-xs text-muted-foreground">
								{jobID ? (
									"Drafts and conversations are retained for 7 days. Nothing is added to your library until you save."
								) : (
									<>
										AI uses your provider and API key in{" "}
										<Link className="underline" to="/settings">
											Settings
										</Link>
										. ISO reading and simulation verification do not require AI.
									</>
								)}
							</p>
						</div>
					</div>
				</main>
				{job?.package && (
					<aside
						aria-label="Import draft and verification"
						className="w-full shrink-0 space-y-5 border-t bg-muted/15 p-5 xl:w-[390px] xl:overflow-y-auto xl:border-l xl:border-t-0 2xl:w-[440px]"
					>
						<ImportPreview job={job} />
						<section className="space-y-3 rounded-xl border bg-card p-4">
							<h2 className="text-sm font-semibold">Make it executable</h2>
							<p className="text-xs text-muted-foreground">
								Test the current draft, or adapt it to an installed framework.
								Adaptation can change code; original files remain available.
							</p>
							<Label htmlFor="verification-root">Model to verify</Label>
							<select
								className="h-9 w-full rounded-md border bg-background px-2 text-sm"
								disabled={running}
								id="verification-root"
								onChange={(e) => setRoot(e.target.value)}
								value={selectedRoot}
							>
								{roots.map((id) => (
									<option key={id} value={id}>
										{models.find((m) => m.id === id)?.name || id}
									</option>
								))}
							</select>
							<Label htmlFor="verification-time">Simulation horizon</Label>
							<input
								className="h-9 w-full rounded-md border bg-background px-3 text-sm"
								disabled={running}
								id="verification-time"
								max="1000000"
								min="0.001"
								onChange={(e) => setMaxTime(e.target.value)}
								step="any"
								type="number"
								value={maxTime}
							/>
							<Button
								className="w-full"
								disabled={running || !ready || !horizonValid}
								onClick={() => void turn("test", "")}
								variant="outline"
							>
								<Play className="mr-2 size-4" />
								Verify this version
							</Button>
							<Label htmlFor="convert-target">Target framework</Label>
							<select
								className="h-9 w-full rounded-md border bg-background px-2 text-sm"
								disabled={running}
								id="convert-target"
								onChange={(e) => setTarget(e.target.value)}
								value={target}
							>
								<option value="">Choose a framework</option>
								{integrations
									.filter(
										(d) => d.capabilities?.ai && d.capabilities?.simulation,
									)
									.map((d) => (
										<option key={integrationKey(d)} value={integrationKey(d)}>
											{d.name} · {d.language}
										</option>
									))}
							</select>
							<Button
								className="w-full"
								disabled={running || !ready || !target || !horizonValid}
								onClick={() => void turn("adapt")}
							>
								<Sparkles className="mr-2 size-4" />
								Adapt and verify
							</Button>
							<p className="text-xs text-muted-foreground">
								Up to 3 attempts per adaptation. Each simulation is limited to
								90 seconds. Passing does not prove behavioral equivalence.
							</p>
							{(job.revision ?? 0) > 1 && (
								<Button
									disabled={running}
									onClick={() => void turn("restore", "")}
									size="sm"
									variant="ghost"
								>
									<RotateCcw className="mr-2 size-3" />
									Restore original draft
								</Button>
							)}
						</section>
						{showSave ? (
							<section className="space-y-4 rounded-xl border bg-card p-4">
								<h2 className="font-semibold">Save this version</h2>
								<Label htmlFor="import-library">Destination library</Label>
								<select
									className="h-9 w-full rounded-md border bg-background px-2 text-sm"
									id="import-library"
									onChange={(e) => setLibrary(e.target.value)}
									value={library}
								>
									<option value="">Select a library</option>
									{libraries?.map((l) => (
										<option key={l.id} value={l.id}>
											{l.title}
										</option>
									))}
								</select>
								<Link className="block text-xs underline" to="/library/new">
									Create a library
								</Link>
								<label className="flex gap-3 text-sm">
									<input
										checked={reviewed}
										onChange={(e) => setReviewed(e.target.checked)}
										type="checkbox"
									/>
									<span>
										I reviewed the models, changes and verification results.
									</span>
								</label>
								{blocked.length > 0 && (
									<p className="text-xs text-amber-700 dark:text-amber-400">
										Some models are available for editing only.
									</p>
								)}
								<Button
									className="w-full"
									disabled={running || !ready || !library || !reviewed}
									onClick={() => void save()}
								>
									<Upload className="mr-2 size-4" />
									Import reviewed models
								</Button>
							</section>
						) : (
							<Button
								className="w-full"
								disabled={running || !ready}
								onClick={() => setShowSave(true)}
								variant="outline"
							>
								Keep this version
							</Button>
						)}
					</aside>
				)}
			</div>
		</div>
	);
}
