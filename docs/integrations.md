# Integrations and language assistance

DEVSForge currently ships **xDEVS Python**, **xDEVS Go**, **xDEVS Java**, **MS4 Me Java** and **DEVSimPy Python**. The xDEVS integrations are DEVSForge's existing modeling adapters inspired by xDEVS, not a guarantee that every upstream xDEVS model can run unchanged. MS4 Me uses its bundled Closure-DEVS library and a separate atomic RPC adapter; see its [architecture and tests](../simulator/runner/integrations/ms4me-java/README.md). DEVSimPy uses the real Apache-2.0 PyPDEVS modeling sources referenced by its repository; its [guide](../simulator/runner/integrations/devsimpy-python/README.md) explains native ports, complete input/output bags, parameters and confluent transitions. Coupled models retain DEVSForge's existing flattening path, including mixed-framework assemblies.

## One definition per framework, language, and version

Each folder in `simulator/runner/integrations/` owns:

- `integration.json`: identity, version, Monaco language, resource locations, preparation key, LSP launch configuration, and permitted server commands;
- `wrapper/`: the actual modeling library, RPC adapter, dependency declarations and runtime project;
- `prepare.go`: the compiled Go adapter, split into source preparation and execution;
- `templates/atomic.tmpl`: the initial model;
- `ai/model.md`: generation instructions, combined with the template and the actual modeling sources listed in `context`;
- `generate-proto.sh`: reproducible generation entrypoint for its language.

The shared catalogue loader validates resources and derives capabilities. It reads `INTEGRATIONS_DIR`. Native development finds the repository automatically; Docker images set the path explicitly. The same repository resources are packaged in the backend, simulator and LSP images. The browser obtains metadata from the API and never maintains a second modeling library.

The database catalogue is a projection used by foreign keys, not a second configuration source. Atomic models reference `integrationId` and `integrationVersion`. Coupled models have neither and can combine different atomic integrations. The `language` response is derived. Legacy language requests and `/languages` routes remain compatibility adapters to the initial integrations.

A content fingerprint protects existing production versions. Keep old integration folders while models reference them; create a new version for incompatible modeling changes. Startup refuses missing integration resources that are still referenced by models. New versions can live in sibling folders with the same ID and a different version; keep only one catalogue default and keep legacy aliases on the original versions. Development Compose and Air explicitly allow resource refreshes with `INTEGRATIONS_ALLOW_CHANGES=true`; do not enable that setting in production.

## Adding another integration later

1. Add its definition and resources beside the existing integrations. Use a distinct framework/language ID; the language alone is insufficient.
2. Implement its modeling/RPC adapter, source preparation and execution. Register the preparation in the runner's integration registry. Existing preparations can be reused when compatible.
3. Provide a template and, when supported, AI instructions and LSP configuration. Context paths point at real library sources. The combined AI context is limited to 180 KB.
4. Install the required toolchains and dependencies in the appropriate targets of the single `simulator/Dockerfile`. The deployment installs declared dependencies at image build time, not on every editor keystroke.
5. Generate bindings for the new programming language if needed. A new framework using an already-supported language can reuse compatible bindings. Unchanged protocol definitions do not require regenerating all other languages.
6. Validate an isolated model, mixed-language input/output, editor completion/diagnostics, and the deployment images. Rebuild/restart the components. No frontend supported-language enum is required; a previously unknown syntax may still need an editor grammar.

There are no Git submodules or runtime-loaded Go plugins. A new Go preparation adapter requires rebuilding the runner. Library sources are kept separate from the common Go gRPC client/server bindings in `simulator/shared/proto/`.

## LSP behavior

The existing runner binary accepts `--lsp-daemon` and starts only the language service, without Kafka. An analysis workspace is shared by account, browser window, integration and version. Each attached document has its own project and buffer; switching tabs does not stop the engines. Python uses Pyright and Ruff, Go uses gopls, Java uses Eclipse JDT LS. Java model execution remains on JDK 21; JDT LS runs on its own JDK 25.

Source preparation is shared with simulation, but opening an editor never runs the model or its factory. Python sees its actual modeling sources (`modeling` for xDEVS, `pypdevs` for DEVSimPy) and standard-library stubs; Go sees its module and toolchain; Java sees the Maven project and its modeling classes. Eclipse workspace state is stored beside the project rather than inside it.

`POST /lsp/sessions` is authenticated and checks ownership for saved models. Drafts supply an integration, a stable document identity and unsaved code. The display label is independent of source paths: Python and Go use fixed filenames, and Java reads the public type declaration. The response includes document/workspace URIs and WebSocket endpoints with one-use, 30-second tickets. Only the backend can reach the internal service using `LSP_INTERNAL_TOKEN`.

