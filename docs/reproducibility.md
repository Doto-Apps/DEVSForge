# Reproducibility Guide - Smart Parking Case Study (DEVSForge)

This document describes a click-by-click reproducibility path for the Smart Parking case study presented in the paper, focusing on:
- Coupled structure generation (conflict-management topology)
- Atomic behavior generation (Sensor, Broadcaster, User, ConflictManager)
- Deterministic verification ("Validate diagram" gates)
- Experimental-Frame (EF) generation (Transducer + Acceptor focused on conflict semantics)
- Simulation and trace inspection
- WebApp deployment (UI generation from the validated model contract)

Note: the sensor behavior refinement step is excluded from the main path (no P2 loop). An optional note is still provided at the end.

---

## 0) Prerequisites

Required:
- Git
- Docker Desktop (or Docker Engine + Docker Compose v2)
- Free ports: `5173` (front), `3000` (back), `5432` (PostgreSQL)

Optional (only for local expert mode outside Docker):
- Node.js 20+
- pnpm 10+
- Go 1.24+

### 0.1 Reference hardware used for the experiments

- Motherboard: Gigabyte B650 EAGLE AX (BIOS F33b)
- CPU: AMD Ryzen 7 7800X3D (8 cores / 16 threads)
- RAM: 64 GB detected (2 modules, 4800 MHz)
- GPUs: NVIDIA GeForce RTX 5080, AMD Radeon(TM) Graphics
- Storage: 3 SSDs of 931.5 GB each (CT1000BX500SSD1, Samsung 990 EVO Plus 1TB, Samsung 860 QVO 1TB)
- OS: Microsoft Windows 11 Professional (10.0.26100)

---

## 1) Install and run DEVSForge locally

### 1.1 Clone the repository

```bash
git clone https://github.com/Doto-Apps/DEVSForge
cd DEVSForge
```

### 1.2 Create `.env` files

Bash:

```bash
cp .env.back.dist .env.back
cp .env.front.dist .env.front
```

PowerShell:

```powershell
Copy-Item .env.back.dist .env.back
Copy-Item .env.front.dist .env.front
```

### 1.3 Start the platform (development)

```bash
docker compose -f docker-compose.local.yml up --build
```

Default services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

---

## 2) Create account, login, and configure AI settings (mandatory)

### 2.1 Create account and login

1. Open `http://localhost:5173`.
2. Click **Sign up**.
3. Register, then login.

### 2.2 Configure your AI provider settings

This step is mandatory before using AI model/diagram/EF generation.

1. Open user menu (bottom-left avatar) -> **Settings** (or go to `/settings`).
2. Fill:
   - **API URL** (example: `https://api.openai.com/v1`)
   - **API Model** (example: `gpt-4.1-mini`)
   - **API Key**
3. Click **Save settings**.
4. Verify that a masked key badge appears (`Stored key`).

If this step is skipped, AI endpoints will fail with errors such as:
- `AI settings are not configured for this user`
- `AI settings are incomplete: apiUrl, apiKey and apiModel are required`

### 2.3 Quick smoke check

Open **Devs Model Generator**, submit a small prompt, and confirm the request returns generated content.

---

## 3) Case study step A - Generate the coupled structure (conflict management topology)

### 3.1 Open the generator

1. Click **Devs Model Generator**.
2. Fill **Diagram name** (example): `SmartParking_Conflict`.

### 3.2 Paste the structure prompt (P3)

Paste the prompt below into the structure-generation textbox and run generation.

```text
Define a DEVS model where three atomic sensors connect to a single broadcaster
through the same port. The broadcaster distributes messages to three atomic users,
which in turn connect to one atomic conflict manager via a shared port.
The conflict manager sends detected conflicts back to the broadcaster
through a separate port.
```

Expected outcome:
- A generated topology with `3 Sensors -> 1 Broadcaster -> 3 Users -> 1 ConflictManager`
- A feedback link `ConflictManager -> Broadcaster`

---

## 4) Case study step B - Generate atomic behaviors (per component)

After structure generation, DEVSForge switches to the second step: **behavior generation**.

### 4.1 Choose language and reuse mode

For each atomic model:
- Select the target language (Python or Go)
- Choose **From scratch** for strict de novo generation
- Or leave **From scratch** unchecked to let the platform attempt reuse-first retrieval/adaptation

