# Light Case - Single-instance Smart Room

This document defines a simple DEVS case with no duplicated model code in the structure:
- 1 coupled root model
- 3 atomic models (all different)

Use it as a clean test scenario for:
- structure generation
- atomic behavior generation
- validation
- simulation

---

## 1) Target system

### Models
- `RoomSystem` (coupled, root)
- `Person` (atomic)
- `MotionDetector` (atomic)
- `Light` (atomic)

### Connections
- `Person.out_presence -> MotionDetector.in_presence`
- `MotionDetector.out_motion -> Light.in_motion`
- Optional: `Light.out_light_state -> RoomSystem.out_state`

### Why this case
- No model is duplicated
- Small and deterministic
- Easy to debug from traces

---

## 2) Message contract (strict)

Keep exactly these payloads:

1. `presence_event`
```json
{ "type": "presence_event", "person_id": "p1", "state": "enter" }
```
or
```json
{ "type": "presence_event", "person_id": "p1", "state": "leave" }
```

2. `motion_state`
```json
{ "type": "motion_state", "detected": true }
```
or
```json
{ "type": "motion_state", "detected": false }
```

3. `light_state`
```json
{ "type": "light_state", "state": "on" }
```
or
```json
{ "type": "light_state", "state": "off" }
```

Rule:
- Do not invent extra required fields.
- Preserve names exactly (`type`, `state`, `detected`, etc.).

---

## 3) Prompt A - Structure generation

Use this prompt in your diagram/structure generation step:

```text
Create a DEVS system for a single room with automatic light control.

Models:
- Coupled root: RoomSystem
- Atomic models: Person, MotionDetector, Light

Connections:
1) Person.out_presence -> MotionDetector.in_presence
2) MotionDetector.out_motion -> Light.in_motion

Constraints:
- Do not duplicate models.
- Keep exactly one instance of each atomic model.
- Use only these model names: RoomSystem, Person, MotionDetector, Light.
- Keep port names exactly:
  - Person: out_presence
  - MotionDetector: in_presence, out_motion
  - Light: in_motion, out_light_state
- Root must be coupled and contain all three atomic components.
```

---

## 4) Prompt B - Person behavior

Generate behavior code for `Person` with this prompt:

```text
Create atomic DEVS behavior for model "Person".

Goal:
- Simulate one person entering and leaving a room.

I/O:
- Output port: out_presence
- No input requiredbon deja reglons quelque pb que je voit

Behavior:
- At simulation start, emit:
  { "type":"presence_event", "person_id":"p1", "state":"enter" }
- After a configurable stay duration (example: 20), emit:
  { "type":"presence_event", "person_id":"p1", "state":"leave" }
- Then passivate.

Constraints:
- Deterministic behavior.
- Use exact output schema and field names.
- Do not emit any other message type.
```

---

## 5) Prompt C - MotionDetector behavior

Generate behavior code for `MotionDetector` with this prompt:

```text
Create atomic DEVS behavior for model "MotionDetector".

I/O:
- Input port: in_presence
- Output port: out_motion

Input schema:
- { "type":"presence_event", "person_id":"...", "state":"enter|leave" }

Output schema:
- { "type":"motion_state", "detected": true|false }

Behavior:
- On presence_event with state="enter":
  - set internal occupancy=true
  - emit immediately { "type":"motion_state", "detected": true }
- On presence_event with state="leave":
  - set internal occupancy=false
  - after configurable timeout (example: 5), emit
    { "type":"motion_state", "detected": false }
- If a new "enter" arrives before timeout expiration, cancel the pending off logic.

Constraints:
- Deterministic timing.
- Keep strict schema compatibility.
- Do not invent extra required fields.
```

---

## 6) Prompt D - Light behavior

Generate behavior code for `Light` with this prompt:

```text
Create atomic DEVS behavior for model "Light".

I/O:
- Input port: in_motion
- Output port: out_light_state

Input schema:
- { "type":"motion_state", "detected": true|false }

Output schema:
- { "type":"light_state", "state":"on|off" }

Behavior:
- If detected=true, set light state to "on" and emit:
  { "type":"light_state", "state":"on" }
- If detected=false, set light state to "off" and emit:
  { "type":"light_state", "state":"off" }
- Emit only when state changes.

Constraints:
- Deterministic behavior.
- Keep exact field names and values.
```

