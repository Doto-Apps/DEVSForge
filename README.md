# DEVSForge 

DEVSForge is an AI-assisted modeling and simulation platform for DEVS systems. It combines:
- a Go backend API,
- a React frontend modeler,
- a distributed simulator (coordinator + runners),
- language wrappers (Go and Python) for executable atomic models.

## Repository Navigation
| Module | Purpose | Documentation |
| --- | --- | --- |
| `back/` | API, persistence, AI generation, simulation orchestration | [back/README.md](back/README.md) |
| `front/` | UI for modeling, generation, validation, simulation, webapps | [front/README.md](front/README.md) |
| `simulator/` | DEVS distributed runtime (coordinator, runners, shared contracts) | [simulator/README.md](simulator/README.md) |
| `simulator/wrappers/` | Go/Python wrapper runtimes and gRPC bridge | [simulator/wrappers/README.md](simulator/wrappers/README.md) |
| Reproducibility assets | Case-study protocols and expected experiment flow | [reproducibility.md](docs/reproducibility.md), [light_case.md](docs/light_case.md) |

## Citation
> **How to cite this repository**  
> Citation metadata is available in [`CITATION.cff`](CITATION.cff). On GitHub, this powers the **Cite this repository** panel.

BibTeX example:
```bibtex
@software{dominici_devsforge,
  author       = {Dominici, Antoine and Maliszewski, Dorian and Capocchi, Laurent},
  title        = {DEVSForge},
  year         = {2026},
  url          = {https://github.com/Doto-Apps/DEVSForge}
}
```

## High-Level Architecture
1. Frontend calls backend REST APIs (typed from OpenAPI).
2. Backend stores models/libraries/simulations in PostgreSQL.
3. For simulation, backend generates a runnable manifest and launches the coordinator.
4. Coordinator spawns one runner per atomic model and orchestrates DEVS time progression over Kafka.
5. Runners call wrapper gRPC services (Go/Python) to execute model transitions.
6. Backend consumes simulation events from Kafka and exposes traces/status to frontend polling.

## Quick Start (Release / GHCR)

### Prepare

1. Copy:
```bash
cp .env.release.dist .env.release
```
PowerShell:
```powershell
Copy-Item .env.release.dist .env.release
```
2. Edit `.env.release` and set at least:
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` (or keep placeholders if configured per user later)
- `DEVSFORGE_IMAGE_TAG` (default `latest`)

### Run

```sh
docker compose pull
docker compose up -d
```

### Access to the services

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/swagger/index.html`

### Stop & Cleanup

1. Stop the services
```sh
docker compose down
```

2. _(Optional)_ remove database volume:
```sh
docker volume rm easydevs_db_data
```


## Prerequisites
- Docker and Docker Compose (or Docker Desktop)
- Node.js 20+
- Optional for local non-container execution:
  - Go (workspace modules use Go 1.24+ / 1.25+)
  - Python 3 with gRPC packages
  - pnpm (via `corepack enable`)

## Quick Start from git sources

1. Install prerequisites
2. Create root environment files:
```bash
cp .env.back.dist .env.back
cp .env.front.dist .env.front
```
PowerShell:
```powershell
Copy-Item .env.back.dist .env.back
Copy-Item .env.front.dist .env.front
```

3. Start frontend + backend + kafka + database (dev stack):
```bash
docker compose -f docker-compose.local.yml up --build
```

4. Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/swagger/index.html`

## Development 
1. Install prerequisites
2. Prepare backend-local env file for `back/docker-compose.yml`:
```bash
cp .env.back back/.env.back
```
3. Add/verify in `back/.env.back`:
```bash
KAFKA_ADDRESS=kafka:9092
```
4. Start backend + db + kafka:
```bash
pnpm run start:back
```
5. Start frontend in a second terminal:
```bash
cp .env.front front/.env
pnpm run start:front
```

## Reproducibility (ACM AERCR Hybrid)
This repository is organized for artifact evaluation and reproducibility with a hybrid strategy:
- concise reproducibility overview in this root README,
- full step-by-step protocol in [reproducibility.md](docs/reproducibility.md).

### Artifact Inventory
- Source code: backend, frontend, simulator, wrappers
- Execution contracts: OpenAPI schema, gRPC proto, Kafka message types
- Reproducibility scripts/workflows: Docker compose files + test suites
- Case-study guides: [reproducibility.md](docs/reproducibility.md), [light_case.md](docs/light_case.md)
- Runtime traces/results path: simulation events persisted by backend

### Reproduction Entry Points
- Full case study protocol: [reproducibility.md](docs/reproducibility.md)
- Minimal deterministic scenario: [light_case.md](docs/light_case.md)


## Developer Commands
From repository root:
```bash
pnpm run start
pnpm run start:front
pnpm run start:back
pnpm run generateSDK
pnpm run typecheck
```

Go workspace tasks:
```bash
task build
task lint
task test
task ci
```

Simulator tests (Kafka automatically started):
```bash
go test -v ./simulator/runner/tests/...
go test -v ./simulator/coordinator/tests/...
```

## Additional Resources
- [Backend README](back/README.md)
- [Frontend README](front/README.md)
- [Simulator README](simulator/README.md)
- [Wrappers README](simulator/wrappers/README.md)
- [Reproducibility Guide](docs/reproducibility.md)
- [Light Case](docs/light_case.md)

## License
- Project license is MIT (see [`LICENSE`](LICENSE)); 