For reproducibility in a clean environment, **From scratch** is the simplest.

### 4.2 Prompts to use (one per atomic model)

Below are ready-to-paste prompts.
They are designed to keep message schemas consistent across the pipeline.

#### B1 - Sensor (occupancy + predicted duration class)

```text
Create an atomic DEVS model named "Sensor" representing an on-street parking presence sensor.

Behavior:
- Two states: "free" and "occupied".
- When the state changes, emit a message on the output port that contains:
  - sensor_id (string)
  - position {x:int, y:int} in a 100x100 map
  - state: "free" | "occupied"
  - duration_class: int in [0..9] ONLY when switching to "occupied"
- Time advance (ta) depends on the hour of day (virtual time computed from timenext, integer simulation time).
- Use the inverse Poisson distribution (Poisson quantile) to generate durations so that:
  - low activity at night,
  - arrivals in the morning,
  - high turnover at noon,
  - releases in the evening.

I/O conventions:
- Output message type field must be: "sensor_update"
- Output schema:
  { "type":"sensor_update", "sensor_id": "...", "position":{"x":..,"y":..}, "state":"free|occupied", "duration_class":0..9|null }

Constraints:
- Emit ONLY on state change.
- Keep computations deterministic given the same RNG seed if a seed parameter is provided.
```

#### B2 - Broadcaster (relay + conflict decisions)

```text
Create an atomic DEVS model named "Broadcaster" that relays messages between sensors, users, and the conflict manager.

Inputs:
- sensor_update messages from any Sensor
- conflict_result messages from ConflictManager
- user_state messages from Users (optional, for monitoring)

Outputs:
- Broadcast sensor_update to all Users
- Broadcast conflict_result to all Users

Message conventions:
- Preserve the input payload as-is (no schema drift), only ensure a consistent envelope:
  - For relayed messages, keep the original "type" and fields.
- Do not invent new required fields.
- If multiple messages arrive, relay them all (order can be FIFO).

Constraints:
- The model must not decide conflicts itself; it only relays.
```

#### B3 - User (movement + intent emission + obey conflict decisions)

```text
Create an atomic DEVS model named "User" representing a driver searching for a parking space on a 100x100 grid.

State:
- position {x:int, y:int}
- target_sensor_id (string|null)
- actual_state: "idle" | "moving" | "parked"

Inputs:
- sensor_update from Broadcaster
- conflict_result from Broadcaster

Outputs:
- user_intent to ConflictManager when choosing / re-choosing a target.
- user_state to Broadcaster for traceability.

Decision policy:
- Maintain a local view of latest sensor states.
- Choose a target among sensors that are currently "free".
- When a conflict_result indicates another winner for the current target, reroute:
  - pick another free sensor and emit a new user_intent.
- When reaching the target position, emit user_state with actual_state="parked" and stop moving.

Message conventions:
- user_intent schema:
  { "type":"user_intent", "user_id":"UserX", "position":{"x":..,"y":..}, "target_sensor_id":"...", "actual_state":"moving" }
- user_state schema:
  { "type":"user_state", "user_id":"UserX", "position":{"x":..,"y":..}, "target_sensor_id":"..."|null, "actual_state":"idle|moving|parked" }

Constraints:
- Ensure termination: eventually, each user reaches "parked" if at least one sensor remains available.
```

#### B4 - ConflictManager (resolve conflicts + strategy parameter)

```text
Create an atomic DEVS model named "ConflictManager" that receives user intentions and decides a winner when multiple users target the same sensor.

Inputs:
- user_intent messages from Users (shared input port)

Outputs:
- conflict_result messages to Broadcaster

Behavior:
- At each decision point, group intents by target_sensor_id.
- If only one user targets a sensor -> no conflict_result needed.
- If 2+ users target the same sensor -> emit exactly one conflict_result with:
  - sensor_id
  - users_in_conflict (array of user_id)
  - winner_id (single user_id)
  - strategy_used ("closest" | "first" | "random")

Strategy:
- Support a parameter/config called "strategy" with values:
  - "closest": winner is the user with minimum Euclidean distance to the target sensor position (if position known from last sensor_update; otherwise fall back to "first")
  - "first": winner is the earliest intent received
  - "random": winner is sampled uniformly among competitors

Message conventions:
- conflict_result schema:
  { "type":"conflict_result", "sensor_id":"...", "users_in_conflict":["UserA","UserB"], "winner_id":"UserA", "strategy_used":"closest|first|random" }

Constraints:
- Never produce two winners for the same sensor at the same simulated time.
- Ensure determinism for "first" and "closest". For "random", allow seed if provided.
```