---

## 7) Optional Prompt E - Experimental Frame (Light-focused)

Use this prompt if you want to validate only the `Light` model behavior.

```text
Create an Experimental Frame to validate only the atomic model "Light" (MUT).

Goal:
- Test the contract <MUT input port> -> <MUT output port>.
- Ignore Person and MotionDetector logic in this EF.
- IMPORTANT: MUT ports must match the target model interface exactly (same names and directions).

EF structure:
- Root model must be coupled.
- Include one MUT placeholder component named "MUT" with:
  - the exact input port names of the target Light model
  - the exact output port names of the target Light model
- Include one Generator that emits motion_state test inputs.
- Include one Acceptor that validates Light outputs against expected values.
- Include one Transducer that reports pass/fail summary.

Required connections:
1) Generator.out_motion -> MUT.<exact_input_port_name>
2) MUT.<exact_output_port_name> -> Acceptor.in_light
3) Generator.out_motion -> Acceptor.in_expected_motion
4) Acceptor.out_verdict -> Transducer.in_verdict

Input schema (Generator -> MUT):
- { "type":"motion_state", "detected": true|false }

Expected output schema (MUT -> Acceptor):
- { "type":"light_state", "state":"on|off" }

Validation rules:
- If detected=true, expected state is "on".
- If detected=false, expected state is "off".
- Mark fail on schema mismatch or wrong state value.
- Keep deterministic behavior and deterministic test sequence.

Use only these message schemas:
- motion_state
- light_state
```

---

## 8) Prompts - EF Test Models (Generator / Acceptor / Transducer)

Use these prompts in code generation mode after EF structure is validated.

### Prompt F - Generator (EF)

```text
Create atomic DEVS behavior for model "Generator" (EF test model).

Ports:
- Output: out_motion

Output schema:
- { "type":"motion_state", "detected": true|false }

Behavior:
- Emit deterministic sequence:
  1) at t=0:   { "type":"motion_state", "detected": true }
  2) at t=5:   { "type":"motion_state", "detected": false }
  3) at t=10:  { "type":"motion_state", "detected": true }
- After last emission, passivate.

Constraints:
- Deterministic timing.
- No random behavior.
- Keep exact field names and values.
```

### Prompt G - Acceptor (EF)

```text
Create atomic DEVS behavior for model "Acceptor" (EF validator model).

Ports:
- Input: in_light
- Input: in_expected_motion
- Output: out_verdict

Input schemas:
- in_light: { "type":"light_state", "state":"on|off" }
- in_expected_motion: { "type":"motion_state", "detected": true|false }

Output schema:
- { "type":"verdict", "ok": boolean, "expected":"on|off", "actual":"on|off", "step": number }

Validation rule:
- expected = "on" if detected=true, else "off".
- Compare expected vs actual light state.
- Emit one verdict per check.

Behavior requirements:
- Deterministic.
- Handle asynchronous arrivals by storing last expected and last actual.
- Maintain counters (total, pass, fail) internally.
```

### Prompt H - Transducer (EF)

```text
Create atomic DEVS behavior for model "Transducer" (EF reporting model).

Ports:
- Input: in_verdict

Input schema:
- { "type":"verdict", "ok": boolean, "expected":"on|off", "actual":"on|off", "step": number }

Behavior:
- Consume verdict messages.
- Maintain summary counters: total/pass/fail.
- Log a concise summary each time a verdict is received.
- No output port required.

Constraints:
- Deterministic behavior.
- Keep schema compatibility with verdict messages.
```

---

## 9) Expected trace (quick check)

Typical sequence:
1. `Person` emits `presence_event enter`
2. `MotionDetector` emits `motion_state detected=true`
3. `Light` emits `light_state on`
4. `Person` emits `presence_event leave`
5. `MotionDetector` emits `motion_state detected=false` (after timeout)
6. `Light` emits `light_state off`
