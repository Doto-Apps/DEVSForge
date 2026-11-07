import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: path.resolve(__dirname, ".."),
	plugins: [react()],
	worker: { format: "es" },
	optimizeDeps: {
		include: [
			"vscode-languageclient/browser.js",
			"vscode-jsonrpc",
			"vscode-ws-jsonrpc",
		],
		exclude: [
			"monaco-languageclient",
			"@codingame",
			"@codingame/monaco-vscode-api",
			"@codingame/monaco-vscode-files-service-override",
			"@codingame/monaco-vscode-editor-service-override",
			"vscode",
			"monaco-editor",
		],
	},
	resolve: {
		alias: {
			"@codingame/monaco-vscode-api/vscode": path.resolve(
				__dirname,
				"node_modules/@codingame/monaco-vscode-api/vscode/src",
			),
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