Completion, signatures, hover, diagnostics, definitions, references, formatting, rename and supported code actions use normal LSP features. Library navigation opens read-only source views. File edits are restricted to the attached user documents; server commands must be explicitly permitted by the integration. Typing is kept available when language assistance fails or is busy. Retry reconnects using the current unsaved buffer.

Initial limits for an **8 GB VPS**:

- 4 GiB container memory limit;
- six active workspaces total, at most two Java;
- two engine initializations at a time, at most one Java initialization;
- workspaces expire after fifteen minutes without user interaction;
- Java heap limited to 768 MiB, which is not a total process-memory limit.

Limits are configured with `LSP_MEMORY_LIMIT`, `LSP_MAX_SESSIONS`, `LSP_MAX_JAVA_SESSIONS`, `LSP_MAX_INITIALIZATIONS`, and `LSP_IDLE_SECONDS`. Workbench requests wait in an interruptible FIFO queue; the queue itself is bounded and returns HTTP 429 when full. Under pressure, the least recently used workspace with no documents or at least one minute without interaction is released first, respecting the Java limit. Legacy clients without a workbench identity retain immediate capacity errors. Idle closures, explicit closes and service shutdown terminate engine processes and remove workspaces. These limits do not promise ten concurrent Java editors; benchmark before increasing them.

## Development, checks and deployment

Run `task lsp:setup` once to populate a missing internal token without changing an existing one. `task back:dev` also runs this step. Continue using `task back:dev` and `task front:dev`. `LSP_ALLOWED_ORIGINS` lists additional browser origins for separate frontend/backend development ports; production same-host connections are accepted. The token remains server-side.

Use `task back:test`, `task front:test`, `task front:build`, and `task simulator:lsp:test`. The latter builds the LSP target and exercises real engines, including custom modeling APIs and standard-library completion. The real-engine suite is opt-in outside that target with `LSP_REAL_SERVERS=1`.

All runtime targets now live in `simulator/Dockerfile`: `production`, `development`, `runner`, and `lsp`. Compose and CI select the appropriate target. Dependency-download layers depend on manifests rather than library source edits. The image also compiles the Go framework packages and caches Python bytecode. Java libraries are downloaded before runtime; private Java indexes remain with each running workspace.

Before production rollout, back up PostgreSQL using your normal `pg_dump` procedure, configure the internal LSP token, and deploy matching backend/simulator/LSP/frontend images together. Migrations run on backend startup. The migration preserves existing model data and replaces language enums with catalogue references. Downgrade refuses profiles that the old schema cannot represent. No VPS deployment is performed by the implementation work.

LSP argument placeholders are `{workspace}` (the first source project; commands should normally use `{session}`) and `{session}` (its private parent directory). Keep language-server metadata outside the source project when required by the server, as with Eclipse's workspace. `allowedCommands` is a per-engine allowlist; edits and command document URIs remain limited to the attached user documents.

### Local verification results

The migration was checked against an existing seeded database, including preservation of model content, foreign keys, immutable versions and refusal of a destructive downgrade. Real language-server checks cover Python `self.get_phase` / `math.sqrt`, Go modeling methods / `math.Sqrt`, and Java inheritance / `Math.sqrt`. Browser checks exercised completion, diagnostics, read-only library navigation, formatting, rename, two simultaneous editors with isolated diagnostics, idle expiry and reconnection with the unsaved buffer intact. The mixed Python/Go/Java simulation retained its 25-message reference trace and outputs (5, 15, 30).

The current local Docker measurements (November 6, 2026, development Mac) use the six-workspace limits:

| Attempted clients | Active / queued | LSP service memory | After closing all clients |
| --- | --- | --- | --- |
| 1 (Python) | 1 / 0 | 162 MiB | 49 MiB |
| 5 (Python, Go, Java) | 5 / 0 | 1.52 GiB | 76 MiB |
| 10 (mixed, with a simulation) | 6 / 4 | 2.18 GiB | 65 MiB |

Source acquisition took 85–282 ms in this sample. First useful custom-library completion took about 0.9–2.3 seconds in Python, 0.6–4.2 seconds in Go, and 7–12.3 seconds in Java. Java's private index still has a startup cost; an already-open document keeps its model, undo stack and engines when switching tabs. The waiting workspace advanced after an active workspace was released. These short samples demonstrate resource release and enforcement of the configured limit, not long-duration leak testing or a VPS capacity guarantee. Memory figures describe the LSP service, not the entire stack; simulation build CPU can be significant.

## Model workbench and local recovery

`WorkbenchProvider` sits above the authenticated pages. Model tabs span libraries and coupled/atomic models. A switch does not save anything on the server. The existing save/simulate/validate actions apply to the active model. Closing a dirty tab offers Save, Discard and Cancel.

