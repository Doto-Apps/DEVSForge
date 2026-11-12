# Integrations and language assistance

DEVSForge currently ships **xDEVS Python**, **xDEVS Go**, and **xDEVS Java**. These are DEVSForge's existing modeling adapters inspired by xDEVS, not a guarantee that every upstream xDEVS model can run unchanged.

## One definition per framework, language, and version

Each folder in `simulator/runner/integrations/` owns:

- `integration.json`: identity, version, Monaco language, resource locations, preparation key and analysis context paths;
- `wrapper/`: the actual modeling library, RPC adapter, dependency declarations and runtime project;
- `prepare.go`: the compiled Go adapter, split into source preparation and execution;
- `templates/atomic.tmpl`: the initial model;
- `ai/model.md`: generation instructions, combined with the template and the actual modeling sources listed in `context`;
- `generate-proto.sh`: reproducible generation entrypoint for its language.

For a file-by-file explanation, start with [the architecture map (French)](architecture-lsp-et-editeur.md).

The shared catalogue loader validates resources and derives capabilities. `capabilities.lsp` indicates available modeling sources, not an installed native command. A matching browser engine must also exist in `front/src/lib/lsp/browser.ts`. It reads `INTEGRATIONS_DIR`. Native development finds the repository automatically; Docker images set the path explicitly. The same repository resources are packaged in the backend and simulator images. The browser obtains metadata from the API and never maintains a second modeling library.

The database catalogue is a projection used by foreign keys, not a second configuration source. Atomic models reference `integrationId` and `integrationVersion`. Coupled models have neither and can combine different atomic integrations. The `language` response is derived. Legacy language requests and `/languages` routes remain compatibility adapters to the initial integrations.

The metadata-only migration `000012_browser_catalog_metadata` translates the three known `1.0.0` fingerprints after removal of native server declarations. Unknown fingerprints are not reset. Model references and modeling resources are unchanged.

A content fingerprint protects existing production versions. Keep old integration folders while models reference them; create a new version for incompatible modeling changes. Startup refuses missing integration resources that are still referenced by models. New versions can live in sibling folders with the same ID and a different version; keep only one catalogue default and keep legacy aliases on the original versions. Development Compose and Air explicitly allow resource refreshes with `INTEGRATIONS_ALLOW_CHANGES=true`; do not enable that setting in production.

## Adding another integration later

1. Add its definition and resources beside the existing integrations. Use a distinct framework/language ID; the language alone is insufficient.
2. Implement its modeling/RPC adapter, source preparation and execution. Register the preparation in the runner's integration registry. Existing preparations can be reused when compatible.
3. Provide a template and, when supported, AI instructions and analysis source paths. Context paths point at real library sources. The combined AI context is limited to 180 KB.
4. Install the required toolchains and dependencies in the simulator image for execution; browser engine builds live in `front/Dockerfile`. The deployment installs declared dependencies at image build time, not on every editor keystroke.
5. Generate bindings for the new programming language if needed. A new framework using an already-supported language can reuse compatible bindings. Unchanged protocol definitions do not require regenerating all other languages.
6. Validate an isolated model, mixed-language input/output, editor completion/diagnostics, and the deployment images. Rebuild/restart the components. No frontend supported-language enum is required; a previously unknown syntax may still need an editor grammar.

There are no Git submodules or runtime-loaded Go plugins. A new Go preparation adapter requires rebuilding the runner. Library sources are kept separate from the common Go gRPC client/server bindings in `simulator/shared/proto/`.

## Browser language assistance

Python (Pyright + Ruff), Go (gopls WebAssembly) and Java (Javacs inside B-JVM WebAssembly) now run locally in the browser. `GET /integrations/{id}/versions/{version}/analysis` provides the catalogue's actual modeling sources with an ETag. The editor sends no keystrokes or LSP sessions to the VPS. Java uses one JVM with isolated per-project class loaders; Python and Go share their engines across documents.

Read [the browser architecture and its limitations](browser-lsp.md) before changing tools or publishing this experimental branch. Java formatting currently organizes imports and annotations. The Python browser port is pinned but old. Dependency installation is not automatic.

## Development, checks and deployment

