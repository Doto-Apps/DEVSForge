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
			method,
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: "Bearer " + token } : {}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const t = await r.text();
		if (!r.ok) throw Error(path + " " + r.status + " " + t);
		return t ? JSON.parse(t) : null;
	}
	const email = `wb-${Date.now()}@example.test`,
		password = "Workbench-check-42";
	await req("POST", "/auth/register", {
		username: email.split("@")[0],
		email,
		password,
	});
	const login = await req("POST", "/auth/login", { identity: email, password });
	token = login.accessToken;
	const lib = await req("POST", "/library", {
		title: "Workbench tests",
		description: "Isolated tests",
	});
	const otherLib = await req("POST", "/library", {
		title: "Other library",
		description: "Homonyms",
	});
	const code =
		"from modeling import Atomic\nimport math\nclass Example(Atomic):\n    def test(self):\n        return self.get_phase()\n";
	async function model(name, libId = lib.id) {
		return req("POST", "/model", {
			libId,
			name,
			type: "atomic",
			code,
			integrationId: "xdevs-python",
			integrationVersion: "1.0.0",
			ports: [],
			components: [],
			connections: [],
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
		viewport: { width: 1660, height: 940 },
	});
	await context.addInitScript(
		({ token, refresh }) => {
			localStorage.setItem("accessToken", token);
			localStorage.setItem("refreshToken", refresh);
		},
		{ token, refresh: login.refreshToken },
	);
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (e) => {
		errors.push(e.message);
		console.log("PAGE_ERROR", e.message);
	});
	const sockets = [];
	page.on("websocket", (ws) => {
		if (ws.url().includes("/lsp/")) sockets.push(ws.url());
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
			.getByRole("tab", { name: m.name.trim(), exact: false })
			.first()
			.waitFor({ timeout: 20000 });
	}
	const monaco = async (fn) =>
		page.evaluate(async (fn) => {
			const { monaco } = await import("/src/lib/lsp/client.ts");
			const editor = monaco.editor
				.getEditors()
				.find((e) => e.getDomNode()?.isConnected);
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
	console.log("LIGHT_CONNECTED", sockets.length);
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
	if (sockets.length !== 2) throw Error("servers restarted " + sockets.length);
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
	if (sockets.length !== 2) throw Error("switching restarted engines");
	await page.getByRole("button", { name: "Close light ", exact: true }).click();
	await page.getByRole("dialog").waitFor();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
	const beforeReorder = sockets.length;
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
	if (sockets.length !== beforeReorder) throw Error("reorder restarted LSP");
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
	await page.getByRole("button", { name: "Close light ", exact: true }).click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Save", exact: true })
		.click();
	await page.getByRole("dialog").waitFor({ state: "hidden" });
	if (!(await req("GET", `/model/${a.id}`)).code.includes("unsaved light"))
		throw Error("save close did not save");
	console.log("CLOSE_SAVE");
	await page.getByRole("tab", { name: /Other library/ }).click();
	await page
		.locator(`[data-model-tab="${c.id}"]`)
		.getByRole("button", { name: "Close switch", exact: true })
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Discard", exact: true })
		.click();
	console.log("CLOSE_DISCARD");
	if (sockets.length !== 4)
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