---

## 5) Validate the diagram (deterministic gates)

Once all atomic behaviors are generated:

1. Click the **Validate diagram** button (top area of the editor).

You should obtain a valid status after gates such as:
- schema compliance
- port integrity
- coupling validity
- unused/orphan checks
- runner availability (depending on selected languages)

After validation:
- A new library entry is added automatically
- The coupled model and all generated atomic models appear in that library

---

## 6) Open the coupled model and locate key actions

1. Go to **Home** and find the newly created library.
2. Open the coupled model `SmartParking_Conflict`.

In the coupled-model page you should see:
- The properties panel (editable metadata, ports, graphical colors, etc.)
- Main buttons (top-right):
  - **Generate Experimental Frame** (shield icon)
  - **WebApp deployment**
  - **Play** (simulate)
  - **Save**

---

## 7) Case study step C - Generate an Experimental Frame (EF) for conflict semantics

### 7.1 Open EF generator

1. Click **Generate Experimental Frame** (shield).
2. Set an EF name, for example: `EF_SmartParking_Conflicts`.
3. Choose EF components:
   - Generators = 0 (the system already produces events)
   - Transducers = 1
   - Acceptors = 1

If the UI requires explicit wiring, connect model-under-test outputs to transducer input, and transducer outputs to acceptor input.

### 7.2 EF prompt (if the EF tool asks for one)

```text
Wrap the existing SmartParking conflict-management coupled model inside an Experimental Frame (EF) focusing on conflict correctness.

EF requirements:
- No Generator component is needed (stimuli come from the model itself).
- Create:
  1) A Transducer that listens to the observable outputs of the model under test (sensor_update, conflict_result, user_state).
     It must compute and expose the following observables:
     - number_of_conflicts (count of conflict_result)
     - per_sensor_winner_uniqueness (boolean: at most one winner_id per sensor_id per time t)
     - no_double_assignment (boolean: no two users reach parked on the same sensor_id)
     - all_users_eventually_parked (boolean by end of run)
  2) An Acceptor that consumes the transducer observables and emits a PASS/FAIL verdict with a short diagnostic.

Oracle (PASS if all true):
- per_sensor_winner_uniqueness == true
- no_double_assignment == true
- all_users_eventually_parked == true

Output:
- Generate EF as DEVS artifacts (Transducer + Acceptor) and compose them with the existing coupled model.
- Preserve existing message schemas (do not modify sensor_update / user_intent / conflict_result / user_state).
```

### 7.3 Run validation on the EF-wrapped system

- Validate the EF diagram (same **Validate** mechanism).
- You can now simulate either:
  - the original coupled model
  - the EF-wrapped coupled model

---

## 8) Simulation and trace inspection

1. Click **Play** (simulate).
2. Run the simulation.

Expected observations (qualitative):
- If two users pick the same target at the same time, a `conflict_result` is emitted with exactly one `winner_id`.
- Losing users reroute and later emit a `user_state` with `actual_state: "parked"` when reaching a new target.
- In EF mode, the acceptor should output PASS (unless a logic error is present).

You can use:
- logs for per-event inspection
- trace/plot tools to visualize activity (counts over time, etc.)

---

## 9) Case study step D - WebApp deployment (UI from contract)

1. In the coupled-model page, click **WebApp deployment**.
2. Provide the UI prompt (P4):

```text
Explain all the different model.
```

Expected outcome:
- An explanation for each model in the `EF_SmartParking_Conflicts`
- A **Simulate** action calling the REST simulation API
- The deployed app appears under the **WebApps** tab

---

## 10) Expected artifacts to cite / archive

For a full reproducibility package, archive:
- The generated coupled structure JSON (topology)
- Each atomic model source file (Sensor, Broadcaster, User, ConflictManager)
- Validation logs (pre/post gates)
- EF artifacts (Transducer + Acceptor)
- Simulation traces (port traces + state snapshots if available)
- WebApp configuration/code

---

## 11) Optional note (excluded from the main path): sensor refinement

If you later want to match the paper's arrival peaks more closely, you can run an additional behavior refinement prompt on the Sensor model (not included above per your request).
