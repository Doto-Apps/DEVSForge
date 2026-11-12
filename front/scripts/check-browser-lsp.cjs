/* Real browser engines, real modeling sources, no database or paid AI calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const front = path.resolve(__dirname, "..");
const repo = path.resolve(front, "..");
const languages = process.env.BROWSER_LSP_LANGUAGES?.split(",") ?? [
	"python",
	"go",
	"java",
];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const engineWorkers = (page) =>
	page
		.workers()
		.filter((worker) =>
			/pyright\.worker|ruff\.worker|go\.worker|java\.worker/.test(worker.url()),
		);
// Pyright starts its unnamed analysis worker lazily, after the first response.
// Compare the actual foreground runtimes rather than that asynchronous count.
const primaryWorkers = async (page) => {
	const workers = engineWorkers(page);
	const primary = await Promise.all(
		workers.map(
			async (worker) =>
				!worker.url().includes("pyright.worker") ||
				(await worker.evaluate(() => self.name)).startsWith("pyright-"),
		),
	);
	return workers.filter((_, index) => primary[index]);
};

function sources(language) {
	const base = path.join(
		repo,
		"simulator/runner/integrations",
		`xdevs-${language}`,
	);
	const definition = JSON.parse(
		fs.readFileSync(path.join(base, "integration.json")),
	);
	const files = {};
	function walk(dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const file = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(file);
			else if (/\.(go|py|java)$/.test(file))
				files[
					path
						.relative(path.join(base, "wrapper"), file)
						.split(path.sep)
						.join("/")
				] = fs.readFileSync(file, "utf8");
		}
	}
	for (const resource of definition.context) walk(path.join(base, resource));
	return {
		digest: "browser-contract-check",
		files,
		integrationId: definition.id,
		integrationVersion: definition.version,
		language,
		modelPath: definition.modelPath,
		...(language === "go"
			? {
					module: fs
						.readFileSync(path.join(base, "wrapper/go.mod"), "utf8")
						.match(/^module\s+(\S+)/m)[1],
				}
			: {}),
	};
}

function fixture(language, suffix, receiver) {
	if (language === "python")
		return `from modeling import Atomic\nimport math\nclass Example(Atomic):\n    def only_${suffix}(self):\n        pass\n    def test(self):\n        label = "🦊"; ${receiver}\n`;
	if (language === "go")
		return `package main\nimport ("devsforge-wrapper/modeling"; "math")\ntype Example struct { modeling.Atomic }\nfunc (e *Example) Only${suffix}() {}\nfunc (e *Example) Test() { label := "🦊"; _ = label; _ = math.Pi; ${receiver} }\n`;
	return `package com.devsforge.runner;\nimport com.devsforge.runner.modeling.Atomic;\nimport com.devsforge.runner.modeling.RunnableModel;\npublic class Example extends Atomic {\n public Example(RunnableModel cfg) { super(cfg); }\n public void only${suffix}() {}\n public void test() { String label = "🦊"; ${receiver}; }\n}\n`;
}
const own = { go: "e", java: "this", python: "self" };
const method = { go: "GetPhase", java: "getPhase", python: "get_phase" };

async function freePort() {
	const server = net.createServer();
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return port;
}

(async () => {
	let server;
	let browser;
	try {
		const port = await freePort();
		const url = process.env.BROWSER_LSP_TEST_URL ?? `http://127.0.0.1:${port}`;
		if (!process.env.BROWSER_LSP_TEST_URL) {
			const bin = path.join(
				path.dirname(require.resolve("vite/package.json")),
				"bin/vite.js",
			);
			server = spawn(
				process.execPath,
				[bin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
				{ cwd: front, stdio: ["ignore", "pipe", "pipe"] },
			);
			server.stderr.on("data", (data) => process.stderr.write(data));
			const started = Date.now();
			while (
				!(await fetch(url)
					.then((r) => r.ok)
					.catch(() => false))
			) {
				if (server.exitCode !== null || Date.now() - started > 30000)
					throw new Error("Vite did not start");
				await pause(100);
			}
		}
		browser = await chromium.launch({
			headless: true,
			...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
				? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
				: {}),
		});
		for (const language of languages) {
			const page = await browser.newPage();
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			if (process.env.BROWSER_LSP_DEBUG)
				page.on("console", (message) =>
					console.log(language, message.type(), message.text()),
				);
			const remoteLSP = [];
			page.on("request", (request) => {
				if (new URL(request.url()).pathname.startsWith("/lsp/"))
					remoteLSP.push(request.url());
			});
			page.on("websocket", (socket) => {
				if (new URL(socket.url()).pathname.startsWith("/lsp/"))
					remoteLSP.push(socket.url());
			});
			await page.route("**/integrations/*/versions/*/analysis", (route) =>
				route.fulfill({ json: sources(language) }),
			);
			await page.goto(`${url}/language-tools/smoke.html`, {
				waitUntil: "domcontentloaded",
			});
			await page.waitForFunction(() => window.testIDE?.vscode, null, {
				timeout: 60000,
			});
			await page.evaluate(() => {
				window.API_URL = location.origin;
				window.check = { closed: [], connections: {} };
				const host = document.createElement("div");
				host.style = "height:600px;width:1000px";
				document.body.append(host);
				window.check.editor = window.testIDE.runtime.monaco.editor.create(
					host,
					{ automaticLayout: true, value: "" },
				);
			});
			const open = async (id, code, scope = "account-a:window-one") =>
				page.evaluate(
					async ({ language, id, code, scope }) => {
						const { runtime } = window.testIDE;
						const connection = await Promise.race([
							runtime.connectEditor(
								{
									code,
									documentId: id,
									integrationId: `xdevs-${language}`,
									integrationVersion: "1.0.0",
									modelId: id,
									modelName: "light ",
									workbenchId: scope,
								},
								async (model) => {
									window.check.editor.setModel(model);
									return window.check.editor;
								},
								(reason) => {
									window.check.closed.push(reason);
									console.warn("Language engine closed", reason);
								},
							),
							new Promise((_, reject) =>
								setTimeout(
									() =>
										reject(
											new Error(
												`Opening ${id} timed out: ${JSON.stringify(window.check.closed)}`,
											),
										),
									90000,
								),
							),
						]);
						window.check.connections[id] = connection;
						window.check.editor.setModel(connection.model);
						return connection.model.uri.toString();
					},
					{ code, id, language, scope },
				);
			const edit = async (id, code) =>
				page.evaluate(
					({ id, code }) => window.check.connections[id].model.setValue(code),
					{ code, id },
				);
			const complete = async (id, expression, expected) => {
				const start = Date.now();
				let labels = [];
				do {
					labels = await page.evaluate(
						async ({ id, expression }) => {
							const { vscode } = window.testIDE,
								model = window.check.connections[id].model;
							const position = model.getPositionAt(
								model.getValue().lastIndexOf(expression) + expression.length,
							);
							const result = await vscode.commands.executeCommand(
								"vscode.executeCompletionItemProvider",
								vscode.Uri.parse(model.uri.toString()),
								new vscode.Position(
									position.lineNumber - 1,
									position.column - 1,
								),
							);
							return (
								result?.items.map((item) =>
									typeof item.label === "string"
										? item.label
										: item.label.label,
								) ?? []
							);
						},
						{ expression, id },
					);
					if (labels.includes(expected)) return labels;
					await pause(250);
				} while (Date.now() - start < 120000);
				throw new Error(
					`${language} ${expression}: missing ${expected}; got ${labels.slice(0, 30)}`,
				);
			};
			const started = Date.now();
			const uri = await open(
				"light ",
				fixture(language, "Alpha", `${own[language]}.`),
			);
			const first = await complete(
				"light ",
				`${own[language]}.`,
				method[language],
			);
			console.log(
				`${language}: first useful completion ${Date.now() - started} ms`,
			);
			assert.ok(first.length > 10);
			const workers = await primaryWorkers(page);
			const frames = page.frames().length;
			await page.evaluate(() => window.check.connections["light "].stop());
			await open("switch", fixture(language, "Beta", `${own[language]}.`));
			const second = await complete(
				"switch",
				`${own[language]}.`,
				method[language],
			);
			const alpha =
				language === "python"
					? "only_Alpha"
					: language === "go"
						? "OnlyAlpha"
						: "onlyAlpha";
			assert.ok(
				!second.includes(alpha),
				`${language}: homonymous project leaked symbols`,
			);
			assert.deepEqual(
				await primaryWorkers(page),
				workers,
				`${language}: switching models created another runtime`,
			);
			assert.equal(
				page.frames().length,
				frames,
				`${language}: switching models created another JVM`,
			);
			await page.evaluate(() => window.check.connections.switch.stop());
			assert.equal(
				await open("light ", fixture(language, "Alpha", `${own[language]}.`)),
				uri,
			);
			await complete("light ", `${own[language]}.`, method[language]);
			const standard = language === "java" ? "Math." : "math.";
			await edit("light ", fixture(language, "Alpha", standard));
			await complete("light ", standard, language === "go" ? "Sqrt" : "sqrt");
			await page.evaluate(() =>
				window.testIDE.runtime.closeEditorDocument(
					"account-a:window-one",
					"light ",
				),
			);
			await complete("switch", `${own[language]}.`, method[language]);
			await open(
				"light ",
				fixture(language, "Alpha", `${own[language]}.${method[language]}()`),
			);
			await pause(600);
			const definitions = await page.evaluate(
				async ({ name }) => {
					const { vscode, runtime } = window.testIDE,
						model = window.check.connections["light "].model;
					const position = model.getPositionAt(
						model.getValue().lastIndexOf(name) + 2,
					);
					const result = await vscode.commands.executeCommand(
						"vscode.executeDefinitionProvider",
						vscode.Uri.parse(model.uri.toString()),
						new vscode.Position(position.lineNumber - 1, position.column - 1),
					);
					return (
						result?.map((location) => {
							const uri = location.uri ?? location.targetUri;
							return {
								source: runtime.monaco.editor
									.getModel(runtime.monaco.Uri.parse(uri.toString()))
									?.getValue(),
								uri: uri.toString(),
							};
						}) ?? []
					);
				},
				{ language, name: method[language] },
			);
			assert.ok(
				definitions.some(
					(item) =>
						item.uri.startsWith("inmemory://devsforge-sources/") &&
						item.source?.includes(method[language]),
				),
				`${language}: actual modeling source is not navigable`,
			);
			const hold = { go: "HoldIn", java: "holdIn", python: "hold_in" }[
				language
			];
			await edit(
				"light ",
				fixture(language, "Alpha", `${own[language]}.${hold}("active", 1)`),
			);
			await pause(600);
			const tools = await page.evaluate(
				async ({ hold, language }) => {
					const { vscode } = window.testIDE,
						model = window.check.connections["light "].model;
					const uri = vscode.Uri.parse(model.uri.toString());
					const position = model.getPositionAt(
						model.getValue().lastIndexOf(`${hold}(`) + hold.length + 1,
					);
					const signature = await vscode.commands.executeCommand(
						"vscode.executeSignatureHelpProvider",
						uri,
						new vscode.Position(position.lineNumber - 1, position.column - 1),
					);
					const name =
						language === "python"
							? "only_Alpha"
							: language === "go"
								? "OnlyAlpha"
								: "onlyAlpha";
					const renameAt = model.getPositionAt(
						model.getValue().indexOf(name) + 2,
					);
					const renamed = await vscode.commands.executeCommand(
						"vscode.executeDocumentRenameProvider",
						uri,
						new vscode.Position(renameAt.lineNumber - 1, renameAt.column - 1),
						"renamedAlpha",
					);
					const formatting = await vscode.commands.executeCommand(
						"vscode.executeFormatDocumentProvider",
						uri,
						{ insertSpaces: true, tabSize: 4 },
					);
					return {
						edits:
							renamed?.entries().map(([uri, edits]) => ({
								count: edits.length,
								uri: uri.toString(),
							})) ?? [],
						formatting: Array.isArray(formatting),
						signatures: signature?.signatures.map((item) => item.label) ?? [],
						uri: uri.toString(),
					};
				},
				{ hold, language },
			);
			assert.ok(
				tools.signatures.some((label) => label.includes("sigma")),
				`${language}: signature help is unavailable: ${tools.signatures}`,
			);
			assert.ok(
				tools.edits.some((edit) => edit.count > 0) &&
					tools.edits.every((edit) => edit.uri === tools.uri),
				`${language}: rename did not stay in the user document`,
			);
			assert.equal(
				tools.formatting,
				true,
				`${language}: formatting did not respond`,
			);
			await edit(
				"light ",
				fixture(
					language,
					"Alpha",
					language === "go" ? "UniqueErrorAlpha()" : "UniqueErrorAlpha()",
				),
			);
			await page.waitForFunction(
				() => {
					const { runtime } = window.testIDE;
					return runtime.monaco.editor
						.getModelMarkers({
							resource: window.check.connections["light "].model.uri,
						})
						.some((marker) => marker.message.includes("UniqueErrorAlpha"));
				},
				null,
				{ timeout: 30000 },
			);
			assert.equal(
				await page.evaluate(() =>
					window.testIDE.runtime.monaco.editor
						.getModelMarkers({
							resource: window.check.connections.switch.model.uri,
						})
						.some((marker) => marker.message.includes("UniqueErrorAlpha")),
				),
				false,
			);
			await open(
				"other-account",
				fixture(language, "Gamma", `${own[language]}.`),
				"account-b:window-two",
			);
			await complete("other-account", `${own[language]}.`, method[language]);
			if (language === "java")
				assert.equal(
					page
						.workers()
						.filter((worker) => worker.url().includes("java.worker")).length,
					2,
					"Java workspaces must have independent workers",
				);
			await page.evaluate(() =>
				window.testIDE.runtime.closeWorkbench("account-a:window-one"),
			);
			await complete("other-account", `${own[language]}.`, method[language]);
			await page.evaluate(() =>
				window.testIDE.runtime.closeWorkbench("account-b:window-two"),
			);
			if (language === "java") {
				for (
					let i = 0;
					i < 50 &&
					page.workers().some((worker) => worker.url().includes("java.worker"));
					i++
				)
					await pause(100);
				assert.equal(
					page
						.workers()
						.filter((worker) => worker.url().includes("java.worker")).length,
					0,
					"Closing all workspaces must release the Java VMs",
				);
			}
			if (language === "python") {
				await open(
					"fault",
					fixture(language, "Recovery", "self."),
					"account-a:fault-check",
				);
				await complete("fault", "self.", "get_phase");
				const ruff = page
					.workers()
					.find((worker) => worker.url().includes("ruff.worker"));
				assert.ok(ruff, "Ruff worker not found for the fault check");
				const before = await page.evaluate(() => window.check.closed.length);
				await ruff.evaluate(() =>
					self.postMessage({
						error: "Simulated worker failure",
						type: "error",
					}),
				);
				await page.waitForFunction(
					(count) => window.check.closed.length > count,
					before,
				);
				const retained = await page.evaluate(() => {
					const model = window.check.connections.fault.model;
					if (model.isDisposed())
						throw new Error("Worker failure disposed the editable buffer");
					model.setValue(
						`${model.getValue()}\n# still editable after the worker stopped\n`,
					);
					return model.getValue();
				});
				await open("fault", retained, "account-a:fault-check");
				await complete("fault", "self.", "get_phase");
				await page.evaluate(() =>
					window.testIDE.runtime.closeWorkbench("account-a:fault-check"),
				);
			}
			await page.waitForFunction(
				() =>
					window.testIDE.runtime.monaco.editor
						.getModels()
						.every((model) => model.uri.scheme !== "file"),
				null,
				{ timeout: 10000 },
			);
			const cleanupStarted = Date.now();
			while (engineWorkers(page).length && Date.now() - cleanupStarted < 5000)
				await pause(100);
			assert.equal(
				engineWorkers(page).length,
				0,
				`Language workers survived workspace closure: ${engineWorkers(page).map((worker) => worker.url())}`,
			);
			assert.equal(remoteLSP.length, 0, "Editor contacted a remote LSP");
			assert.deepEqual(errors, [], "Browser JavaScript errors");
			console.log(
				`${language}: SDK + stdlib completion, UTF-16, isolated homonyms, runtime reuse, close/reopen, source navigation, diagnostics and cleanup OK`,
			);
			await page.close();
		}
	} finally {
		await browser?.close();
		server?.kill("SIGTERM");
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
