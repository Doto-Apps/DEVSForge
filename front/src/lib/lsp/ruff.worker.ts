import init, {
	type Diagnostic,
	PositionEncoding,
	Workspace,
} from "@astral-sh/ruff-wasm-web";
import ruffWasmURL from "@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm?url";

type Document = { text: string; version: number };
const documents = new Map<string, Document>();
const position = (location: { row: number; column: number }) => ({
	character: location.column - 1,
	line: location.row - 1,
});
const range = (d: Diagnostic) => ({
	end: position(d.end_location),
	start: position(d.start_location),
});
const asEdit = (edit: NonNullable<Diagnostic["fix"]>["edits"][number]) => ({
	newText: edit.content ?? "",
	range: { end: position(edit.end_location), start: position(edit.location) },
});
const ready = init({ module_or_path: ruffWasmURL }).then(
	() =>
		new Workspace(
			{ lint: { select: ["E4", "E7", "E9", "F"] } },
			PositionEncoding.Utf16,
		),
);
let port: MessagePort;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function publish(uri: string, document: Document, workspace: Workspace) {
	const diagnostics = (workspace.check(document.text) as Diagnostic[]).map(
		(d) => ({
			code: d.code ?? undefined,
			message: d.message,
			range: range(d),
			severity: d.code?.startsWith("invalid") ? 1 : 2,
			source: "Ruff",
			tags: d.tags.map((tag) => (tag === "unnecessary" ? 1 : 2)),
		}),
	);
	port.postMessage({
		jsonrpc: "2.0",
		method: "textDocument/publishDiagnostics",
		params: { diagnostics, uri, version: document.version },
	});
}

self.onmessage = ({ data }) => {
	if (data.type !== "boot") return;
	port = data.port;
	port.onmessage = async ({ data: message }) => {
		try {
			const workspace = await ready;
			const params = message.params;
			const uri = params?.textDocument?.uri as string | undefined;
			let result: unknown = null;
			switch (message.method) {
				case "initialize":
					result = {
						capabilities: {
							codeActionProvider: {
								codeActionKinds: ["quickfix", "source.fixAll.ruff"],
							},
							documentFormattingProvider: true,
							positionEncoding: "utf-16",
							textDocumentSync: 1,
						},
					};
					break;
				case "textDocument/didOpen":
					if (uri)
						documents.set(uri, {
							text: params.textDocument.text,
							version: params.textDocument.version,
						});
					break;
				case "textDocument/didChange":
					if (uri)
						documents.set(uri, {
							text: params.contentChanges.at(-1).text,
							version: params.textDocument.version,
						});
					break;
				case "textDocument/didClose":
					if (uri) {
						clearTimeout(timers.get(uri));
						timers.delete(uri);
						documents.delete(uri);
						port.postMessage({
							jsonrpc: "2.0",
							method: "textDocument/publishDiagnostics",
							params: { diagnostics: [], uri },
						});
					}
					break;
				case "textDocument/formatting": {
					const document = uri && documents.get(uri);
					if (document) {
						const lines = document.text.split("\n");
						result = [
							{
								newText: workspace.format(document.text),
								range: {
									end: {
										character: lines.at(-1)?.length ?? 0,
										line: lines.length - 1,
									},
									start: { character: 0, line: 0 },
								},
							},
						];
					}
					break;
				}
				case "textDocument/codeAction": {
					const document = uri && documents.get(uri);
					if (document)
						result = (workspace.check(document.text) as Diagnostic[])
							.filter((d) => d.fix)
							.map((d) => ({
								edit: { changes: { [uri]: d.fix?.edits.map(asEdit) } },
								kind: "quickfix",
								title: d.fix?.message ?? `Fix ${d.code}`,
							}));
					break;
				}
			}
			if (
				uri &&
				documents.has(uri) &&
				["textDocument/didOpen", "textDocument/didChange"].includes(
					message.method,
				)
			) {
				clearTimeout(timers.get(uri));
				timers.set(
					uri,
					setTimeout(() => {
						const current = documents.get(uri);
						if (current) publish(uri, current, workspace);
					}, 250),
				);
			}
			if (message.id !== undefined)
				port.postMessage({ id: message.id, jsonrpc: "2.0", result });
		} catch (error) {
			if (message.id !== undefined)
				port.postMessage({
					error: { code: -32603, message: String(error) },
					id: message.id,
					jsonrpc: "2.0",
				});
			else self.postMessage({ error: String(error), type: "error" });
		}
	};
	ready
		.then(() => self.postMessage({ type: "ready" }))
		.catch((error) =>
			self.postMessage({ error: String(error), type: "error" }),
		);
};