Keep using `task back:dev` and `task front:dev`. The frontend task prepares static browser tools through Docker, with revisions pinned in the build scripts. `task front:language-tools` rebuilds them explicitly. `task front:lsp:test` checks real browser engines without a database or paid AI requests. Install Chromium once using `pnpm --dir front exec playwright install chromium`.

There is no LSP container, native language-server toolchain or LSP token on the VPS. Publish matching backend/frontend images and remove an existing LSP container using [the deployment notes](browser-lsp.md#déploiement-sur-un-vps-existant). Simulation toolchains remain in `simulator/Dockerfile`; no simulation protocol or integration version was changed for this transport migration.

## Model workbench and local recovery

`WorkbenchProvider` sits above the authenticated pages. Model tabs span libraries and coupled/atomic models. A switch does not save anything on the server. The existing save/simulate/validate actions apply to the active model. Closing a dirty tab offers Save, Discard and Cancel.

IndexedDB stores tab drafts, diagram state and generation conversations. A sessionStorage pointer identifies the recovery snapshot for that account/window; a new page instance copies that snapshot into a fresh workspace identity. Duplicate windows therefore start from a copy and then evolve independently. Monaco models stay alive across tab navigation, retaining undo, cursor and scroll state. A reload restores local content and reattaches language assistance; undo history is retained during navigation but is not serialized across reloads. Browser storage failures are visible in the header. Local drafts are not a server backup.

Monaco preloads during browser idle time after authentication. Browser assistance is pooled by account, window, integration and version. Switching tabs preserves documents and runtime state; closing an actual tab detaches that document. Worker and JVM startup costs are documented separately from the frontend preload in [the browser guide](browser-lsp.md). Library navigation is read-only; user edits remain limited to attached documents. A worker failure preserves the editable buffers.

## Hierarchy and AI refinement

Generated occurrences are expanded recursively with real parent IDs and relative positions. Connections carry their coupled `owner`; legacy missing owners are inferred only if unambiguous. Internal couplings and boundary input/output couplings are validated at their own level. Containment cycles are rejected; DEVS feedback connections remain valid. Save creates children before parents and retains component layout metadata. EF target models are opaque existing references: their original coupled components and code are never recreated by the assisted save.

DEVS Generator and EF structures use the same discussion panel. The initial request, history and current structure remain visible. Corrections send the current structure and at most six recent messages plus the initial request. Code is attached only when explicitly selected. Oversized requests fail explicitly (250 KiB client preflight, 256 KiB backend limit). The complete local history is retained, but request history is bounded.

A correction produces a proposal with explicit validation issues. Accept is disabled while the proposal is invalid or the current structure has changed since the request. Reject leaves the current structure intact. Acceptance retains existing code and integration references; changed ports mark that code for explicit interface review before saving. No paid generation starts automatically after restore or acceptance.

## Workbench regression checks

`task front:workbench:test` exercises the real browser and backend, with local language engines. Set both URLs to an **isolated** stack; the test creates its own account, libraries and models. Install the test browser once with `cd front && pnpm exec playwright install chromium`, or provide an existing Chrome executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

```sh
WORKBENCH_TEST_API_URL=http://localhost:13000 \
WORKBENCH_TEST_FRONT_URL=http://localhost:5187 \
task front:workbench:test
```

The frontend must use a `VITE_API_BASE_URL` matching the isolated API, and the backend CORS configuration must accept that frontend. For example, launch it in another terminal with `VITE_API_BASE_URL=http://localhost:13000 task front:dev -- --host 127.0.0.1 --port 5187`.

The committed browser check covers `light ` / `switch`, repeated switching with the same browser engines, cursor and undo, IndexedDB reload, homonyms, diagnostics isolation and Save/Discard/Cancel. It also opens two Go models and two Java models through the real React editor, checks inherited completion and runtime reuse, and verifies both normal and immediate saves. Earlier integration checks covered independent duplicate windows and accounts, proposal acceptance/rejection and conversation recovery with mocked AI responses (no paid requests), and three EF nesting levels around atomic and coupled targets. Their mixed simulation matched its 25-message reference, including outputs 5, 15 and 30; those simulation results predate the browser-engine migration.

The current browser engine contract checks are in `front/scripts/check-browser-lsp.cjs`. Rerun these checks when updating a browser engine dependency.
