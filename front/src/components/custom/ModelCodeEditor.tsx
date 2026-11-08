import { useOptionalWorkbench } from "@/providers/WorkbenchProvider";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import type { EditorSession } from "@/lib/lsp/client";

const viewStates = new Map<string, Monaco.editor.ICodeEditorViewState>();

type ModelCodeEditorProps = {
	code: string;
	onCodeChange: (code: string, modelId: string) => void;
	modelId: string;
	language?: string;
	integrationId?: string;
	integrationVersion?: string;
	modelName?: string;
	draft?: boolean;
	workbenchId?: string;
	draftKey?: string;
};

export const ModelCodeEditor = ({
	code,
	onCodeChange,
	modelId,
	language,
	integrationId,
	integrationVersion,
	modelName,
	draft = false,
	workbenchId,
	draftKey,
}: ModelCodeEditorProps) => {
	const workbench = useOptionalWorkbench();
	const workbenchRef = useRef(workbench);
	workbenchRef.current = workbench;
	const scope = workbenchId ?? workbench?.id ?? "standalone";
	const viewKey = `${scope}|${draftKey ?? modelId}`;
	const host = useRef<HTMLDivElement>(null);
	const editor = useRef<Monaco.editor.IStandaloneCodeEditor>();
	const main = useRef<Monaco.editor.ITextModel>();
	const current = useRef({ code, onCodeChange });
	current.current = { code, onCodeChange };
	const [status, setStatus] = useState("Starting language assistance…");
	const [source, setSource] = useState(false);
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly requests a new language-server session.
	useEffect(() => {
		let disposed = false;
		let connection: EditorSession | undefined;
		let subscription: Monaco.IDisposable | undefined;
		const activitySubscriptions: Monaco.IDisposable[] = [];
		let runtime: typeof import("@/lib/lsp/client") | undefined;
		let connecting = false;
		let disposeDocument: (() => void) | undefined;
		let retryAfter = 0;
		const abort = new AbortController();

		async function start() {
			if (
				connecting ||
				disposed ||
				!integrationId ||
				!integrationVersion ||
				!runtime ||
				Date.now() < retryAfter
			)
				return;
			connecting = true;
			setStatus("Starting language assistance…");
			try {
				connection = await runtime.connectEditor(
					{
						modelId: draft ? undefined : modelId,
						workbenchId: scope,
						documentId: draft ? `draft:${draftKey ?? modelId}` : modelId,
						integrationId,
						integrationVersion,
						modelName: modelName ?? "MyModel",
						code: main.current?.getValue() ?? current.current.code,
					},
					async (model) => {
						const active = editor.current;
						if (!active) throw new Error("Editor closed");
						active.setModel(model);
						active.updateOptions({ readOnly: true });
						setSource(true);
						return active;
					},
					(reason) => {
						if (disposed) return;
						setStatus(
							reason ||
								"Language assistance stopped. Resume typing or retry to reconnect.",
						);
						connection = undefined;
						if (editor.current && main.current) {
							editor.current.setModel(main.current);
							editor.current.updateOptions({ readOnly: false });
							setSource(false);
						}
					},
					abort.signal,
					(message) => {
						if (!disposed) setStatus(message);
					},
				);
				if (disposed) {
					await connection.stop();
					connection.disposeDocument();
					return;
				}
				const old = main.current;
				const model = connection.model;
				if (model.getValue() !== current.current.code)
					model.setValue(current.current.code);
				main.current = model;
				editor.current?.setModel(model);
				const savedView =
					viewStates.get(viewKey) ??
					(workbenchRef.current?.drafts[`editor-view:${draftKey ?? modelId}`] as
						| Monaco.editor.ICodeEditorViewState
						| undefined);
				if (savedView) editor.current?.restoreViewState(savedView);
				editor.current?.updateOptions({ readOnly: false });
				setSource(false);
				disposeDocument?.();
				disposeDocument = connection.disposeDocument;
				if (old?.uri.scheme === "inmemory") old.dispose();
				setStatus("");
			} catch (error) {
				if (!disposed) {
					setStatus(
						error instanceof Error
							? error.message
							: "Language assistance unavailable",
					);
					retryAfter = Date.now() + 10000;
				}
			} finally {
				connecting = false;
			}
		}

		// Load the IDE libraries only when an editor is opened, not on the login page.
		import("@/lib/lsp/client")
			.then(async (module) => {
				runtime = module;
				await module.initializeEditor();
				module.ensureLanguage(language);
				if (disposed || !host.current) return;
				main.current = module.fallbackDocument(
					scope,
					draft ? `draft:${draftKey ?? modelId}` : modelId,
					current.current.code,
					language,
				);

				editor.current = module.monaco.editor.create(host.current, {
					model: main.current,
					automaticLayout: true,
					fontSize: 14,
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					theme: "vs-dark",
				});
				activitySubscriptions.push(
					editor.current.onKeyDown(() => connection?.touch()),
					editor.current.onMouseDown(() => connection?.touch()),
				);
				subscription = editor.current.onDidChangeModelContent(() => {
					const active = editor.current;
					if (!active || active.getModel() !== main.current) return;
					current.current.onCodeChange(active.getValue(), modelId);
					if (!connection && !connecting) void start();
				});
				void start();
			})
			.catch((error) => {
				if (!disposed) setStatus(String(error));
			});

		return () => {
			disposed = true;
			abort.abort();
			subscription?.dispose();
			for (const subscription of activitySubscriptions) subscription.dispose();
			const savedView = editor.current?.saveViewState();
			if (savedView) {
				viewStates.set(viewKey, savedView);
				workbenchRef.current?.setDraft(
					`editor-view:${draftKey ?? modelId}`,
					savedView,
				);
			}
			editor.current?.dispose();
			editor.current = undefined;
			disposeDocument?.();
			// Unavailable/queued assistance still keeps the local model and its undo stack.
			main.current = undefined;
			void connection?.stop();
		};
	}, [
		modelId,
		language,
		integrationId,
		integrationVersion,
		modelName,
		draft,
		scope,
		draftKey,
		attempt,
	]);

	useEffect(() => {
		const model = main.current;
		if (model && model.getValue() !== code) model.setValue(code);
	}, [code]);
	return (
		<div className="h-full min-h-0 flex flex-col overflow-hidden">
			{status && (
				<div role="status" className="text-xs text-muted-foreground px-2 py-1">
					{status}{" "}
					<button
						type="button"
						className="underline"
						onClick={() => setAttempt((v) => v + 1)}
					>
						Retry
					</button>
				</div>
			)}
			{source && (
				<button
					type="button"
					className="text-xs text-left px-2 py-1"
					onClick={() => {
						if (editor.current && main.current) {
							editor.current.setModel(main.current);
							editor.current.updateOptions({ readOnly: false });
							setSource(false);
						}
					}}
				>
					← Return to model (library source is read-only)
				</button>
			)}
			<div className="flex-1 min-h-0" ref={host} />
		</div>
	);
};