IndexedDB stores tab drafts, diagram state and generation conversations. A sessionStorage pointer identifies the recovery snapshot for that account/window; a new page instance copies that snapshot into a fresh workspace identity. Duplicate windows therefore start from a copy and then evolve independently. Monaco models stay alive across tab navigation, retaining undo, cursor and scroll state. A reload restores local content and reattaches language assistance; undo history is retained during navigation but is not serialized across reloads. Browser storage failures are visible in the header. Local drafts are not a server backup.

The client preloads Monaco during browser idle time after authentication. Browser Performance entries `devsforge:editor-preload` / `devsforge:editor-ready` expose that phase; the browser check observed 4.2 seconds for the development Monaco preload, separately from server startup. The daemon logs source preparation and per-engine initialization separately; the load sample above measures the first useful completion rather than treating initialization as indexing completion.

`POST /lsp/sessions` acquires/reuses a workspace and attaches its document. `GET /lsp/sessions/{id}` exposes status, `POST /lsp/sessions/{id}/tickets` renews unused connection tickets, and `DELETE /lsp/sessions/{id}/documents/{document}` detaches one document. Deleting the session releases the entire workspace. All backend routes authenticate the account; attaching an existing model checks its owner. UTF-16 incremental edits are persisted by document version, once for Pyright/Ruff's shared buffer. A late document-close notification cannot close the other documents' engines.

Closing a tab detaches its editable buffer while retaining its prepared analysis project and registration in the workspace. Removing a Java project immediately can invalidate completion in another project. Reopening a model reuses its framework links and metadata, replaces the user source with the current editor content and starts a fresh document version. Cached projects remain private to the account/window/integration; expiry, eviction, explicit workspace closure or daemon shutdown removes the entire cache. No background model execution or server save is triggered.

For a VPS with an existing Compose file and Traefik, see the [LSP service configuration](lsp-vps.md).

## Hierarchy and AI refinement

Generated occurrences are expanded recursively with real parent IDs and relative positions. Connections carry their coupled `owner`; legacy missing owners are inferred only if unambiguous. Internal couplings and boundary input/output couplings are validated at their own level. Containment cycles are rejected; DEVS feedback connections remain valid. Save creates children before parents and retains component layout metadata. EF target models are opaque existing references: their original coupled components and code are never recreated by the assisted save.

DEVS Generator and EF structures use the same discussion panel. The initial request, history and current structure remain visible. Corrections send the current structure and at most six recent messages plus the initial request. Code is attached only when explicitly selected. Oversized requests fail explicitly (250 KiB client preflight, 256 KiB backend limit). The complete local history is retained, but request history is bounded.

A correction produces a proposal with explicit validation issues. Accept is disabled while the proposal is invalid or the current structure has changed since the request. Reject leaves the current structure intact. Acceptance retains existing code and integration references; changed ports mark that code for explicit interface review before saving. No paid generation starts automatically after restore or acceptance.

## Workbench regression checks

`task front:workbench:test` exercises the real browser, backend and LSP. Set both URLs to an **isolated** stack; the test creates its own account, libraries and models. Install the test browser once with `cd front && pnpm exec playwright install chromium`, or provide an existing Chrome executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

```sh
WORKBENCH_TEST_API_URL=http://localhost:13000 \
WORKBENCH_TEST_FRONT_URL=http://localhost:5187 \
task front:workbench:test
```

The frontend must use a `VITE_API_BASE_URL` matching the isolated API, and that backend must allow the test frontend origin through `LSP_ALLOWED_ORIGINS`. For example, launch it in another terminal with `VITE_API_BASE_URL=http://localhost:13000 task front:dev -- --host 127.0.0.1 --port 5187`.

The committed browser check covers `light ` / `switch`, repeated switching with the same LSP sockets, cursor and undo, IndexedDB reload, homonyms, diagnostics isolation and Save/Discard/Cancel. Additional local checks covered retained buffers and undo with the LSP unavailable, independent duplicate windows and accounts, proposal acceptance/rejection and conversation recovery with mocked AI responses (no paid requests), and three EF nesting levels around atomic and coupled targets. The mixed simulation again matched its 25-message reference, including outputs 5, 15 and 30.

The DEVSimPy integration was checked with the complete backend suite, complete simulator suite in Docker, frontend unit tests and production build. Real language-server tests cover all five integrations. A native upstream Parallel DEVS TrafficLight is exercised, and the mixed-framework chain produces 5 → 15 → 30 → 90 → 180. Python bridge tests also cover complete bags, duplicates, list payloads, clock alignment, constructor parameters, native confluence, invalid inputs and resource cleanup. A mixed Go/PyPDEVS test checks several simultaneous messages on one input port in one transition. No paid AI request was needed. Full simulation tests require Docker, ephemeral Kafka containers, writable simulation directories and the image's Java/Python toolchains; the source-only catalogue tests can run on the host.
