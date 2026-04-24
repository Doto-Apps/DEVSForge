# Reproducibility Guide - Cold-Chain Warehouse Supervisor (DEVSForge)

This document defines a full, copy-paste reproducibility scenario for DEVSForge based on a cold-chain warehouse control subsystem.

The scenario demonstrates:

- AI-assisted structure generation
- AI-assisted atomic behavior generation
- Optional Experimental Frame (EF) generation for behavioral checks
- Simulation and trace inspection
- Optional WebApp deployment

---

## Step by step video for Reproducibility - Check that !
- [Youtube tutorial](https://www.youtube.com/watch?v=6Xncy-RbDMc)


## DOI

[![DOI](https://zenodo.org/badge/887624150.svg)](https://doi.org/10.5281/zenodo.19219365)

- version : v0.0.4
- zenodo DOI for the version : https://zenodo.org/records/19389671
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

### 1.2 Modify `DEVSFORGE_IMAGE_TAG` in `.env` 

```text
DEVSFORGE_IMAGE_TAG=0.0.4
```

### 1.3 Start the platform

```bash
docker compose pull
docker compose up -d
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
   - **API URL** : `https://api.openai.com/v1`
   - **API Model** : `gpt-5.2-2025-12-11`
   - **API Key**
3. Click **Save settings**.
4. Confirm a masked key badge appears (`Stored key`).

If skipped, AI endpoints fail with messages such as:

- `AI settings are not configured for this user`
- `AI settings are incomplete: apiUrl, apiKey and apiModel are required`

### 2.3 Quick smoke check

Open **Devs Model Generator**, submit a tiny prompt, confirm generated output is returned.

---

## 3) Scenario definition (cold-chain warehouse supervisor)

System components:

- `TempSensor`: publishes cold-room temperature
- `DoorSensor`: publishes whether the loading door is open
- `Supervisor`: central policy decision
- `CoolingUnit`: applies cooling commands
- `AlarmUnit`: applies alarm commands

Target policy:

- If temperature is high, supervisor enables cooling.
- If door is open while temperature is still high, supervisor raises warning alarm.
- When room is cold enough and door is closed, supervisor disables cooling and alarm.

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
2. Set **Diagram name**: `ColdChainSupervisorSystem`.

### 4.2 Structure prompt (copy/paste)

```text
Create one coupled DEVS model named ColdChainSupervisorSystem with exactly 5 atomic components:
- TempSensor
- DoorSensor
- Supervisor
- CoolingUnit
- AlarmUnit

Use EXACT port names and directions (do not rename):
- ColdChainSupervisorSystem (coupled): out port supervisor_status
- TempSensor: out port temp_state
- DoorSensor: out port door_state
- CoolingUnit: in port cooling_cmd, out port cooling_state
- AlarmUnit: in port alarm_cmd, out port alarm_state
- Supervisor: in ports temp_state, door_state; out ports cooling_cmd, alarm_cmd, supervisor_status

Use EXACT couplings:
- TempSensor.temp_state -> Supervisor.temp_state
- DoorSensor.door_state -> Supervisor.door_state
- Supervisor.cooling_cmd -> CoolingUnit.cooling_cmd
- Supervisor.alarm_cmd -> AlarmUnit.alarm_cmd
- Supervisor.supervisor_status -> ColdChainSupervisorSystem.supervisor_status

Important constraints for reproducibility:
- Do not add feedback couplings from CoolingUnit or AlarmUnit back to Supervisor.
- Keep exactly one coupling per pair (no duplicates).
- No extra models, no extra ports, no extra couplings.
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

- `temp_state`: `{ "type":"temp_state", "celsius": number }`
- `door_state`: `{ "type":"door_state", "open": true|false }`
- `cooling_cmd`: `{ "type":"cooling_cmd", "mode":"ON"|"OFF" }`
- `alarm_cmd`: `{ "type":"alarm_cmd", "level":"NONE"|"WARN" }`
- `cooling_state`: `{ "type":"cooling_state", "mode":"ON"|"OFF" }`
- `alarm_state`: `{ "type":"alarm_state", "level":"NONE"|"WARN" }`
- `supervisor_status`: `{ "type":"supervisor_status", "celsius": number, "door_open": bool, "cooling_mode":"ON"|"OFF", "alarm_level":"NONE"|"WARN" }`

Critical rule for all generated atomics:

- Use the exact port names from structure.
- Use the exact JSON keys from this contract.
- Do not rename ports or keys.

### 5.1 Prompt B1 - TempSensor

```text
Create atomic model TempSensor.
Use exactly one output port: temp_state.
Emit only this JSON format: { "type":"temp_state", "celsius": number }.
Deterministic timeline:
- t in [0,20): 2
- t in [20,50): 9
- t in [50,80): 6
- t >= 80: 3
Emit on initialization and whenever value changes.
Do not add extra ports or extra message keys.
```

### 5.2 Prompt B2 - DoorSensor

```text
Create atomic model DoorSensor.
Use exactly one output port: door_state.
Emit only this JSON format: { "type":"door_state", "open": true|false }.
Deterministic timeline:
- t in [0,30): false
- t in [30,45): true
- t >= 45: false
Emit on initialization and whenever value changes.
Do not rename ports or JSON keys.
```

### 5.3 Prompt B3 - CoolingUnit

```text
Create atomic model CoolingUnit.
State: ON or OFF (initial OFF).
Use exactly:
- input port cooling_cmd with { "type":"cooling_cmd", "mode":"ON"|"OFF" }
- output port cooling_state with { "type":"cooling_state", "mode":"ON"|"OFF" }
Rules (deterministic):
- ON command when OFF -> ON after 1 time unit
- OFF command when ON -> OFF after 1 time unit
- ignore redundant commands
Emit initial state and each transition.
Do not rename ports or JSON keys.
```

### 5.4 Prompt B4 - AlarmUnit

```text
Create atomic model AlarmUnit.
State: NONE or WARN (initial NONE).
Use exactly:
- input port alarm_cmd with { "type":"alarm_cmd", "level":"NONE"|"WARN" }
- output port alarm_state with { "type":"alarm_state", "level":"NONE"|"WARN" }
Rules (deterministic):
- WARN command when NONE -> WARN after 1 time unit
- NONE command when WARN -> NONE after 1 time unit
- ignore redundant commands
Emit initial state and each transition.
Do not rename ports or JSON keys.
```

### 5.5 Prompt B5 - Supervisor

```text
Create atomic model Supervisor.
Inputs: temp_state, door_state.
Outputs: cooling_cmd, alarm_cmd, supervisor_status.

Policy:
- if celsius >= 8: send cooling_cmd ON
- if celsius <= 4: send cooling_cmd OFF
- if door_open=true and celsius > 6: send alarm_cmd WARN
- otherwise: send alarm_cmd NONE

Read exact input formats:
- temp_state: { "type":"temp_state", "celsius": number }
- door_state: { "type":"door_state", "open": true|false }

Emit exact output formats:
- cooling_cmd: { "type":"cooling_cmd", "mode":"ON"|"OFF" }
- alarm_cmd: { "type":"alarm_cmd", "level":"NONE"|"WARN" }
- supervisor_status: {
    "type":"supervisor_status",
    "celsius": number,
    "door_open": bool,
    "cooling_mode": "ON"|"OFF",
    "alarm_level": "NONE"|"WARN"
  }

Only emit command changes (no spam), deterministic behavior.
Keep memory of last emitted cooling_cmd and alarm_cmd, and never re-emit identical commands.
Emit supervisor_status only when one of its fields changes.
Do not rename ports or JSON keys.
```

---

## 6) Optional Step C - Generate an Experimental Frame (EF)

### 6.1 EF objective

Validate these reproducibility properties with a minimal EF workflow:

- If `celsius >= 8`, cooling command must become `ON`.
- If `celsius <= 4`, cooling command must become `OFF`.
- If `door_open=true` and `celsius > 6`, alarm must be `WARN`.
- In normal condition (`door_open=false` and `celsius <= 6`), alarm must be `NONE`.

No transducer is required here. Use a single validator/acceptor model.

### 6.2 Open the EF panel in the UI

1. Open your target model in the model editor.
2. In the top-right toolbar, click the small **shield icon** (Validation / EF).
3. This opens the EF generation window where you can submit the structural prompt first, then the behavior prompt.

### 6.3 EF structural prompt - Validator only (copy/paste)

```text
Create the EF structure for ColdChainSupervisorSystem using only one validator model.

Create exactly one atomic model named ColdChainValidator with:
- input port: supervisor_status
- output port: validation_result

Do not create generator or transducer.
Do not add extra models, ports, or couplings.
Keep it minimal: validator-only EF structure.
```

### 6.4 EF behavior prompt - ColdChainValidator (copy/paste)

```text
Create behavior code for atomic model ColdChainValidator.

Ports:
- input: supervisor_status
- output: validation_result

Behavior:
- Consume observations and produce a verdict message:
  { "type":"validation_result", "status":"PASS"|"WARN"|"FAIL", "reason":"..." }
- Keep internal memory of the latest sequence of controller decisions.

Expected behavior to validate:
1) If celsius >= 8, cooling_mode must become ON.
2) If celsius <= 4, cooling_mode must become OFF.
3) If door_open=true and celsius > 6, alarm_level must be WARN.
4) If door_open=false and celsius <= 6, alarm_level must be NONE.

