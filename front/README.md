# DEVSForge Frontend

The `front/` module is the React + TypeScript application for DEVSForge. It provides authentication, model editing, AI-assisted generation, simulation visualization, experimental-frame workflows, and WebApp deployment UX.

## Quick Links
- [Root README](../README.md)
- [Backend README](../back/README.md)
- [Simulator README](../simulator/README.md)
- [Wrappers README](../simulator/wrappers/README.md)
- [Reproducibility Guide](../docs/reproducibility.md)

## Stack
- React 18 + TypeScript
- Vite
- React Router
- Tailwind + UI components
- React Flow (`@xyflow/react`) for modeling views
- `openapi-fetch` + `swr-openapi` for typed API integration

## Application Architecture
- Entry point: `src/main.tsx`
- Main app/router: `src/App.tsx`
- Auth provider/session lifecycle: `src/providers/AuthProvider.tsx`
- API client middleware and token refresh: `src/api/client.ts`
- Feature pages: `src/pages/*`
- Generator workflow UI: `src/pages/generator/GeneratorFlow.tsx`
- Simulation UI: `src/components/custom/SimulationPanel.tsx`

## Main Route Map
- `/login`, `/register`
- `/` (home / libraries overview)
- `/library/new`
- `/library/:libraryId/model/:modelId`
- `/library/:libraryId/model/:modelId/simulate`
- `/library/:libraryId/model/:modelId/validate`
- `/library/:libraryId/model/:modelId/webapp`
- `/devs-generator`
- `/webapps`, `/webapps/:deploymentId`
- `/settings`
- `/getting-started`, `/how-it-works`

## Auth and API Pattern
- Access token is stored in `localStorage`.
- API middleware injects `Authorization: Bearer <token>` for protected endpoints.
- If token is close to expiration, middleware calls `/auth/refresh` automatically.
- Session-expired and token-refreshed events synchronize UI/auth state.
- OpenAPI-generated types (`src/api/v1.d.ts`) keep request/response contracts aligned with backend.

## Functional Flows
### AI Generator
1. User submits a structure prompt.
2. Front calls `/ai/generate-diagram`.
3. User edits generated structure.
4. Front calls `/ai/generate-model` for atomic behavior code.
5. Generated models are saved as library + models through backend CRUD endpoints.

### Experimental Frame Validation
- EF structure generation: `/ai/generate-ef-structure`.
- EF models are validated against model-under-test interface constraints before save.

### Simulation
1. Front creates simulation: `POST /simulation/{modelId}`.
2. Front starts simulation: `POST /simulation/{simId}/start`.
3. Front polls `GET /simulation/{simId}/events` and renders timeline/status.

### WebApp Deployment
- Deterministic skeleton: `/webapp/skeleton/{modelId}`.
- AI refinement: `/webapp/generate`.
- Deployment persistence: `/webapp/deployment` (CRUD).

## Environment
Create `.env.front` from `.env.front.dist`.

Required variable:
- `VITE_API_BASE_URL` (example: `http://localhost:3000/`)

## Local Development
From `front/`:
```bash
pnpm install
pnpm dev
```

Other useful commands:
```bash
pnpm build
pnpm typecheck
pnpm test
```

From repository root:
```bash
pnpm run start:front
pnpm run typecheck
```

## Runtime Notes
- Frontend can run with the default root stack (`docker compose up --build`).
- Simulation features require Kafka on backend side. Use the backend simulation-ready stack documented in [back/README.md](../back/README.md).

## Related Docs
- [Root README](../README.md)
- [Backend README](../back/README.md)
- [Simulator README](../simulator/README.md)
- [Wrappers README](../simulator/wrappers/README.md)
- [Reproducibility Guide](../docs/reproducibility.md)
