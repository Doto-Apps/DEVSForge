# Islands Mode vs All-in-One Mode

DEVSForge supports two deployment architectures: **Islands Mode** (distributed) and **All-in-One Mode** (monolithic).

## Architecture Comparison

### Islands Mode (`docker-compose.islands.yml`)

In Islands Mode, each component runs as a separate service:

```
┌─────────────┐     HTTP      ┌─────────────┐
│   Backend   │ ────────────> │ Coordinator │
│  (Port 3000)│               │ (Port 8080) │
└─────────────┘               └──────┬──────┘
                                     │
                                     │ Kafka
                                     ▼
                              ┌─────────────┐
                              │   Runner    │
                              └─────────────┘
```

**Characteristics:**

- **Coordinator** runs as an HTTP server (port 8080)
- **Backend** communicates with Coordinator via HTTP calls
- **Simulator** = Coordinator + Runner (separate containers)
- All services are **independent and scalable**

**Benefits:**

- ✅ **Horizontal scaling**: Scale Coordinator independently based on simulation load
- ✅ **Distributed deployment**: Run Coordinator/Runner on different machines
- ✅ **Fault isolation**: Coordinator failure doesn't affect Backend
- ✅ **Flexibility**: Deploy simulators close to computation resources
- ✅ **Auto-scaling**: Kubernetes HPA can scale Coordinator pods

**Use Cases:**

- Production environments with high simulation load
- Multi-node clusters
- When you need to scale simulation capacity independently
- Distributed computing scenarios

**Setup:**

```bash
docker compose -f docker-compose.islands.yml up -d
```

**Environment Variables:**

```bash
# Backend needs Coordinator address 
# Already added in docker-compose.islands.yml
SIMULATOR_ADDR=simulator:8080
KAFKA_ADDRESS=kafka:9092
```

---

### All-in-One Mode (`docker-compose.yml`)

In All-in-One Mode, Backend, Coordinator, and Runner are bundled in a single image:

```
┌─────────────────────────────────────┐
│         AIO Container               │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ Backend  │  │   Coordinator   │  │
│  │(Port 3000)│  │   + Runner      │  │
│  └──────────┘  └─────────────────┘  │
└─────────────────────────────────────┘
```

**Characteristics:**

- **Single image**: `ghcr.io/doto-apps/devsforge-backend-aio`
- **Coordinator** runs internally (not exposed as HTTP service)
- **Backend** launches simulations via **CLI command** (not HTTP)
- **No network overhead** between components

**Benefits:**

- ✅ **Simpler deployment**: Single container to manage
- ✅ **Lower latency**: No HTTP calls between Backend and Coordinator
- ✅ **Easier setup**: Fewer services to configure
- ✅ **Resource efficient**: No inter-service network overhead

**Limitations:**

- ❌ **No independent scaling**: Cannot scale Coordinator alone
- ❌ **Single machine**: All components must run on same host
- ❌ **Coupled resources**: Backend and Simulator share same resources

**Use Cases:**

- Development and testing
- Small-scale deployments
- Single-machine setups
- Quick prototyping

**Setup:**

```bash
docker compose up -d
```

---

## Technical Differences

### Communication Pattern

| Mode | Backend → Coordinator | Launch Method |
|------|----------------------|---------------|
| Islands | HTTP REST API | HTTP POST to `/simulate` |
| AIO | Internal CLI call | `exec.Command()` |

### Docker Images

| Mode | Backend Image | Simulator Image |
|------|--------------|-----------------|
| Islands | `devsforge-backend` (backend target) | `devsforge-simulator` (simulator target) |
| AIO | `devsforge-backend-aio` (all-in-one target) | Included in AIO image |

### Scaling Example

**Islands Mode - Scale Coordinator:**

```bash
# Docker Compose
docker compose -f docker-compose.islands.yml up -d --scale simulator=5

# Kubernetes
kubectl scale deployment coordinator --replicas=10
```

**AIO Mode - Cannot scale Coordinator independently:**

```bash
# Scaling AIO scales everything (Backend + Coordinator + Runner)
docker compose up -d --scale backend=5
```

---

## When to Use Each Mode

### Choose Islands Mode When

- You expect high simulation concurrency
- You need to deploy on multiple nodes
- You want fine-grained resource control
- You're running in production with SLA requirements
- You need auto-scaling capabilities

### Choose AIO Mode When

- You're developing locally
- You have limited infrastructure
- You're running small-scale simulations
- You want simplest deployment
- You're testing or prototyping

---

## Migration Between Modes

### AIO → Islands

1. Update environment variables:

   ```bash
   # Add to .env
   SIMULATOR_ADDR=simulator:8080
   ```

2. Switch compose file:

   ```bash
   docker compose down
   docker compose -f docker-compose.islands.yml up -d
   ```

### Islands → AIO

1. Remove `SIMULATOR_ADDR` from environment

2. Switch compose file:

   ```bash
   docker compose -f docker-compose.islands.yml down
   docker compose up -d
   ```

---

## Performance Considerations

### Islands Mode

- **Network overhead**: ~1-5ms per HTTP call
- **Better isolation**: Dedicated resources per component
- **Load balancing**: Multiple Coordinators distribute load

### AIO Mode

- **Lower latency**: Direct function calls
- **Shared resources**: Backend and Simulator compete for CPU/memory
- **Simpler debugging**: Single container logs

---

## Configuration Reference

### Islands Mode Services

| Service | Port | Purpose |
|---------|------|---------|
| frontend | 5173 | React UI |
| backend | 3000 | REST API, PostgreSQL, AI generation |
| simulator | 8080 | Coordinator HTTP server + Runner |
| db | 5432 | PostgreSQL |
| kafka | 9092 | Message broker |

### AIO Mode Services

| Service | Port | Purpose |
|---------|------|---------|
| frontend | 80 | React UI (nginx) |
| backend | 3000 | REST API + Coordinator + Runner |
| db | 5432 | PostgreSQL |
| kafka | 9092 | Message broker |