Verdict policy:
- FAIL if any rule above is violated at least once.
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

- Near `t=0`: temp=2, door closed, cooling OFF, alarm NONE.
- Around `t=20`: temp rises to 9 -> supervisor sends cooling ON.
- Around `t=30`: door opens while hot -> supervisor sends alarm WARN.
- Around `t=45`: door closes -> supervisor can clear alarm.
- Around `t=80`: temp drops to 3 -> supervisor sends cooling OFF.

Expected traces to observe:

- `temp_state` changes at deterministic times
- `door_state` changes at deterministic times
- `cooling_state` transitions `OFF -> ON -> OFF`
- `alarm_state` transitions `NONE -> WARN -> NONE`
- `supervisor_status` decisions matching policy

Example exported result (JSON):

- [Example generation output (`exemple-result.json`)](./exemple-result.json)

---

## 8) Optional Step D - WebApp deployment

1. In model page, click **WebApp deployment**.
2. Use this prompt:

```text
Build a simple UI for this model:
- show room temperature
- show door status
- show cooling state
- show alarm state
- show current supervisor decision
- keep the Simulate action visible
```

Expected outcome:

- A generated UI aligned with model I/O contract
- A visible simulation trigger
- Traceable status fields

---

## 9) Optional: external analysis with Grafana + JSON export

If you want to analyze outputs outside DEVSForge:

1. Run the simulation, then click **Export JSON** in the Simulation panel.
2. In Grafana, use the **Infinity** plugin.
3. Create an Infinity datasource/query with **JSON Inline** and paste the exported JSON content.
4. Build simple charts/tables using fields like `simulationTime`, `MsgType`, `sender`, `target`, and payload values.

Use this mainly to compare runs at the **behavior/invariant** level (message consistency, policy compliance), not strict text/code equality.
