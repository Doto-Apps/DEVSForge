import * as monaco from "monaco-editor";
import {
	createModelReference,
	deleteFile,
} from "@codingame/monaco-vscode-api/monaco";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { initServices } from "monaco-languageclient/vscode/services";
import getFilesServiceOverride from "@codingame/monaco-vscode-files-service-override";
import getEditorServiceOverride from "@codingame/monaco-vscode-editor-service-override";
import { MonacoLanguageClient } from "monaco-languageclient";
import { CloseAction, ErrorAction } from "vscode-languageclient/browser.js";
import {
	toSocket,
	WebSocketMessageReader,
	WebSocketMessageWriter,
} from "vscode-ws-jsonrpc";
import type { WorkspaceEdit } from "vscode";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
// These imports load only Monarch grammars, not another editor runtime.
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as python from "monaco-languages/esm/vs/basic-languages/python/python.js";
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as java from "monaco-languages/esm/vs/basic-languages/java/java.js";
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as go from "monaco-languages/esm/vs/basic-languages/go/go.js";

type Session = components["schemas"]["handler.LSPSessionResponse"] & {
	documentId?: string;
	status?: string;
};
type SessionRequest = components["schemas"]["handler.LSPSessionRequest"] & {
	workbenchId?: string;
	documentId?: string;
};
const targets = new Map<string, () => Promise<monaco.editor.ICodeEditor>>();
let ready: Promise<unknown> | undefined;
export function initializeEditor() {
	ready ??= initServices(
		{
			serviceOverrides: {
				...getFilesServiceOverride(),
				...getEditorServiceOverride(async (reference, options) => {
					const editor = await targets.get(
						reference.object.textEditorModel.uri.toString(),
					)?.();
					const selection = (
						options as { selection?: monaco.IRange } | undefined
					)?.selection;
					if (editor && selection) {
						editor.setSelection(selection);
						editor.revealRangeInCenter(selection);
					}
					return editor;
				}),
			},
			viewsConfig: { viewServiceType: "EditorService" },
		},
		{
			monacoWorkerFactory: () => {
				window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
			},
		},
	).then(() => {
		for (const [id, grammar] of Object.entries({ python, java, go })) {
			monaco.languages.register({ id });
			monaco.languages.setMonarchTokensProvider(id, grammar.language);
			monaco.languages.setLanguageConfiguration(id, grammar.conf);
		}
	});
	return ready;
}
export function ensureLanguage(id: string | undefined) {
	if (
		id &&
		!monaco.languages.getLanguages().some((language) => language.id === id)
	)
		monaco.languages.register({ id });
}
function apiURL(path: string) {
	return new URL(
		`${window.API_URL.replace(/\/$/, "")}${path}`,
		window.location.href,
	);
}
export type EditorSession = {
	session: Session;
	model: monaco.editor.ITextModel;
	disposeDocument: () => void;
	touch: () => void;
	stop: () => Promise<void>;
};
type Pool = {
	scope: string;
	touch?: () => void;
	session: Session;
	closed: boolean;
	models: Map<
		string,
		{
			model: monaco.editor.ITextModel;
			reference: Awaited<ReturnType<typeof createModelReference>>;
			documentId: string;
			modelId: string;
		}
	>;
	observers: Set<(reason?: string) => void>;
	source?: (
		model: monaco.editor.ITextModel,
	) => Promise<monaco.editor.ICodeEditor>;
	stop: () => Promise<void>;
};
const fallbackModels = new Map<string, monaco.editor.ITextModel>();
export function fallbackDocument(
	scope: string,
	id: string,
	code: string,
	language?: string,
) {
	const key = `${scope}|${id}`;
	let model = fallbackModels.get(key);
	if (!model || model.isDisposed()) {
		model = monaco.editor.createModel(
			code,
			language,
			monaco.Uri.parse(
				`inmemory://devsforge/${encodeURIComponent(scope)}/${encodeURIComponent(id)}`,
			),
		);
		fallbackModels.set(key, model);
	} else if (model.getValue() !== code) {
		model.pushStackElement();
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: code }],
			() => null,
		);
		model.pushStackElement();
	}
	return model;
}
function forgetFallback(scope: string, id?: string) {
	for (const [key, model] of fallbackModels) {
		if (!key.startsWith(`${scope}|`) || (id && key !== `${scope}|${id}`))
			continue;
		model.dispose();
		fallbackModels.delete(key);
	}
}
const pools = new Map<string, Promise<Pool>>();
const controllers = new Map<string, AbortController>();
const pendingSessions = new Map<string, Session>();
const acquiring = new Map<string, SessionRequest>();
const archived = new Set<Pool>();
const closingDocuments = new Map<string, Promise<void>>();
function poolKey(req: SessionRequest) {
	return `${req.workbenchId ?? "legacy"}|${req.integrationId}|${req.integrationVersion}`;
}
async function requestDocument(
	req: SessionRequest,
	signal?: AbortSignal,
): Promise<Session> {
	const response = await client.POST("/lsp/sessions", { body: req, signal });
	if (!response.data) {
		const error = response.error as { error?: string } | undefined;
		throw new Error(
			error?.error ??
				(response.response.status === 429
					? "Language service queue is full. Please retry shortly."
					: `Language assistance failed (${response.response.status}). Editing remains available.`),
		);
	}
	return response.data;
}
async function startPool(
	req: SessionRequest,
	signal: AbortSignal,
): Promise<Pool> {
	let session = await requestDocument(req, signal);
	pendingSessions.set(poolKey(req), session);
	const connections: MonacoLanguageClient[] = [];
	const engines = new Map<string, MonacoLanguageClient>();
	const sockets: WebSocket[] = [];
	const loaded = new Map<string, string>();
	const pool: Pool = {
		scope: req.workbenchId ?? "legacy",
		session,
		closed: false,
		models: new Map(),
		observers: new Set(),
		stop: () => stop(),
	};
	archived.add(pool);
	const onSource = (model: monaco.editor.ITextModel) => {
		if (!pool.source) throw new Error("Editor is not active");
		return pool.source(model);
	};
	const onClosed = (reason?: string) => {
		pool.closed = true;
		pools.delete(poolKey(req));
		for (const cb of pool.observers) cb(reason);
	};
	let stopped = false;
	let failureReason = "";
	ensureLanguage(session.language);
	const resource = monaco.Uri.parse(session.documentUri ?? "");
	let reference: Awaited<ReturnType<typeof createModelReference>>;
	try {
		reference = await createModelReference(resource, req.code ?? "");
	} catch (error) {
		await client
			.DELETE("/lsp/sessions/{id}", {
				params: { path: { id: session.id ?? "" } },
			})
			.catch(() => undefined);
		throw error;
	}
	const document = reference.object.textEditorModel;
	if (!document) {
		await client
			.DELETE("/lsp/sessions/{id}", {
				params: { path: { id: session.id ?? "" } },
			})
			.catch(() => undefined);
		reference.dispose();
		throw new Error("Editor document could not be created");
	}
	monaco.editor.setModelLanguage(document, session.language ?? "plaintext");
	pool.models.set(req.documentId ?? req.modelId ?? "draft", {
		model: document,
		reference,
		documentId: session.documentId ?? "",
		modelId: req.modelId ?? req.documentId ?? "",
	});
	const disposeDocument = () => {
		reference.dispose();
		document.dispose();
		void deleteFile(resource).catch(() => undefined);
	};
	async function loadLocations(value: unknown): Promise<void> {
		const items = Array.isArray(value) ? value : [value];
		for (const item of items) {
			if (!item || typeof item !== "object") continue;
			const location = item as {
				uri?: { toString(): string };
				targetUri?: { toString(): string };
			};
			const uri = (location.uri ?? location.targetUri)?.toString();
			if (
				!uri ||
				[...pool.models.values()].some((d) => d.model.uri.toString() === uri)
			)
				continue;
			const known = loaded.get(uri);
			if (known) {
				if (location.uri) location.uri = monaco.Uri.parse(known);
				else location.targetUri = monaco.Uri.parse(known);
				continue;
			}
			let text: string | undefined;
			if (uri.startsWith("jdt:")) {
				const java = engines.get("jdtls");
				text = await java?.sendRequest<string>("java/classFileContents", {
					uri,
				});
			} else {
				const result = await client.GET("/lsp/sessions/{id}/file", {
					params: { path: { id: session.id ?? "" }, query: { uri } },
					parseAs: "text",
				});
				if (typeof result.data === "string") text = result.data;
			}
			if (text === undefined || stopped) continue;
			const concurrent = loaded.get(uri);
			if (concurrent) {
				if (location.uri) location.uri = monaco.Uri.parse(concurrent);
				else location.targetUri = monaco.Uri.parse(concurrent);
				continue;
			}
			const name = monaco.Uri.parse(uri).path.split("/").pop() ?? "Source";
			const alias = monaco.Uri.from({
				scheme: "inmemory",
				authority: "devsforge-sources",
				path: `/${session.id}/${loaded.size}/${name}`,
			});
			const model = monaco.editor.createModel(text, session.language, alias);
			loaded.set(uri, alias.toString());
			targets.set(alias.toString(), () => onSource(model));
			if (location.uri) location.uri = alias;
			else location.targetUri = alias;
		}
	}
	const writable = (edit: WorkspaceEdit | null | undefined) =>
		!edit ||
		edit
			.entries()
			.every(([uri]) =>
				[...pool.models.values()].some(
					(d) => d.model.uri.toString() === uri.toString(),
				),
			);
	async function stop(release = true) {
		if (stopped) return;
		stopped = true;
		pool.closed = true;
		if (release)
			await Promise.allSettled(
				connections
					.filter((_, i) => sockets[i]?.readyState === WebSocket.OPEN)
					.map((c) => c.stop()),
			);
		for (const socket of sockets) socket.close();
		if (!release) for (const connection of connections) connection.dispose();
		for (const uri of loaded.values()) {
			targets.delete(uri);
			monaco.editor.getModel(monaco.Uri.parse(uri))?.dispose();
		}
		if (release)
			await client
				.DELETE("/lsp/sessions/{id}", {
					params: { path: { id: session.id ?? "" } },
				})
				.catch(() => undefined);
	}
	signal.addEventListener(
		"abort",
		() => {
			void stop();
		},
		{ once: true },
	);
	try {
		while (session.status === "queued") {
			if (signal.aborted)
				throw new DOMException("Workspace closed", "AbortError");
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, 750);
				signal.addEventListener(
					"abort",
					() => {
						clearTimeout(timer);
						reject(new DOMException("Workspace closed", "AbortError"));
					},
					{ once: true },
				);
			});
			const result = await client.GET("/lsp/sessions/{id}", {
				params: { path: { id: session.id ?? "" } },
				signal,
			});
			if (!result.data)
				throw new Error("Language workspace is no longer available");
			session.status = String(result.data.status ?? "queued");
		}
		const fresh = await client.POST("/lsp/sessions/{id}/tickets", {
			params: { path: { id: session.id ?? "" } },
			signal,
		});
		if (fresh.data) session.servers = fresh.data.servers;
		for (const engine of session.servers ?? []) {
			const url = apiURL(engine.url ?? "");
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			const socket = new WebSocket(url);
			sockets.push(socket);
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					socket.close();
					reject(new Error("Language server connection timed out"));
				}, 15000);
				socket.onopen = () => {
					clearTimeout(timeout);
					resolve();
				};
				socket.onclose = (event) => {
					clearTimeout(timeout);
					reject(
						new Error(event.reason || "Language server connection closed"),
					);
				};
				socket.onerror = () => {
					clearTimeout(timeout);
					reject(new Error("Language server connection failed"));
				};
			});
			const transport = toSocket(socket);
			const languageClient = new MonacoLanguageClient({
				id: `${session.id}-${engine.id}`,
				name: `${engine.id} language assistance`,
				messageTransports: {
					reader: new WebSocketMessageReader(transport),
					writer: new WebSocketMessageWriter(transport),
				},
				clientOptions: {
					errorHandler: {
						error: () => ({ action: ErrorAction.Continue }),
						closed: () => ({ action: CloseAction.DoNotRestart }),
					},
					documentSelector: [
						{
							language: session.language,
							scheme: "file",
							pattern: `${monaco.Uri.parse(session.workspaceUri ?? "").path}/**`,
						},
					],
					workspaceFolder: {
						uri: monaco.Uri.parse(session.workspaceUri ?? ""),
						name: req.modelName ?? "Model",
						index: 0,
					},
					middleware: {
						provideDefinition: async (document, position, token, next) => {
							const result = await next(document, position, token);
							await loadLocations(result);
							return result;
						},
						provideReferences: async (
							document,
							position,
							options,
							token,
							next,
						) => {
							const result = await next(document, position, options, token);
							await loadLocations(result);
							return result;
						},
						provideRenameEdits: async (
							document,
							position,
							name,
							token,
							next,
						) => {
							const edit = await next(document, position, name, token);
							return writable(edit) ? edit : null;
						},
						provideCodeActions: async (
							document,
							range,
							context,
							token,
							next,
						) => {
							const actions = await next(document, range, context, token);
							return actions?.filter((action) => {
								const command =
									"command" in action
										? typeof action.command === "string"
											? action.command
											: action.command?.command
										: undefined;
								return (
									(!command ||
										(engine.allowedCommands ?? []).includes(command)) &&
									(!("edit" in action) || writable(action.edit))
								);
							});
						},
					},
				},
			});
			connections.push(languageClient);
			engines.set(engine.id ?? "", languageClient);
			socket.addEventListener("close", (event) => {
				if (event.reason) failureReason = `${engine.id}: ${event.reason}`;
				if (!stopped) {
					void stop(false);
					onClosed(event.reason);
				}
			});
			await languageClient.start();
		}
		const touch = () => {
			if (stopped) return;
			void connections[0]
				?.sendNotification("devsforge/userActivity", {})
				.catch(() => undefined);
		};
		pool.touch = touch;
		return pool;
	} catch (error) {
		await stop();
		disposeDocument();
		throw failureReason ? new Error(failureReason) : error;
	}
}
export async function connectEditor(
	req: SessionRequest,
	onSource: (
		model: monaco.editor.ITextModel,
	) => Promise<monaco.editor.ICodeEditor>,
	onClosed: (reason?: string) => void,
	signal?: AbortSignal,
	onStatus?: (message: string) => void,
): Promise<EditorSession> {
	await closingDocuments.get(
		`${req.workbenchId}|${req.modelId ?? req.documentId}`,
	);
	const key = poolKey(req);
	let pending = pools.get(key);
	if (!pending) {
		const controller = new AbortController();
		controllers.set(key, controller);
		acquiring.set(key, req);
		pending = startPool(req, controller.signal).finally(() =>
			acquiring.delete(key),
		);
		pools.set(key, pending);
		pending.catch(() => pools.delete(key));
	}
	const progress = setInterval(() => {
		const state = pendingSessions.get(key)?.status;
		onStatus?.(
			state === "queued"
				? "Waiting for language service capacity…"
				: "Starting language assistance…",
		);
	}, 500);
	let pool: Pool;
	try {
		pool = await pending;
	} finally {
		clearInterval(progress);
	}
	if (pool.closed)
		throw new Error("Language workspace stopped. Retry to reconnect.");
	if (signal?.aborted) throw new DOMException("Editor closed", "AbortError");
	const docKey = req.documentId ?? req.modelId ?? "draft";
	let doc = pool.models.get(docKey);
	if (!doc) {
		const session = await requestDocument(req, signal);
		if (session.id !== pool.session.id) {
			await pool.stop();
			pools.delete(key);
			throw new Error(
				"Language workspace expired. Retry to reconnect using your current buffer.",
			);
		}
		const reference = await createModelReference(
			monaco.Uri.parse(session.documentUri ?? ""),
			req.code ?? "",
		);
		const model = reference.object.textEditorModel;
		if (!model) {
			reference.dispose();
			throw new Error("Document unavailable");
		}
		monaco.editor.setModelLanguage(model, session.language ?? "plaintext");
		doc = {
			model,
			reference,
			documentId: session.documentId ?? "",
			modelId: req.modelId ?? req.documentId ?? "",
		};
		pool.models.set(docKey, doc);
	}
	pool.source = onSource;
	pool.observers.add(onClosed);
	const stop = async () => {
		for (const old of archived) {
			if (!old.closed) continue;
			for (const [id, doc] of old.models) {
				if (monaco.editor.getEditors().some((e) => e.getModel() === doc.model))
					continue;
				doc.reference.dispose();
				doc.model.dispose();
				old.models.delete(id);
			}
			if (!old.models.size) archived.delete(old);
		}
		pool.observers.delete(onClosed);
		if (pool.source === onSource) pool.source = undefined;
	};
	signal?.addEventListener(
		"abort",
		() => {
			void stop();
		},
		{ once: true },
	);
	return {
		session: pool.session,
		model: doc.model,
		disposeDocument: () => {},
		touch: () => pool.touch?.(),
		stop,
	};
}
async function detachEditorDocument(workbenchId: string, modelId: string) {
	forgetFallback(workbenchId, modelId);
	for (const [key, pending] of pools) {
		if (!key.startsWith(workbenchId + "|")) continue;
		const request = acquiring.get(key);
		if (
			request &&
			(request.modelId === modelId || request.documentId === modelId)
		) {
			controllers.get(key)?.abort();
			continue;
		}
		const pool = await pending.catch(() => undefined);
		if (!pool) continue;
		for (const [docKey, doc] of pool.models) {
			if (doc.modelId !== modelId && docKey !== modelId) continue;
			await fetch(
				apiURL(`/lsp/sessions/${pool.session.id}/documents/${doc.documentId}`),
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
					},
				},
			);
			doc.reference.dispose();
			doc.model.dispose();
			pool.models.delete(docKey);
		}
	}
}
export function closeEditorDocument(workbenchId: string, modelId: string) {
	const key = `${workbenchId}|${modelId}`;
	const pending = detachEditorDocument(workbenchId, modelId)
		.catch(() => undefined)
		.finally(() => closingDocuments.delete(key));
	closingDocuments.set(key, pending);
	return pending;
}
export async function closeWorkbench(workbenchId: string) {
	forgetFallback(workbenchId);
	for (const [key, controller] of controllers) {
		if (key.startsWith(workbenchId + "|")) {
			controller.abort();
			controllers.delete(key);
			pendingSessions.delete(key);
		}
	}
	for (const [key, pending] of pools) {
		if (!key.startsWith(workbenchId + "|")) continue;
		pools.delete(key);
		const pool = await pending.catch(() => undefined);
		if (pool) {
			await pool.stop();
			for (const doc of pool.models.values()) {
				doc.reference.dispose();
				doc.model.dispose();
			}
			archived.delete(pool);
		}
	}
	for (const pool of archived) {
		if (pool.scope !== workbenchId) continue;
		for (const doc of pool.models.values()) {
			if (doc.model.isDisposed()) continue;
			doc.reference.dispose();
			doc.model.dispose();
		}
		archived.delete(pool);
	}
}

export { monaco };
