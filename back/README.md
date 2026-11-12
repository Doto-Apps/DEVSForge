# DEVSForge Backend

The `back/` module is the Go API layer of DEVSForge. It handles authentication, model/library CRUD, AI-assisted generation, simulation orchestration, experimental frames, and WebApp deployment contracts.

## Quick Links

- [Root README](../README.md)
- [Editor and files architecture (French)](../docs/architecture-lsp-et-editeur.md)
- [Simulator README](../simulator/README.md)
- [Integration guide](../docs/integrations.md)
- [Reproducibility Guide](../docs/reproducibility.md)

## Responsibilities

- Serve REST endpoints with Fiber.
- Persist users, models, simulations, events, and deployments in PostgreSQL (GORM).
- Validate and run AI generation workflows (diagram, model code, EF structure, documentation, WebApp UI schema).
- Build runnable manifests from model graphs and launch distributed simulations via the coordinator.
- Persist simulation execution traces and events.

## Architecture

- Entry point: `main.go`
- Routing: `router/router.go`
- HTTP handlers: `handler/*`
- Business logic: `services/*`
- Manifest and conversion utilities: `lib/*`
- DB connection and migrations: `database/*`
- Auth middleware (JWT): `middleware/auth.go`
- OpenAPI/Swagger artifacts: `docs/*`

## API Route Groups

- `/auth`: register, login, refresh, logout, current user.
- `/user`: user profile + AI provider settings.
- `/library`: library CRUD.
- `/model`: model CRUD, recursive model loading, simulation file generation.
- `/simulation`: create/start/list simulations and retrieve simulation events.
- `/experimental-frame`: manual and assisted EF creation around a model under test.
- `/integrations`: versioned catalogue, templates and modeling source bundles for browser analysis.
- `/languages`: compatibility metadata and template routes.
- `/ai`: structured-output generation endpoints.
- `/webapp`: deterministic skeleton generation, AI refinement, deployment CRUD.
- `/health`: health checks.

## Modeling sources for the editor

`handler/language.go` exposes `GET /integrations/{id}/versions/{version}/analysis`.
It delegates file collection to `simulator/shared/integrations/analysis.go` and
handles the HTTP response and ETag. The catalogue and modeling sources come from
`INTEGRATIONS_DIR`, packaged in the backend image. User model CRUD remains in
`handler/model.go`.

There is no analysis process, session ticket or WebSocket relay in the backend.
The [architecture map](../docs/architecture-lsp-et-editeur.md)
explains the handlers and distinguishes modeling sources, saved models and local drafts.

## Environment Configuration

The backend loads `.env` from its working directory when present; Compose supplies the root environment. Use the root `.env.dist` as the reference.

### Core Variables

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `PORT`
- `KAFKA_ADDRESS` (optional, fallback: `localhost:9092`)
- `CLIENT_URL`

### Notes

- Authenticated AI endpoints use per-user provider settings stored in DB (`/user/settings/ai`).

## Run Modes

### 1) Full project from repository root

```bash
docker compose up --build
```

This starts frontend + backend + simulator + kafka + database.

## Swagger and Frontend SDK Generation

From repository root:

```bash
pnpm run generateSDK
```

Equivalent steps:

```bash
cd back
swag init
swagger2openapi -o ./docs/openapi.json ./docs/swagger.json
pnpm dlx openapi-typescript ./docs/openapi.json -o ../front/src/api/v1.d.ts
```

## Simulation Lifecycle (Backend Perspective)

1. `POST /simulation/{modelId}` creates a pending simulation and stores a generated runnable manifest.
2. `POST /simulation/{simId}/start` marks simulation as running.
3. Backend writes manifest to a temporary file.
4. Backend launches coordinator subprocess (`go run . --file ...`).
5. Coordinator spawns runner processes (one per atomic model).
6. Runners execute model transitions via wrapper gRPC.
7. Simulation results are collected and status is updated in database (`completed` or `failed`).

## Troubleshooting

- `Invalid or expired JWT`: login again or refresh token flow failed.
- `AI settings are not configured for this user`: configure API URL/key/model in user settings.
- `coordinator` launch errors: verify `COORDINATOR_PATH` and Go execution permissions.

## Related Docs

- [Root README](../README.md)
- [Editor and files architecture (French)](../docs/architecture-lsp-et-editeur.md)
- [Simulator README](../simulator/README.md)
- [Integration guide](../docs/integrations.md)
- [Reproducibility Guide](../docs/reproducibility.md)
