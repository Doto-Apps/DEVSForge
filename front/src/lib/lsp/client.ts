import {
	createModelReference,
	deleteFile,
} from "@codingame/monaco-vscode-api/monaco";
import getEditorServiceOverride from "@codingame/monaco-vscode-editor-service-override";
import getFilesServiceOverride from "@codingame/monaco-vscode-files-service-override";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { MonacoLanguageClient } from "monaco-languageclient";
import { initServices } from "monaco-languageclient/vscode/services";
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as go from "monaco-languages/esm/vs/basic-languages/go/go.js";
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as java from "monaco-languages/esm/vs/basic-languages/java/java.js";
// @ts-expect-error Monaco grammar modules ship without declarations.
import * as python from "monaco-languages/esm/vs/basic-languages/python/python.js";
import type { WorkspaceEdit } from "vscode";
import {
	type ApplyWorkspaceEditParams,
	CloseAction,
	ErrorAction,
} from "vscode-languageclient/browser.js";
import {
	type AnalysisSources,
	type BrowserDocument,
	type BrowserEngine,
	BrowserWorkspace,
	type EditorRequest,
} from "./browser";

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
		for (const [id, grammar] of Object.entries({ go, java, python })) {
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

type Document = {
	model: monaco.editor.ITextModel;
	reference: Awaited<ReturnType<typeof createModelReference>>;
	project: BrowserDocument;
	engineIds: string[];
	subscription: monaco.IDisposable;
};
type SourceEditor = (
	model: monaco.editor.ITextModel,
) => Promise<monaco.editor.ICodeEditor>;
type Pool = {
	workspace: BrowserWorkspace;
	models: Map<string, Document>;
	clients: Map<
		string,
		{
			client: MonacoLanguageClient;
			engine: BrowserEngine;
			commands: monaco.IDisposable[];
		}
	>;
	sources: Map<string, monaco.editor.ITextModel>;
	observers: Set<(reason?: string) => void>;
	attaching: Promise<unknown>;
	source?: SourceEditor;
	closed: boolean;
};

class BrowserLanguageClient extends MonacoLanguageClient {
	override registerFeature(
		feature: Parameters<MonacoLanguageClient["registerFeature"]>[0],
	) {
		// Server command names are global in VS Code. Register our own scoped
		// aliases below so two local workspaces can run the same engine safely.
		if (
			"registrationType" in feature &&
			feature.registrationType.method === "workspace/executeCommand"
		)
			return;
		super.registerFeature(feature);
	}
}
export type EditorSession = {
	model: monaco.editor.ITextModel;
	stop(): Promise<void>;
};
const pools = new Map<string, Promise<Pool>>();
const archived = new Map<Pool, string>();
const fallbacks = new Map<string, monaco.editor.ITextModel>();
const closing = new Map<string, Promise<void>>();
const poolKey = (request: EditorRequest) =>
	`${request.workbenchId}|${request.integrationId}|${request.integrationVersion}`;

export function fallbackDocument(
	scope: string,
	id: string,
	code: string,
	language?: string,
) {
	const key = `${scope}|${id}`;
	let model = fallbacks.get(key);
	if (!model || model.isDisposed()) {
		model = monaco.editor.createModel(
			code,
			language,
			monaco.Uri.parse(
				`inmemory://devsforge/${encodeURIComponent(scope)}/${encodeURIComponent(id)}`,
			),
		);
		fallbacks.set(key, model);
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
	for (const [key, model] of fallbacks) {
		if (id ? key !== `${scope}|${id}` : !key.startsWith(`${scope}|`)) continue;
		if (!model.isDisposed()) model.dispose();
		fallbacks.delete(key);
	}
}

async function createPool(request: EditorRequest, key: string): Promise<Pool> {
	const url = `${window.API_URL.replace(/\/$/, "")}/integrations/${encodeURIComponent(request.integrationId)}/versions/${encodeURIComponent(request.integrationVersion)}/analysis`;
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Could not load modeling sources (${response.status})`);
	const definition = (await response.json()) as AnalysisSources;
	if (
		definition.integrationId !== request.integrationId ||
		definition.integrationVersion !== request.integrationVersion
	)
		throw new Error("Integration source version does not match the editor");
	const pool: Pool = {
		attaching: Promise.resolve(),
		clients: new Map(),
		closed: false,
		models: new Map(),
		observers: new Set(),
		sources: new Map(),
		workspace: new BrowserWorkspace(definition, (reason) => {
			if (pool.closed) return;
			for (const observer of pool.observers) observer(reason);
			pools.delete(key);
			archived.set(pool, request.workbenchId);
			void disposePool(pool, true);
		}),
	};
	return pool;
}

function writable(pool: Pool, edit: WorkspaceEdit | null | undefined) {
	return (
		!edit ||
		edit
			.entries()
			.every(([uri]) =>
				[...pool.models.values()].some(
					(document) => document.model.uri.toString() === uri.toString(),
				),
			)
	);
}
async function textEditsOnly(edit: WorkspaceEdit) {
	// Rebuild through the public API: file creation/rename/deletion operations
	// must never slip through an allowlist that checks only text-edit entries.
	const { WorkspaceEdit } = await import("vscode");
	const safe = new WorkspaceEdit();
	for (const [uri, edits] of edit.entries()) safe.set(uri, edits);
	return safe;
}
async function loadLocations(pool: Pool, value: unknown) {
	for (const item of Array.isArray(value) ? value : [value]) {
		if (!item || typeof item !== "object") continue;
		const location = item as { uri?: monaco.Uri; targetUri?: monaco.Uri };
		const uri = (location.uri ?? location.targetUri)?.toString();
		if (
			!uri ||
			[...pool.models.values()].some((d) => d.model.uri.toString() === uri)
		)
			continue;
		let source = pool.sources.get(uri);
		if (!source) {
			const text = await pool.workspace.read(uri);
			if (text === undefined || pool.closed) continue;
			source = pool.sources.get(uri);
			if (!source) {
				const name = monaco.Uri.parse(uri).path.split("/").pop() ?? "Source";
				const alias = monaco.Uri.from({
					authority: "devsforge-sources",
					path: `/${pool.workspace.id}/${pool.sources.size}/${name}`,
					scheme: "inmemory",
				});
				source = monaco.editor.createModel(
					text,
					pool.workspace.definition.language,
					alias,
				);
				pool.sources.set(uri, source);
				const model = source;
				targets.set(alias.toString(), async () => {
					if (!pool.source) throw new Error("Editor closed");
					return pool.source(model);
				});
			}
		}
		if (location.uri) location.uri = source.uri;
		else location.targetUri = source.uri;
	}
}

async function startEngine(pool: Pool, engine: BrowserEngine) {
	if (pool.clients.has(engine.id)) return;
	const aliases = new Map<string, string>();
	const commands: monaco.IDisposable[] = [];
	const scopedCommand = (command: { command: string } | undefined) => {
		if (command && aliases.has(command.command))
			command.command = aliases.get(command.command) ?? command.command;
	};
	const languageClient = new BrowserLanguageClient({
		clientOptions: {
			documentSelector: [
				{
					language: pool.workspace.definition.language,
					pattern: engine.pattern,
					scheme: "file",
				},
			],
			errorHandler: {
				closed: () => ({ action: CloseAction.DoNotRestart }),
				error: () => ({ action: ErrorAction.Continue }),
			},
			initializationOptions: engine.initializationOptions,
			middleware: {
				provideCodeActions: async (document, range, context, token, next) => {
					const actions = await next(document, range, context, token);
					const safe = [];
					for (const action of actions ?? []) {
						const command =
							"command" in action
								? typeof action.command === "string"
									? action.command
									: action.command?.command
								: undefined;
						if (
							(command && !engine.allowedCommands.includes(command)) ||
							("edit" in action && !writable(pool, action.edit))
						)
							continue;
						if ("edit" in action && action.edit) {
							action.edit = await textEditsOnly(action.edit);
							if (!action.edit.size && !command) continue;
						}
						if (typeof action.command === "string")
							action.command = aliases.get(action.command) ?? action.command;
						else scopedCommand(action.command);
						safe.push(action);
					}
					return safe;
				},
				provideCompletionItem: async (
					document,
					position,
					context,
					token,
					next,
				) => {
					const result = await next(document, position, context, token);
					for (const item of Array.isArray(result)
						? result
						: (result?.items ?? []))
						scopedCommand(item.command);
					return result;
				},
				provideDefinition: async (document, position, token, next) => {
					const result = await next(document, position, token);
					await loadLocations(pool, result);
					return result;
				},
				provideReferences: async (document, position, options, token, next) => {
					const result = await next(document, position, options, token);
					await loadLocations(pool, result);
					return result;
				},
				provideRenameEdits: async (document, position, name, token, next) => {
					const result = await next(document, position, name, token);
					return writable(pool, result)
						? result
							? textEditsOnly(result)
							: result
						: null;
				},
				resolveCompletionItem: async (item, token, next) => {
					const result = await next(item, token);
					if (result) scopedCommand(result.command);
					return result;
				},
				workspace: {
					configuration: async (params) =>
						params.items.map((item) => {
							let value: unknown = engine.settings;
							for (const part of item.section?.split(".") ?? [])
								value =
									value && typeof value === "object"
										? (value as Record<string, unknown>)[part]
										: undefined;
							return value ?? null;
						}),
				},
			},
			workspaceFolder: {
				index: 0,
				name: pool.workspace.definition.integrationId,
				uri: monaco.Uri.file(engine.folder),
			},
		},
		id: `${pool.workspace.id}-${engine.id}`,
		messageTransports: engine.transports,
		name: `${engine.id} (browser)`,
	});
	pool.clients.set(engine.id, { client: languageClient, commands, engine });
	try {
		await languageClient.start();
		// Javacs consumes pushed settings rather than workspace/configuration.
		// Supply the prepared sources explicitly; no Maven process runs here.
		if (engine.id.startsWith("javacs-"))
			await languageClient.sendNotification(
				"workspace/didChangeConfiguration",
				{
					settings: engine.settings,
				},
			);
		const vscode = await import("vscode");
		for (const command of engine.allowedCommands.filter(
			(id) => !id.startsWith("editor."),
		)) {
			const alias = `devsforge.${pool.workspace.id}.${engine.id}.${command}`;
			aliases.set(command, alias);
			commands.push(
				vscode.commands.registerCommand(alias, (...args: unknown[]) =>
					languageClient.sendRequest("workspace/executeCommand", {
						arguments: args,
						command,
					}),
				),
			);
		}
		// Server-initiated edits must obey the same writable-document boundary.
		languageClient.onRequest(
			"workspace/applyEdit",
			async (params: ApplyWorkspaceEditParams) => {
				const uris = new Set(
					[...pool.models.values()].map((d) => d.model.uri.toString()),
				);
				const safe =
					Object.keys(params.edit.changes ?? {}).every((uri) =>
						uris.has(uri),
					) &&
					(params.edit.documentChanges ?? []).every(
						(change) =>
							"textDocument" in change && uris.has(change.textDocument.uri),
					);
				if (!safe)
					return {
						applied: false,
						failureReason: "Library sources are read-only",
					};
				const edit =
					await languageClient.protocol2CodeConverter.asWorkspaceEdit(
						params.edit,
					);
				return {
					applied: edit
						? await (await import("vscode")).workspace.applyEdit(edit)
						: false,
				};
			},
		);
	} catch (error) {
		pool.clients.delete(engine.id);
		for (const command of commands) command.dispose();
		await languageClient.dispose(1000).catch(() => undefined);
		engine.dispose();
		throw error;
	}
}

async function attach(pool: Pool, request: EditorRequest) {
	const existing = pool.models.get(request.documentId);
	if (existing) return existing;
	if (pool.closed) throw new Error("Browser workspace closed");
	const project = pool.workspace.prepare(request);
	const engines = await pool.workspace.connect(project);
	for (const engine of engines) {
		const old = pool.clients.get(engine.id);
		if (old && engine.id === "gopls")
			await old.client.sendNotification("workspace/didChangeWorkspaceFolders", {
				event: {
					added: [
						{ name: project.id, uri: monaco.Uri.file(project.root).toString() },
					],
					removed: [],
				},
			});
		await startEngine(pool, engine);
	}
	if (pool.closed) throw new Error("Browser workspace closed");
	const reference = await createModelReference(
		monaco.Uri.file(project.path),
		request.code,
	);
	const model = reference.object.textEditorModel;
	if (!model) {
		reference.dispose();
		throw new Error("Editor document unavailable");
	}
	monaco.editor.setModelLanguage(model, pool.workspace.definition.language);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const subscription = model.onDidChangeContent(() => {
		clearTimeout(timer);
		// The language servers analyze incremental UTF-16 changes directly. This
		// delayed snapshot updates only their private source filesystem for imports.
		timer = setTimeout(() => {
			if (pool.closed || model.isDisposed()) return;
			for (const engine of engines.filter(
				(e) => e.id !== "pyright" && e.id !== "ruff",
			))
				void engine
					.write({ [project.path]: model.getValue() })
					.catch(() => undefined);
		}, 300);
	});
	const document = {
		engineIds: engines.map((engine) => engine.id),
		model,
		project,
		reference,
		subscription: {
			dispose: () => {
				clearTimeout(timer);
				subscription.dispose();
			},
		},
	};
	pool.models.set(request.documentId, document);
	return document;
}

export async function connectEditor(
	request: EditorRequest,
	onSource: SourceEditor,
	onClosed: (reason?: string) => void,
	signal?: AbortSignal,
	onStatus?: (message: string) => void,
): Promise<EditorSession> {
	await closing.get(`${request.workbenchId}|${request.documentId}`);
	const key = poolKey(request);
	let pending = pools.get(key);
	if (!pending) {
		pending = createPool(request, key);
		pools.set(key, pending);
		void pending.catch(() => pools.delete(key));
	}
	const pool = await pending;
	if (signal?.aborted) throw new DOMException("Editor closed", "AbortError");
	onStatus?.(
		`Starting ${pool.workspace.definition.language} assistance in your browser…`,
	);
	const attached = pool.attaching.then(() => attach(pool, request));
	pool.attaching = attached.catch(() => undefined);
	let document: Document;
	try {
		document = await attached;
	} catch (error) {
		pools.delete(key);
		for (const observer of pool.observers)
			observer(error instanceof Error ? error.message : String(error));
		archived.set(pool, request.workbenchId);
		await disposePool(pool, true);
		throw error;
	}
	if (signal?.aborted) throw new DOMException("Editor closed", "AbortError");
	pool.source = onSource;
	pool.observers.add(onClosed);
	const stop = async () => {
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
		model: document.model,
		stop,
	};
}

async function disposePool(pool: Pool, keepDocuments = false) {
	if (pool.closed) return;
	pool.closed = true;
	for (const { commands } of pool.clients.values())
		for (const command of commands) command.dispose();
	await Promise.allSettled(
		[...pool.clients.values()].map(({ client }) => client.dispose(2000)),
	);
	pool.workspace.dispose();
	for (const document of pool.models.values()) {
		document.subscription.dispose();
		if (!keepDocuments) {
			document.reference.dispose();
			if (!document.model.isDisposed()) document.model.dispose();
		}
	}
	for (const source of pool.sources.values()) {
		targets.delete(source.uri.toString());
		source.dispose();
	}
	pool.clients.clear();
	if (!keepDocuments) pool.models.clear();
	pool.sources.clear();
	pool.observers.clear();
}

export function closeEditorDocument(workbenchId: string, documentId: string) {
	const key = `${workbenchId}|${documentId}`;
	const job = (async () => {
		forgetFallback(workbenchId, documentId);
		for (const [key, pending] of pools) {
			if (!key.startsWith(`${workbenchId}|`)) continue;
			const pool = await pending.catch(() => undefined);
			if (!pool) continue;
			await pool.attaching;
			const document = pool.models.get(documentId);
			if (!document) continue;
			document.subscription.dispose();
			// Stop a document's private Java client before disposing its Monaco
			// model, so its automatic didClose cannot race a closed transport.
			const javaEngines: BrowserEngine[] = [];
			for (const id of document.engineIds) {
				if (!id.startsWith("javacs-")) continue;
				const connection = pool.clients.get(id);
				for (const command of connection?.commands ?? []) command.dispose();
				await connection?.client.dispose(2000).catch(() => undefined);
				if (connection) javaEngines.push(connection.engine);
				pool.clients.delete(id);
			}
			document.reference.dispose();
			document.model.dispose();
			void deleteFile(document.model.uri).catch(() => undefined);
			pool.models.delete(documentId);
			pool.workspace.documents.delete(documentId);
			for (const id of document.engineIds) {
				const connection = pool.clients.get(id);
				if (!id.startsWith("javacs-") && connection)
					await connection.engine.write({ [document.project.path]: "" });
			}

			for (const engine of javaEngines) engine.dispose();
		}
	})().finally(() => closing.delete(key));
	closing.set(key, job);
	return job;
}
export async function closeWorkbench(workbenchId: string) {
	forgetFallback(workbenchId);
	for (const [key, pending] of pools) {
		if (!key.startsWith(`${workbenchId}|`)) continue;
		pools.delete(key);
		const pool = await pending.catch(() => undefined);
		if (pool) await disposePool(pool);
	}
	for (const [pool, scope] of archived) {
		if (scope !== workbenchId) continue;
		for (const document of pool.models.values()) {
			document.reference.dispose();
			if (!document.model.isDisposed()) document.model.dispose();
		}
		pool.models.clear();
		archived.delete(pool);
	}
}
export { monaco };
