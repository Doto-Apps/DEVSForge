import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: path.resolve(__dirname, ".."),
	optimizeDeps: {
		exclude: [
			"monaco-languageclient",
			"@codingame",
			"@codingame/monaco-vscode-api",
			"@codingame/monaco-vscode-files-service-override",
			"@codingame/monaco-vscode-editor-service-override",
			"vscode",
			"monaco-editor",
		],
		include: [
			"@zenfs/core",
			"@astral-sh/ruff-wasm-web",
			"vscode-jsonrpc/browser",
			"vscode-languageclient/browser.js",
			"vscode-jsonrpc",
		],
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@codingame/monaco-vscode-api/vscode": path.resolve(
				__dirname,
				"node_modules/@codingame/monaco-vscode-api/vscode/src",
			),
		},
	},
	worker: { format: "es" },
});
