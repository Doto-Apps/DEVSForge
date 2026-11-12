import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const required = [
	"go/gopls.wasm",
	"go/wasm_exec.js",
	"go/stdlib.json",
	"python/stdlib.json",
	"java/bridge.jar",
	"java/java-language-server.jar",
	"java/jars.json",
	"java/runtime.js",
	"java/bjvm_main.wasm",
	"java/jdk23.jar",
	"java/jdk23/lib/modules",
];
const missing = required.filter(
	(name) =>
		!existsSync(new URL(`../public/language-tools/${name}`, import.meta.url)),
);
if (missing.length) {
	throw new Error(
		`Missing browser language tools: ${missing.join(", ")}. Run task front:language-tools from ${fileURLToPath(new URL("../..", import.meta.url))}.`,
	);
}
