import pyrightURL from "@typefox/pyright-browser/dist/pyright.worker.js?url";
import type { NotificationMessage } from "vscode-jsonrpc";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
} from "vscode-jsonrpc/browser";
import type { components } from "@/api/v1";
import GoWorker from "./go.worker?worker";
import JavaWorker from "./java.worker?worker";
import RuffWorker from "./ruff.worker?worker";

export type AnalysisSources = Required<
	Omit<components["schemas"]["integrations.AnalysisSources"], "module">
> &
	Pick<components["schemas"]["integrations.AnalysisSources"], "module">;
export type EditorRequest = {
	workbenchId: string;
	documentId: string;
	integrationId: string;
	integrationVersion: string;
	modelId?: string;
	modelName: string;
	code: string;
};
export type BrowserEngine = {
	id: string;
	folder: string;
	pattern: string;
	initializationOptions?: { files: Record<string, string> };
	settings: Record<string, unknown>;
	allowedCommands: string[];
	transports: { reader: BrowserMessageReader; writer: BrowserMessageWriter };
	write(files: Record<string, string>): Promise<void>;
	read(path: string): Promise<string | undefined>;
	dispose(): void;
};
export type BrowserDocument = {
	id: string;
	path: string;
	root: string;
	files: Record<string, string>;
};

