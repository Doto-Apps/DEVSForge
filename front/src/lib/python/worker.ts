import type { WorkerResponse } from "@/types";

// @ts-ignore
importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.0/full/pyodide.js");

let working = false;
async function loadPyodideAndRun(code: string): Promise<WorkerResponse> {
	working = true;
	// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
	let pyodide;
	try {
		// @ts-ignore
		pyodide = await loadPyodide();
		await pyodide.loadPackage(["micropip"]);
		const micropip = pyodide.pyimport("micropip");
		await micropip.install("pyright");

		// Utiliser Pyright pour le linting
		const pyright = pyodide.pyimport("pyright");
		const diagnostics = pyright.runLinter(code);

		// Libérer la mémoire si possible
		pyodide = null;
		working = false;
		return { diagnostics, error: undefined };
	} catch (error) {
		// Libérer la mémoire si possible
		pyodide = null;
		working = false;
		if (error instanceof Error) {
			return { diagnostics: [], error: error };
		}
		console.error(error);
		return { diagnostics: [], error: new Error("Unknown error") };
	}
}

self.onmessage = async (event: MessageEvent<{ code: string }>) => {
	const { code } = event.data;
	if (!working) {
		const response = await loadPyodideAndRun(code);
		self.postMessage(response);
	}
};
