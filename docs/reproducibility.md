# Reproducibility Guide - Satellite Solar Panel Management (DEVSForge)

This document defines a full, copy-paste reproducibility scenario for DEVSForge based on a simple satellite power subsystem.

The scenario demonstrates:

- AI-assisted structure generation
- AI-assisted atomic behavior generation
- Optional Experimental Frame (EF) generation for behavioral checks
- Simulation and trace inspection
- Optional WebApp deployment

---

## DOI

[![DOI](https://zenodo.org/badge/887624150.svg)](https://doi.org/10.5281/zenodo.19219365)

---

## 0) Prerequisites

Required:

- Git
- Docker Desktop (or Docker Engine + Docker Compose v2)
- Free ports: `80` (front), `3000` (back), `5432` (PostgreSQL)

Optional (only for dev mode outside Docker):

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

Expected duration:

- One full reproducibility run (structure + behavior + simulate): ~30 minutes

---

## 1) Install and run DEVSForge locally

### 1.1 Clone the repository

```bash
git clone https://github.com/Doto-Apps/DEVSForge
cd DEVSForge
```

### 1.2 Create `.env` file

```bash
cp .env.dist .env
```

### 1.3 Start the platform

```bash
docker compose -f docker-compose.yml up -d
```

Default services:

- Frontend: `http://localhost`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

---

## 2) Create account, login, and configure AI settings (mandatory)

### 2.1 Create account and login

1. Open `http://localhost`.
2. Click **Sign up**.
3. Register, then login.

### 2.2 Configure AI provider settings

1. Open user menu (bottom-left avatar) -> **Settings**.
2. Fill:
   - **API URL** (example: `https://api.openai.com/v1`)
   - **API Model** (example: `gpt-5.2-2025-12-11`)
   - **API Key**
3. Click **Save settings**.
4. Confirm a masked key badge appears (`Stored key`).

If skipped, AI endpoints fail with messages such as:

- `AI settings are not configured for this user`
- `AI settings are incomplete: apiUrl, apiKey and apiModel are required`

### 2.3 Quick smoke check

Open **Devs Model Generator**, submit a tiny prompt, confirm generated output is returned.

---

## 3) Scenario definition (satellite solar panel manager)

System components:

- `SunSensor`: detects sun presence (`sun_detected = true/false`)
- `Battery`: states `NOT_FULL`, `CHARGING`, `FULL`
- `Controller`: central policy decision
- `PanelMotor`: opens/closes one solar panel

Target policy:

- If sun is detected and battery is `NOT_FULL`, controller open panel.
- When panel is open under charging condition, battery can move to `CHARGING`.
- If no sun, or battery is `FULL`, controller stops charging and close panel.

### 3.1 Reproducibility interpretation for LLM-generated artifacts

In this project, reproducibility does **not** mean byte-for-byte identical generated code across runs.
LLM generation is probabilistic, so implementations can differ while still being correct.

What must be reproducible is:

- The ability to generate a valid **structural model** (components + couplings).
- The ability to generate valid **behavioral atomics** that respect the shared I/O contract.
- Successful communication between models (messages flow through the expected ports).
- A coherent global behavior matching the policy-level checkpoints.

Generation errors can occur and are part of normal usage.
When they occur, correction can be done by:

- AI-assisted regeneration/refinement.
- Expert manual edits by a developer/modeler.

For reproducibility reporting, keep the final prompts, the final accepted models, and a short note about fixes applied.



---

## 4) Step A - Generate structure

### 4.1 Open generator

1. Click **Devs Model Generator**.
2. Set **Diagram name**: `SatellitePowerSystem`.

### 4.2 Structure prompt (copy/paste)

```text
Create one coupled DEVS model named SatellitePowerSystem with exactly 4 atomic components:
- SunSensor
- Battery
- Controller
- PanelMotor

Use EXACT port names and directions (do not rename):
- SatellitePowerSystem (coupled): out port controller_status
- SunSensor: out port sun_state
- Battery: in port charge_cmd, out port battery_state
- PanelMotor: in port panel_cmd, out port panel_state
- Controller: in ports sun_state, battery_state, panel_state; out ports panel_cmd, charge_cmd, controller_status

Use EXACT couplings:
- SunSensor.sun_state -> Controller.sun_state
- Battery.battery_state -> Controller.battery_state
- Controller.panel_cmd -> PanelMotor.panel_cmd
- PanelMotor.panel_state -> Controller.panel_state
- Controller.charge_cmd -> Battery.charge_cmd
- Controller.controller_status -> SatellitePowerSystem.controller_status

No extra models, no extra ports, no extra couplings.
```

Expected outcome:

- Root coupled model + 4 atomics
- Port names exactly as specified
- Valid couplings

---

## 5) Step B - Generate atomic behaviors

After structure generation, DEVSForge enters behavior generation.

Recommended options for reproducibility:

- Language: `Python` (or `Go`, but keep one language for all atomics)
- Reuse mode: **From scratch**

### 5.0 Shared I/O contract (must be reused by all prompts)

- `sun_state`: `{ "type":"sun_state", "sun_detected": true|false }`
- `panel_cmd`: `{ "type":"panel_cmd", "target":"OPEN"|"CLOSE" }`
- `panel_state`: `{ "type":"panel_state", "position":"OPEN"|"CLOSED" }`
- `charge_cmd`: `{ "type":"charge_cmd", "action":"START"|"STOP" }`
- `battery_state`: `{ "type":"battery_state", "level":"NOT_FULL"|"CHARGING"|"FULL" }`
- `controller_status`: `{ "type":"controller_status", "sun_detected":bool, "battery_level":"NOT_FULL"|"CHARGING"|"FULL", "panel_position":"OPEN"|"CLOSED", "panel_target":"OPEN"|"CLOSE", "charge_action":"START"|"STOP" }`

Critical rule for all generated atomics:

- Use the exact port names from structure.
- Use the exact JSON keys from this contract.
- Do not rename ports or keys.

### 5.1 Prompt B1 - SunSensor

```text
Create atomic model SunSensor.
Use exactly one output port: sun_state.
Emit only this JSON format: { "type":"sun_state", "sun_detected": true|false }.
Deterministic timeline:
- t in [0,20): false
- t in [20,80): true
- t >= 80: false
Emit on initialization and whenever value changes.
Do not add extra ports or extra message keys.
```

### 5.2 Prompt B2 - Battery

```text
Create atomic model Battery with states: NOT_FULL, CHARGING, FULL.
Use exactly:
- input port charge_cmd with { "type":"charge_cmd", "action":"START"|"STOP" }
- output port battery_state with { "type":"battery_state", "level":"NOT_FULL"|"CHARGING"|"FULL" }
Rules (deterministic):
- initial state NOT_FULL
- START from NOT_FULL -> CHARGING
- after 20 time units in CHARGING -> FULL
- STOP from CHARGING -> NOT_FULL
Emit initial state and each state change.
Do not rename ports or JSON keys.
```

### 5.3 Prompt B3 - PanelMotor

```text
Create atomic model PanelMotor.
State: OPEN or CLOSED (initial CLOSED).
Use exactly:
- input port panel_cmd with { "type":"panel_cmd", "target":"OPEN"|"CLOSE" }
- output port panel_state with { "type":"panel_state", "position":"OPEN"|"CLOSED" }
Rules (deterministic):
- OPEN command when CLOSED -> OPEN after 1 time unit
- CLOSE command when OPEN -> CLOSED after 1 time unit
- ignore redundant commands
Emit initial state and each transition.
Do not add panel_id and do not rename keys.
```

### 5.4 Prompt B4 - Controller

```text
Create atomic model Controller.
Inputs: sun_state, battery_state, panel_state.
Outputs: panel_cmd, charge_cmd, controller_status.

Policy:
- if sun_detected=true and battery level=NOT_FULL:
  - open panel
  - when panel position is OPEN, send charge_cmd START
- otherwise:
  - send charge_cmd STOP
  - close panel

Read exact input formats:
- sun_state: { "type":"sun_state", "sun_detected": true|false }
- battery_state: { "type":"battery_state", "level":"NOT_FULL"|"CHARGING"|"FULL" }
- panel_state: { "type":"panel_state", "position":"OPEN"|"CLOSED" }

Emit exact output formats:
- panel_cmd: { "type":"panel_cmd", "target":"OPEN"|"CLOSE" }
- charge_cmd: { "type":"charge_cmd", "action":"START"|"STOP" }
- controller_status: {
    "type":"controller_status",
    "sun_detected": bool,
    "battery_level": "NOT_FULL"|"CHARGING"|"FULL",
    "panel_position": "OPEN"|"CLOSED",
    "panel_target": "OPEN"|"CLOSE",
    "charge_action": "START"|"STOP"
  }

Only emit command changes (no spam), deterministic behavior.
Do not rename ports or JSON keys.
```

---

## 6) Optional Step C - Generate an Experimental Frame (EF)

### 6.1 EF objective

Validate these reproducibility properties with a minimal EF workflow:

- `START` charging is never issued unless panel is OPEN and sun is true.
- When battery is FULL, charging command is STOP and panel eventually becomes CLOSED.
- With no sun, charging remains STOP.

No transducer is required here. Use a single validator/acceptor model.

### 6.2 Open the EF panel in the UI

1. Open your target model in the model editor.
2. In the top-right toolbar, click the small **shield icon** (Validation / EF).
3. This opens the EF generation window where you can submit the structural prompt first, then the behavior prompt.

### 6.3 EF structural prompt - Validator only (copy/paste)

```text
Create the EF structure for SatellitePowerSystem using only one validator model.

Create exactly one atomic model named SatelliteValidator with:
- input port: controller_status
- output port: validation_result

Do not create generator or transducer.
Do not add extra models, ports, or couplings.
Keep it minimal: validator-only EF structure.
```

### 6.4 EF behavior prompt - SatelliteValidator (copy/paste)

```text
Create behavior code for atomic model SatelliteValidator.

Ports:
- input: controller_status
- output: validation_result

Behavior:
- Consume observations and produce a verdict message:
  { "type":"validation_result", "status":"PASS"|"WARN"|"FAIL", "reason":"..." }
- Keep internal memory of the latest sequence of controller decisions.

Expected behavior to validate:
1) START is allowed only when:
   - sun_detected=true
   - battery_level=NOT_FULL
   - panel_position=OPEN
2) If battery=FULL, controller must issue STOP and eventually panel becomes CLOSED.
3) If sun_detected=false, controller must not request START.

Verdict policy:
- FAIL if rule (1) is violated at least once, or if rules (2)/(3) are clearly violated.
- WARN if behavior is incomplete at end of run (for example waiting for eventual close).
- PASS if all rules are satisfied over the run.

Keep logic simple, explainable, and suitable for reproducibility demos.
```

---

## 7) Simulation run and expected checkpoints

1. Open the validated coupled model.
2. Click **Play**.
3. Run until at least simulation time `100`.

Expected qualitative timeline:

- Near `t=0`: no sun, panel closed, charging STOP.
- Around `t=20`: sun becomes true -> controller opens panel.
- Shortly after panel opens: controller sends `START` -> battery enters `CHARGING`.
- About 20 time units after charging start: battery becomes `FULL`.
- After battery is FULL: controller sends `STOP` and closes panel.
- Around `t=80`: sun becomes false (system already in non-collection mode).

Expected traces to observe:

- `sun_state` toggles at deterministic times
- `panel_state` transitions for panel motor
- `battery_state` transitions `NOT_FULL -> CHARGING -> FULL`
- `controller_status` decisions matching policy

Example exported result (JSON):

- [Example generation output (`exemple-result.json`)](./exemple-result.json)

---

## 8) Optional Step D - WebApp deployment

1. In model page, click **WebApp deployment**.
2. Use this prompt:

```text
Build a simple UI for this model:
- show sun status
- show battery state
- show panel state
- show current controller decision
- keep the Simulate action visible
```

Expected outcome:

- A generated UI aligned with model I/O contract
- A visible simulation trigger
- Traceable status fields

---

## 9) Artifacts to archive for reproducibility package

Archive at least:

- Generated structure
- Atomic behavior code for: `SunSensor`, `Battery`, `Controller`, `PanelMotor`
- Validation outputs/logs
- EF artifacts (if generated)
- Simulation traces/logs
- Optional WebApp config/code

This set is sufficient for an external reviewer to re-run the same scenario end-to-end in DEVSForge.

---

## 10) Optional: external analysis with Grafana + JSON export

If you want to analyze outputs outside DEVSForge:

1. Run the simulation, then click **Export JSON** in the Simulation panel.
2. In Grafana, use the **Infinity** plugin.
3. Create an Infinity datasource/query with **JSON Inline** and paste the exported JSON content.
4. Build simple charts/tables using fields like `simulationTime`, `devsType`, `sender`, `target`, and payload values.

Use this mainly to compare runs at the **behavior/invariant** level (message consistency, policy compliance), not strict text/code equality.