// Control commands travel separately from the LSP channel.
class Control {
	private next = 0;
	private pending = new Map<
		number,
		{ resolve(value: { text?: string }): void; reject(error: Error): void }
	>();
	readonly ready: Promise<void>;
	constructor(
		readonly target: Worker | MessagePort,
		readonly fail: (message: string) => void,
	) {
		this.ready = new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Browser language engine startup timed out")),
				120000,
			);
			target.addEventListener("message", (({ data }: MessageEvent) => {
				if (data.type === "ready") {
					clearTimeout(timeout);
					resolve();
				}
				if (data.id !== undefined) {
					const pending = this.pending.get(data.id);
					this.pending.delete(data.id);
					if (data.type === "error") pending?.reject(new Error(data.error));
					else pending?.resolve(data);
				} else if (data.type === "error") {
					clearTimeout(timeout);
					reject(new Error(data.error));
					fail(data.error);
				}
			}) as EventListener);
			if (target instanceof MessagePort) target.start();
		});
	}
	request(
		type: string,
		values: Record<string, unknown> = {},
		transfer: Transferable[] = [],
	) {
		const id = ++this.next;
		return new Promise<{ text?: string }>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Browser language command timed out: ${type}`));
			}, 30000);
			this.pending.set(id, {
				reject: (error) => {
					clearTimeout(timeout);
					reject(error);
				},
				resolve: (value) => {
					clearTimeout(timeout);
					resolve(value);
				},
			});
			if (this.target instanceof Worker)
				this.target.postMessage({ id, type, ...values }, transfer);
			else this.target.postMessage({ id, type, ...values }, transfer);
		});
	}
	dispose() {
		for (const pending of this.pending.values())
			pending.reject(new Error("Browser workspace closed"));
		this.pending.clear();
	}
}

function transport(target: Worker | MessagePort) {
	return {
		reader: new BrowserMessageReader(target),
		writer: new BrowserMessageWriter(target),
	};
}

export class BrowserWorkspace {
	readonly id = crypto.randomUUID();
	readonly root: string;
	readonly documents = new Map<string, BrowserDocument>();
	private engines = new Map<string, BrowserEngine>();
	private java?: Promise<{ worker: Worker; control: Control }>;
	private closed = false;
	private sources: Record<string, string> = {};

	constructor(
		readonly definition: AnalysisSources,
		private fail: (message: string) => void,
	) {
		this.root = `/workspaces/devsforge-${this.id}`;
	}

	prepare(request: EditorRequest): BrowserDocument {
		const old = this.documents.get(request.documentId);
		if (old) return old;
		const id = crypto.randomUUID().replaceAll("-", "");
		const root = `${this.root}/projects/${id}`;
		const type =
			/\bpublic\s+(?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\s+([\p{L}_$][\p{L}\p{N}_$]*)/u.exec(
				request.code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""),
			)?.[1] ?? "MyModel";
		const path = `${root}/${this.definition.modelPath.replace("{name}", type)}`;
		const files: Record<string, string> = { [path]: request.code };
		const module = this.definition.module ?? "devsforge-wrapper";
		const sdk = this.definition.language === "java" ? root : `${this.root}/sdk`;
		for (const [name, text] of Object.entries(this.definition.files))
			files[`${sdk}/${name}`] = text;
		if (this.definition.language === "go") {
			files[`${root}/go.mod`] =
				`module devsforge-analysis/${id}\n\ngo 1.26.2\nrequire ${module} v0.0.0\nreplace ${module} => ${sdk}\n`;
			files[`${sdk}/go.mod`] = `module ${module}\n\ngo 1.26.2\n`;
		}
		if (this.definition.language === "python")
			files[`${root}/pyrightconfig.json`] = JSON.stringify({
				extraPaths: [sdk],
				pythonVersion: "3.12",
				typeshedPath: "/typeshed",
				useLibraryCodeForTypes: true,
			});
		const document = { files, id, path, root };
		this.documents.set(request.documentId, document);
		Object.assign(this.sources, files);
		return document;
	}

	async connect(document: BrowserDocument): Promise<BrowserEngine[]> {
		if (this.closed) throw new Error("Browser workspace closed");
		const language = this.definition.language;
		if (language === "java") return [await this.javaEngine(document)];
		if (this.engines.size) {
			for (const engine of this.engines.values())
				await engine.write(document.files);
			return [...this.engines.values()];
		}
		if (language === "python") {
			const response = await fetch("/language-tools/python/stdlib.json");
			if (!response.ok)
				throw new Error(
					"Python browser tools are missing. Run task front:language-tools.",
				);
			const files = { ...(await response.json()), ...document.files };
			Object.assign(this.sources, files);
			const worker = new Worker(pyrightURL, { name: `pyright-${this.id}` });
			worker.onerror = (event) =>
				this.fail(event.message || "Python worker stopped");
			worker.postMessage({ mode: "foreground", type: "browser/boot" });
			const rpc = transport(worker);
			const pyright: BrowserEngine = {
				allowedCommands: ["pyright.organizeimports"],
				dispose: () => worker.terminate(),
				folder: this.root,
				id: "pyright",
				initializationOptions: { files },
				pattern: `${this.root}/**`,
				read: async (path) => this.sources[path],
				settings: {
					python: {
						analysis: {
							autoImportCompletions: true,
							extraPaths: [`${this.root}/sdk`],
							typeCheckingMode: "basic",
							typeshedPaths: ["/typeshed"],
							useLibraryCodeForTypes: true,
						},
					},
				},
				transports: rpc,
				write: async (files) => {
					Object.assign(this.sources, files);
					await rpc.writer.write({
						jsonrpc: "2.0",
						method: "pyright/createFiles",
						params: Object.entries(files).map(([path, text]) => ({
							text,
							uri: `file://${path}`,
						})),
					} as NotificationMessage);
				},
			};
			this.engines.set(pyright.id, pyright);
			const ruff = await this.workerEngine(new RuffWorker(), "ruff", document);
			this.engines.set(ruff.id, ruff);
		} else if (language === "go") {
			const engine = await this.workerEngine(new GoWorker(), "gopls", document);
			this.engines.set(engine.id, engine);
		} else
			throw new Error(
				`No browser language engine is registered for ${language}`,
			);
		return [...this.engines.values()];
	}

	private async workerEngine(
		worker: Worker,
		id: string,
		document: BrowserDocument,
	): Promise<BrowserEngine> {
		const channel = new MessageChannel();
		const control = new Control(worker, this.fail);
		worker.onerror = (event) =>
			this.fail(event.message || `${id} worker stopped`);
		worker.postMessage(
			{ files: document.files, port: channel.port2, type: "boot" },
			[channel.port2],
		);
		try {
			await control.ready;
		} catch (error) {
			worker.terminate();
			throw error;
		}
		if (this.closed) {
			worker.terminate();
			throw new Error("Browser workspace closed");
		}
		return {
			allowedCommands:
				id === "gopls" ? ["gopls.apply_fix", "gopls.add_import"] : [],
			dispose: () => {
				control.dispose();
				channel.port1.close();
				worker.terminate();
			},
			folder: document.root,
			id,
			pattern: `${this.root}/**`,
			read: async (path) =>
				this.sources[path] ??
				(id === "gopls"
					? (await control.request("read", { path })).text
					: undefined),
			settings: {
				gopls: {
					completionBudget: "300ms",
					staticcheck: false,
					telemetryPrompt: false,
				},
			},
			transports: transport(channel.port1),
			write: async (files) => {
				Object.assign(this.sources, files);
				if (id === "gopls") await control.request("files", { files });
			},
		};
	}

	private startJava() {
		this.java ??= (async () => {
			const worker = new JavaWorker({ name: `javacs-${this.id}` });
			const control = new Control(worker, this.fail);
			worker.onerror = (event) =>
				this.fail(event.message || "Java worker stopped");
			worker.postMessage({ root: this.root, type: "boot" });
			try {
				await control.ready;
				if (this.closed) throw new Error("Browser workspace closed");
				return { control, worker };
			} catch (error) {
				control.dispose();
				worker.terminate();
				this.java = undefined;
				throw error;
			}
		})();
		return this.java;
	}

	private async javaEngine(document: BrowserDocument): Promise<BrowserEngine> {
		const id = `javacs-${document.id}`;
		const old = this.engines.get(id);
		if (old) return old;
		const { control } = await this.startJava();
		await control.request("files", { files: document.files });
		const channel = new MessageChannel();
		await control.request("create", { port: channel.port2, project: id }, [
			channel.port2,
		]);
		const engine: BrowserEngine = {
			allowedCommands: ["editor.action.triggerParameterHints"],
			dispose: () => {
				channel.port1.close();
				void control
					.request("close", { project: id, root: document.root })
					.catch(() => undefined);
				this.engines.delete(id);
				if (!this.documents.size && this.java) {
					const runtime = this.java;
					this.java = undefined;
					void runtime.then(({ worker, control }) => {
						control.dispose();
						worker.terminate();
					});
				}
			},
			folder: document.root,
			id,
			pattern: `${document.root}/**`,
			read: async (path) =>
				this.sources[path] ?? (await control.request("read", { path })).text,
			settings: { java: { classPath: [document.root], docPath: [] } },
			transports: transport(channel.port1),
			write: async (files) => {
				Object.assign(this.sources, files);
				await control.request("files", { files });
			},
		};
		this.engines.set(id, engine);
		return engine;
	}

	async read(uri: string): Promise<string | undefined> {
		const path = decodeURIComponent(new URL(uri).pathname);
		if (
			!uri.startsWith("file:") ||
			![this.root + "/", "/typeshed/", "/goroot/src/", "/gopath/pkg/mod/"].some(
				(root) => path.startsWith(root),
			) ||
			path.split("/").includes("..")
		)
			return undefined;
		if (this.sources[path] !== undefined) return this.sources[path];
		for (const engine of this.engines.values()) {
			try {
				const text = await engine.read(path);
				if (text !== undefined) return text;
			} catch {
				/* Not in this engine's filesystem. */
			}
		}
		return undefined;
	}

	dispose() {
		this.closed = true;
		for (const engine of this.engines.values()) engine.dispose();
		this.engines.clear();
		this.documents.clear();
		this.sources = {};
		if (this.java)
			void this.java
				.then(({ worker, control }) => {
					control.dispose();
					worker.terminate();
				})
				.catch(() => undefined);
	}
}
