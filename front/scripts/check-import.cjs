// Browser contract checks: all API requests are intercepted, no account or model is created.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const front = process.env.IMPORT_TEST_FRONT_URL || "http://127.0.0.1:5189";

(async () => {
	const browser = await chromium.launch({
		...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL
			? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL }
			: {}),
		headless: true,
	});
	try {
		const page = await browser.newPage({
			viewport: { height: 1000, width: 1440 },
		});
		page.setDefaultTimeout(60000);
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		const token = `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
		await page.addInitScript((token) => {
			window.API_URL = "http://import.test";
			localStorage.setItem("accessToken", token);
		}, token);
		const profile = {
			capabilities: { ai: true, lsp: true, simulation: true, template: true },
			framework: "DEVSimPy",
			id: "devsimpy-python",
			language: "python",
			name: "DEVSimPy Python",
			version: "1.0.0",
		};
		const external = {
			blockedReason:
				"This framework is not installed. Simulation is unavailable.",
			code: "class Original: pass",
			components: [],
			connections: [],
			framework: "UnknownFramework",
			id: "a",
			language: "python",
			missing: [],
			name: "External source",
			parameters: [],
			ports: [],
			type: "atomic",
		};
		const stored = {
			...external,
			description: "Imported source",
			id: "stored-a",
			importSource: {
				document: external,
				framework: "UnknownFramework",
				language: "python",
				reason: external.blockedReason,
			},
			libId: "library",
			metadata: {
				keyword: [],
				modelRole: "",
				position: { x: 0, y: 0 },
				style: { height: 220, width: 220 },
			},
			userId: "test",
		};
		let analysisCount = 0;
		let lastRequest;
		let saved = false;
		let patched;
		let cancelled = false;
		let converted = false;
		let lastTurn;
		let verification;
		const messages = [
			{
				content:
					"The source is preserved. This framework needs adaptation before execution.",
				id: "welcome",
				role: "assistant",
			},
		];
		const polled = new Set();
		await page.route("http://import.test/**", async (route) => {
			const request = route.request();
			const path = new URL(request.url()).pathname;
			const method = request.method();
			const reply = (body) =>
				route.fulfill({
					body: JSON.stringify(body),
					contentType: "application/json",
					status: 200,
				});
			if (path === "/auth/me")
				return reply({
					email: "test@example.test",
					id: "test",
					username: "Import test",
				});
			if (path === "/integrations") return reply([profile]);
			if (path === "/imports" && method === "GET")
				return reply(
					analysisCount && !cancelled
						? [
								{
									id: analysisCount.toString(16).padStart(48, "a"),
									modelCount: 1,
									state: "ready",
									title: "External source",
									updated: Date.now() / 1000,
									verificationStatus: verification?.status ?? "not_tested",
								},
							]
						: [],
				);
			if (path === "/library")
				return reply([{ id: "library", title: "Destination" }]);
			if (path === "/library/library")
				return reply({ id: "library", title: "Destination" });
			if (path === "/model") return reply(saved ? [stored] : []);
			if (path === "/model/stored-a/recursive") return reply([stored]);
			if (path === "/model/stored-a/capabilities")
				return reply({ reason: external.blockedReason, simulation: false });
			if (path === "/model/stored-a") {
				if (method === "PATCH") patched = request.postDataJSON();
				return reply(stored);
			}
			if (path === "/imports" && method === "POST") {
				lastRequest = request.postDataJSON();
				analysisCount++;
				converted = !!lastRequest.targetIntegrationId;
				return reply({
					id: analysisCount.toString(16).padStart(48, "a"),
					progress: "Analyzing files",
					state: "running",
				});
			}
			if (path.endsWith("/turns")) {
				lastTurn = request.postDataJSON();
				messages.push({
					content: lastTurn.instructions || lastTurn.action,
					id: `turn-${messages.length}`,
					role: "user",
				});
				if (lastTurn.action === "discuss")
					messages.push({
						content:
							"PhaseAtomic is missing. I can include the helper and adapt the API while preserving the model behavior.",
						id: `reply-${messages.length}`,
						role: "assistant",
					});
				if (lastTurn.action === "test")
					verification = {
						error: "Missing PhaseAtomic helper",
						maxTime: lastTurn.maxTime,
						rootId: "a",
						status: "blocked",
					};
				if (lastTurn.action === "adapt") {
					converted = true;
					verification = {
						maxTime: lastTurn.maxTime,
						rootId: "a",
						status: "completed",
					};
				}
				return reply({
					id: path.split("/")[2],
					progress: "Checking the draft",
					state: "running",
				});
			}
			if (path.startsWith("/imports/") && path.endsWith("/commit")) {
				const input = request.postDataJSON();
				assert.equal(input.libraryId, "library");
				assert.equal(input.reviewed, true);
				saved = true;
				return reply({ modelIds: [stored.id], rootIds: [stored.id] });
			}
			if (path.startsWith("/imports/")) {
				if (method === "DELETE") {
					cancelled = true;
					return reply({ state: "cancelled" });
				}
				if (!polled.has(path)) {
					polled.add(path);
					return reply({
						id: path.split("/").pop(),
						progress: "Reading model sources",
						state: "running",
					});
				}
				return reply({
					attempts: verification ? [verification] : [],
					id: path.split("/").pop(),
					messages,
					package: {
						models: [
							converted
								? {
										...external,
										blockedReason: "",
										framework: "DEVSimPy",
										integrationId: profile.id,
										integrationVersion: profile.version,
									}
								: external,
						],
						roots: ["a"],
						version: "1",
					},
					progress: "Review before saving",
					revision: converted ? 2 : 1,
					state: "ready",
					strategy: "one-off",
					verification,
					warnings: ["Review the original source"],
				});
			}
			return reply([]);
		});
		await page.goto(`${front}/import`);
		await page
			.getByRole("heading", { name: "Bring your models with you." })
			.waitFor();
		await page.screenshot({
			fullPage: true,
			path: "../tmp/import-choose-desktop.png",
		});
		const dropped = await page.evaluateHandle(() => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File(["source"], "dropped.py", { type: "text/plain" }),
			);
			return transfer;
		});
		await page
			.getByRole("region", { name: "Upload files" })
			.dispatchEvent("drop", { dataTransfer: dropped });
		await page.getByRole("button", { name: "Remove dropped.py" }).click();
		assert.equal(
			await page
				.getByRole("button", { exact: true, name: "Analyze files" })
				.isDisabled(),
			true,
		);
		await page.getByLabel("Files or ZIP archive").setInputFiles({
			buffer: Buffer.from('{"kind":"ModelSpecification"}'),
			mimeType: "application/json",
			name: "model.json",
		});
		await page.getByRole("button", { name: /Standard ISO package/ }).click();
		await page
			.getByRole("button", { exact: true, name: "Analyze files" })
			.click();
		await page
			.getByRole("status")
			.filter({ hasText: /Reading|Analyzing|Preparing/ })
			.waitFor();
		assert.equal(
			await page
				.getByRole("button", { exact: true, name: "Choose files" })
				.count(),
			0,
		);
		await page.getByRole("heading", { name: "Your draft" }).waitFor();
		await page.screenshot({
			fullPage: true,
			path: "../tmp/import-review-desktop.png",
		});
		assert.equal(lastRequest.mode, "iso");
		assert.equal(lastRequest.files[0].name, "model.json");
		await page
			.getByRole("button", { name: "Keep this version" })
			.first()
			.click();
		await page.getByLabel("Destination library").selectOption("library");
		const commit = page.getByRole("button", {
			exact: true,
			name: "Import reviewed models",
		});
		assert.equal(await commit.isDisabled(), true);
		await page.getByRole("checkbox").check();
		await commit.click();
		await page.waitForURL(/stored-a/);
		await page.locator(".monaco-editor").waitFor();
		for (const name of ["Simulate", "Validate", "Deploy"])
			assert.equal(
				await page.getByRole("button", { exact: true, name }).isDisabled(),
				true,
			);
		await page
			.getByRole("button", { exact: true, name: "Simulate" })
			.locator("..")
			.hover();
		await page
			.getByRole("tooltip")
			.filter({ hasText: "framework is not installed" })
			.waitFor();
		await page.waitForFunction(() =>
			document.body.textContent.includes("Source editing remains available"),
		);
		await page.evaluate(async () => {
			const { monaco } = await import("/src/lib/lsp/client.ts");
			const editor = monaco.editor
				.getEditors()
				.find((e) => e.getDomNode()?.isConnected);
			editor.setValue("class Edited: pass");
		});
		await page.getByRole("button", { exact: true, name: "Save" }).click();
		assert.equal(patched.code, "class Edited: pass");
		assert.equal(patched.integrationId, undefined);
		await page.goto(`${front}/library/library/model/stored-a/validate`);
		await page
			.getByRole("heading", { name: "Execution unavailable" })
			.waitFor();
		await page.goto(`${front}/library/library/model/stored-a/simulate`);
		await page
			.getByRole("heading", { name: "Execution unavailable" })
			.waitFor();
		console.log("PASS_ISO_PREVIEW_COMMIT_EDIT_AND_EXECUTION_GUARDS");
		await page.goto(`${front}/import`);
		await page.getByRole("button", { name: /Explore with AI/ }).click();
		await page.getByLabel("Files or ZIP archive").setInputFiles([
			{
				buffer: Buffer.from("original source"),
				mimeType: "text/plain",
				name: "model.py",
			},
			{
				buffer: Buffer.from("original helper"),
				mimeType: "text/plain",
				name: "utils.py",
			},
		]);
		await page
			.getByRole("button", { exact: true, name: "Analyze files" })
			.click();
		await page.getByRole("heading", { name: "Your draft" }).waitFor();
		assert.equal(lastRequest.mode, "ai");
		assert.equal(lastRequest.files.length, 2);
		await page.reload();
		await page.getByRole("heading", { name: "Your draft" }).waitFor();
		await page
			.getByLabel("Message to the import assistant")
			.fill("Why can't this model run?");
		await page.getByRole("button", { name: "Send message" }).click();
		await page.getByText("PhaseAtomic is missing.", { exact: false }).waitFor();
		assert.equal(lastTurn.action, "discuss");
		await page.getByLabel("Simulation horizon").fill("400");
		await page.getByRole("button", { name: "Verify this version" }).click();
		await page
			.getByText("Execution needs attention", { exact: true })
			.waitFor();
		assert.equal(lastTurn.maxTime, 400);
		await page
			.getByLabel("Target framework")
			.selectOption("devsimpy-python@1.0.0");
		await page.getByRole("button", { name: "Adapt and verify" }).click();
		await page.getByText("Verification passed", { exact: true }).waitFor();
		// Leave the import through the library creation link, then reopen it from
		// the navigation landing page rather than relying on browser history.
		await page
			.getByRole("button", { name: "Keep this version" })
			.first()
			.click();
		await page.getByRole("link", { name: "Create a library" }).click();
		await page.waitForURL(/library\/new/);
		await page.goto(`${front}/import`);
		await page.getByRole("button", { name: "Resume External source" }).click();
		await page.getByText("Verification passed", { exact: true }).waitFor();
		await page.getByText("PhaseAtomic is missing.", { exact: false }).waitFor();
		assert.equal(
			await page.getByRole("region", { name: "Verification attempts" }).count(),
			1,
		);
		assert.equal(lastTurn.targetIntegrationId, "devsimpy-python");
		assert.equal(lastTurn.targetIntegrationVersion, "1.0.0");
		assert.equal(
			analysisCount,
			2,
			"Resume must reuse the stored files, without uploading again",
		);
		await page.setViewportSize({ height: 844, width: 390 });
		await page.screenshot({
			fullPage: true,
			path: "../tmp/import-review-mobile.png",
		});
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth > innerWidth + 2,
			),
			false,
		);
		await page
			.getByRole("button", { exact: true, name: "Discard import" })
			.click();
		await page.waitForURL((url) => !url.searchParams.has("job"));
		assert.equal(cancelled, true);
		assert.equal(errors.length, 0, errors.join("\n"));
		console.log("PASS_AI_DIRECTORY_CONVERSION_CANCEL_AND_MOBILE");
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
