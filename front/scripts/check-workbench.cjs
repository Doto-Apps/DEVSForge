const { chromium } = require("playwright");
const api = process.env.WORKBENCH_TEST_API_URL,
	front = process.env.WORKBENCH_TEST_FRONT_URL;
if (!api || !front)
	throw Error(
		"Set WORKBENCH_TEST_API_URL and WORKBENCH_TEST_FRONT_URL to an isolated test stack.",
	);
(async () => {
	let token;
	async function req(method, path, body) {
		const r = await fetch(api + path, {
			body: body === undefined ? undefined : JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: "Bearer " + token } : {}),
			},
			method,
		});
		const t = await r.text();
		if (!r.ok) throw Error(path + " " + r.status + " " + t);
		return t ? JSON.parse(t) : null;
	}
	const email = `wb-${Date.now()}@example.test`,
		password = "Workbench-check-42";
	await req("POST", "/auth/register", {
		email,
		password,
		username: email.split("@")[0],
	});
	const login = await req("POST", "/auth/login", { identity: email, password });
	token = login.accessToken;
	const lib = await req("POST", "/library", {
		description: "Isolated tests",
		title: "Workbench tests",
	});
	const otherLib = await req("POST", "/library", {
		description: "Homonyms",
		title: "Other library",
	});
	const code =
		"from modeling import Atomic\nimport math\nclass Example(Atomic):\n    def test(self):\n        return self.get_phase()\n";
	async function model(
		name,
		libId = lib.id,
		language = "python",
		source = code,
	) {
		return req("POST", "/model", {
			code: source,
			components: [],
			connections: [],
			integrationId: `xdevs-${language}`,
			integrationVersion: "1.0.0",
			libId,
			name,
			ports: [],
			type: "atomic",
		});
	}
	const a = await model("light "),
		b = await model("switch"),
		c = await model("switch", otherLib.id);
	const browser = await chromium.launch({
		...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: {}),
		headless: true,
	});
	const context = await browser.newContext({
		viewport: { height: 940, width: 1660 },
	});
	await context.addInitScript(
		({ token, refresh }) => {
			localStorage.setItem("accessToken", token);
			localStorage.setItem("refreshToken", refresh);
		},
		{ refresh: login.refreshToken, token },
	);
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (e) => {
		errors.push(e.message);
		console.log("PAGE_ERROR", e.message);
	});
	const engines = [];
	// Count foreground engines, excluding Pyright's nested analysis worker.
	page.on("worker", (worker) => {
		if (worker.url().includes("ruff.worker")) engines.push(worker.url());
		if (worker.url().includes("pyright.worker")) {
			void worker
				.evaluate(() => self.name)
				.then((name) => {
					if (name.startsWith("pyright-")) engines.push(worker.url());
				})
				.catch(() => undefined);
		}
	});
	const url = (m) => `${front}/library/${m.libId}/model/${m.id}`;
	async function navigate(m) {
		await page.evaluate(
			(path) => {
				history.pushState({}, "", path);
				dispatchEvent(new PopStateEvent("popstate"));
			},
			url(m).replace(front, ""),
		);
		await page
			.getByRole("tab", { exact: false, name: m.name.trim() })
			.first()
			.waitFor({ timeout: 20000 });
	}
	const monaco = async (fn) =>
		page.evaluate(async (fn) => {
			const { monaco } = await import("/src/lib/lsp/client.ts");
			const started = Date.now();
			let editor;
			while (!editor) {
				editor = monaco.editor
					.getEditors()
					.find((item) => item.getDomNode()?.isConnected && item.getModel());
				if (Date.now() - started > 30000)
					throw Error("Active editor did not mount");
				if (!editor) await new Promise((resolve) => setTimeout(resolve, 50));
			}
			return new Function("monaco", "editor", fn)(monaco, editor);
		}, fn);
	await page.goto(url(a));
	await page.locator(".monaco-editor").waitFor({ timeout: 60000 });
	await page.waitForFunction(
		() =>
			!Array.from(document.querySelectorAll("[role=status]")).some((e) =>
				/language assistance|language server|Starting/.test(e.textContent),
			),
		null,
		{ timeout: 30000 },
	);
	console.log("LIGHT_CONNECTED", engines.length);
	console.log(
		"MONACO_PRELOAD_MS",
		await page.evaluate(() =>
			performance
				.getEntriesByName("devsforge:editor-preload", "measure")
				.map((m) => Math.round(m.duration)),
		),
	);
	await monaco(
		'editor.pushUndoStop();editor.executeEdits("check",[{range:new monaco.Range(6,1,6,1),text:"# unsaved light\\n"}]);editor.pushUndoStop();editor.setPosition({lineNumber:5,column:13});',
	);
	await page.getByLabel("Unsaved changes").waitFor();
	const uri = await monaco("return editor.getModel().uri.toString()");
	await navigate(b);
	await page.waitForTimeout(700);
	await page.getByRole("tab", { name: /light/ }).click();
	await page.waitForTimeout(300);
	if (!(await monaco("return editor.getValue()")).includes("unsaved light"))
		throw Error("draft lost");
	if ((await monaco("return editor.getModel().uri.toString()")) !== uri)
		throw Error("Monaco URI changed");
	if (engines.length !== 2)
		throw Error("browser engines restarted " + engines.length);
	if ((await monaco("return editor.getPosition().lineNumber")) !== 5)
		throw Error("cursor not restored");
	console.log("TABS_SHARED_LSP_BUFFER_CURSOR");
	await monaco('editor.focus();editor.trigger("check","undo",{});');
	if ((await monaco("return editor.getValue()")).includes("unsaved light"))
		throw Error("undo history lost");
	await monaco('editor.trigger("check","redo",{});');
	console.log("UNDO_REDO_PRESERVED");
	for (let i = 0; i < 4; i++) {
		await page.getByRole("tab", { name: /switch/ }).click();
		await page.waitForTimeout(120);
		await page.getByRole("tab", { name: /light/ }).click();
		await page.waitForTimeout(120);
	}
	if (engines.length !== 2) throw Error("switching restarted engines");
	await page.getByRole("button", { exact: true, name: "Close light " }).click();
	await page.getByRole("dialog").waitFor();
	await page.getByRole("button", { exact: true, name: "Cancel" }).click();
	await page.getByRole("dialog").waitFor({ state: "hidden" });
	if (!(await page.getByRole("tab", { name: /light/ }).count()))
		throw Error("cancel closed tab");
	await page.reload();
	await page.locator(".monaco-editor").waitFor({ timeout: 60000 });
	await page.waitForTimeout(1000);
	if (!(await monaco("return editor.getValue()")).includes("unsaved light"))
		throw Error("reload lost draft");
	if ((await page.getByRole("tab").count()) !== 2)
		throw Error("reload lost tabs");
	console.log("INDEXEDDB_RELOAD_RECOVERY");
	await navigate(c);
	await page.waitForTimeout(700);
	if ((await page.getByRole("tab", { name: /switch/ }).count()) !== 2)
		throw Error("homonyms not independent");
	console.log("HOMONYMOUS_MODELS");
	const beforeReorder = engines.length;
	const source = await page.getByRole("tab", { name: /light/ }).boundingBox();
	const destination = await page
		.locator(`[data-model-tab="${c.id}"]`)
		.boundingBox();
	if (!source || !destination) throw Error("missing tab drag bounds");
	await page.mouse.move(
		source.x + source.width / 2,
		source.y + source.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		destination.x + destination.width - 3,
		destination.y + destination.height / 2,
		{ steps: 12 },
	);
	await page.mouse.up();
	const order = await page
		.locator("[data-model-tab]")
		.evaluateAll((tabs) => tabs.map((tab) => tab.dataset.modelTab));
	if (order.join() !== [b.id, c.id, a.id].join())
		throw Error("tab drag did not reorder");
	if (!page.url().includes(c.id)) throw Error("drag activated another model");
	await page.getByRole("tab", { selected: true }).focus();
	await page.keyboard.press("Alt+ArrowLeft");
	const keyboardOrder = await page
		.locator("[data-model-tab]")
		.evaluateAll((tabs) => tabs.map((tab) => tab.dataset.modelTab));
	if (keyboardOrder.join() !== [c.id, b.id, a.id].join())
		throw Error("keyboard reorder failed");
	if (engines.length !== beforeReorder) throw Error("reorder restarted LSP");
	console.log("TABS_DRAG_AND_KEYBOARD_REORDER");
	// Both files remain observed by the same Pyright and Ruff transports.
	await monaco('editor.setValue("only_in_other_library\\n");');
	await page.waitForFunction(
		async () => {
			const { monaco } = await import("/src/lib/lsp/client.ts");
			return monaco.editor
				.getModelMarkers({})
				.some((m) => m.message.includes("only_in_other_library"));
		},
		null,
		{ timeout: 15000 },
	);
	await page.getByRole("tab", { name: /light/ }).click();
	await page.waitForTimeout(300);
	const isolated = await monaco(
		'return monaco.editor.getModelMarkers({resource:editor.getModel().uri}).every(m=>!m.message.includes("only_in_other_library"))',
	);
	if (!isolated) throw Error("diagnostics leaked");
	console.log("DIAGNOSTICS_ISOLATED");
	await page.getByRole("button", { exact: true, name: "Close light " }).click();
	await page
		.getByRole("dialog")
		.getByRole("button", { exact: true, name: "Save" })
		.click();
	await page.getByRole("dialog").waitFor({ state: "hidden" });
	if (!(await req("GET", `/model/${a.id}`)).code.includes("unsaved light"))
		throw Error("save close did not save");
	console.log("CLOSE_SAVE");
	await page.getByRole("tab", { name: /Other library/ }).click();
	await page
		.locator(`[data-model-tab="${c.id}"]`)
		.getByRole("button", { exact: true, name: "Close switch" })
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { exact: true, name: "Discard" })
		.click();
	console.log("CLOSE_DISCARD");
	if (engines.length !== 4)
		throw Error("closing one document restarted the workspace");
	// Both platform modifiers must save the active tab while Monaco has focus.
	for (const [target, shortcut] of [
		[b, "Control+s"],
		[a, "Meta+s"],
	]) {
		await navigate(target);
		await page.waitForFunction(
			(name) =>
				Array.from(document.querySelectorAll("input")).some(
					(input) => input.value === name,
				),
			target.name,
		);
		await page.waitForFunction(
			async (expectedCode) => {
				const { monaco } = await import("/src/lib/lsp/client.ts");
				return monaco.editor
					.getEditors()
					.some(
						(editor) =>
							editor.getDomNode()?.isConnected &&
							editor.getValue() === expectedCode,
					);
			},
			(await req("GET", `/model/${target.id}`)).code,
		);
		await monaco("editor.focus();");
		await page.keyboard.press("Control+End");
		await page.keyboard.insertText(`\n# saved with ${shortcut}\n`);
		await page.getByLabel("Unsaved changes").waitFor();
		const saved = page.waitForResponse(
			(r) =>
				r.request().method() === "PATCH" &&
				new URL(r.url()).pathname === `/model/${target.id}`,
		);
		await page.keyboard.press(shortcut);
		if (!(await saved).ok()) throw Error(`${shortcut} save failed`);
		if (
			!(await req("GET", `/model/${target.id}`)).code.includes(
				`# saved with ${shortcut}`,
			)
		)
			throw Error(`${shortcut} did not save the active model buffer`);
		await page.getByLabel("Unsaved changes").waitFor({ state: "hidden" });
	}
	if ((await req("GET", `/model/${b.id}`)).code.includes("# saved with Meta+s"))
		throw Error("save shortcut retained the previously active tab");
	console.log("SAVE_SHORTCUTS_CTRL_AND_META_ACTIVE_TAB");
	// Exercise the React editor and actual catalogue API for the other engines too.
	for (const [language, source, receiver, expected] of [
		[
			"go",
			'package main\nimport "devsforge-wrapper/modeling"\ntype Example struct { modeling.Atomic }\nfunc (e *Example) Test() string { return e.GetPhase() }\n',
			"e.",
			"GetPhase",
		],
		[
			"java",
			"package com.devsforge.runner;\nimport com.devsforge.runner.modeling.Atomic;\nimport com.devsforge.runner.modeling.RunnableModel;\npublic class Example extends Atomic {\n public Example(RunnableModel cfg) { super(cfg); }\n public String test() { return this.getPhase(); }\n}\n",
			"this.",
			"getPhase",
		],
	]) {
		const first = await model(
			`${language} first`,
			lib.id,
			language,
			`// first\n${source}`,
		);
		const second = await model(
			`${language} second`,
			lib.id,
			language,
			`// second\n${source}`,
		);
		const completion = async (target) => {
			await navigate(target);
			await page.waitForFunction(
				async ({ receiver, expected, code }) => {
					const { monaco } = await import("/src/lib/lsp/client.ts");
					const vscode = await import("/@id/vscode");
					const editor = monaco.editor
						.getEditors()
						.find((item) => item.getDomNode()?.isConnected);
					const document = editor?.getModel();
					if (!document || document.uri.scheme !== "file") return false;
					if (document.getValue() !== code) return false;
					const offset = document.getValue().lastIndexOf(receiver);
					if (offset < 0) return false;
					const position = document.getPositionAt(offset + receiver.length);
					const result = await vscode.commands.executeCommand(
						"vscode.executeCompletionItemProvider",
						vscode.Uri.parse(document.uri.toString()),
						new vscode.Position(position.lineNumber - 1, position.column - 1),
					);
					return result?.items.some((item) =>
						(typeof item.label === "string"
							? item.label
							: item.label.label
						).startsWith(expected),
					);
				},
				{ code: target.code, expected, receiver },
				{ timeout: 120000 },
			);
		};
		await completion(first);
		const runtime =
			language === "go"
				? page.workers().filter((worker) => worker.url().includes("go.worker"))
				: page
						.workers()
						.filter((worker) => worker.url().includes("java.worker"));
		if (runtime.length !== 1)
			throw Error(`${language}: missing shared runtime`);
		const firstURI = await monaco("return editor.getModel().uri.toString()");
		await completion(second);
		const next =
			language === "go"
				? page.workers().filter((worker) => worker.url().includes("go.worker"))
				: page
						.workers()
						.filter((worker) => worker.url().includes("java.worker"));
		if (next.length !== 1 || next[0] !== runtime[0])
			throw Error(`${language}: tab switch replaced the runtime`);
		await completion(first);
		if ((await monaco("return editor.getModel().uri.toString()")) !== firstURI)
			throw Error(`${language}: tab switch changed document URI`);
		await monaco(
			'editor.executeEdits("check",[{range:new monaco.Range(1,1,1,1),text:"// browser workbench save\\n"}]);editor.focus();',
		);
		await page.getByLabel("Unsaved changes").waitFor();
		const save = page.waitForResponse(
			(response) =>
				response.request().method() === "PATCH" &&
				new URL(response.url()).pathname === `/model/${first.id}`,
		);
		await page.keyboard.press("Control+s");
		if (
			!(await save).ok() ||
			!(await req("GET", `/model/${first.id}`)).code.startsWith(
				"// browser workbench save",
			)
		)
			throw Error(`${language}: saving the active buffer failed`);
		await page.getByLabel("Unsaved changes").waitFor({ state: "hidden" });
		const immediateSave = page.waitForResponse(
			(response) =>
				response.request().method() === "PATCH" &&
				new URL(response.url()).pathname === `/model/${first.id}`,
		);
		// Same event turn: React has not rendered the new draft yet.
		await monaco(
			'editor.executeEdits("check",[{range:new monaco.Range(1,1,1,1),text:"// immediate save\\n"}]);window.dispatchEvent(new KeyboardEvent("keydown",{key:"s",ctrlKey:true,bubbles:true,cancelable:true}));',
		);
		if (
			!(await immediateSave).ok() ||
			!(await req("GET", `/model/${first.id}`)).code.startsWith(
				"// immediate save",
			)
		)
			throw Error(`${language}: immediate save used a stale draft`);
		console.log(
			`${language.toUpperCase()}_WORKBENCH_COMPLETION_RUNTIME_REUSE_SAVE`,
		);
	}
	await page.close();
	await context.close();
	await browser.close();
	if (errors.length) throw Error(errors.join("; "));
	console.log("WORKBENCH_BROWSER_OK");
})().catch((e) => {
	console.error(e.stack);
	process.exitCode = 1;
	setTimeout(() => process.exit(1), 1000);
});
