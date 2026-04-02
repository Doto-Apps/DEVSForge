# DEVSForge Wrappers

The `simulator/wrappers/` module defines the language runtime boundary between runner processes and user DEVS model code.

## Quick Links

- [Root README](../../README.md)
- [Simulator README](../README.md)
- [Backend README](../../back/README.md)
- [Frontend README](../../front/README.md)

## Purpose

Wrappers provide a stable contract so runner logic can control models written in different languages while keeping the same simulation protocol.

Runner <-> wrapper communication is gRPC (`AtomicModelService`), and wrapper <-> model data exchange uses JSON-serializable port payloads.

## Directory Structure

- `go/`
  - `modeling/`: Go runtime interfaces/types for atomic models and ports.
  - `rpc/`: Go gRPC server implementation that maps RPC methods to model methods.
  - `proto/`: generated gRPC files.
- `python/`
  - `modeling/`: Python runtime base classes mirroring DEVS atomic/component behavior.
  - `rpc/`: Python gRPC server implementation.
  - `proto/`: generated gRPC files.
- `java/`
  - `./mvnw`, `pom.xml`, `./mvnw.cmd` and `./.*`: Files used for maven project
  - `src/main/generated`: Generated files from protoc gen
  - `src/main/java/com/devsforge/runner`: Java gRPC implementation in `rpc`, Runtime classes in `modeling`

## gRPC AtomicModelService Contract

Defined in `simulator/proto/devs.proto`:

- `Initialize`
- `Finalize`
- `TimeAdvance`
- `InternalTransition`
- `ExternalTransition`
- `ConfluentTransition`
- `Output`
- `AddInput`

## Model Interface Expectations

### Go user models

The generated bootstrap expects a `NewModel(config modeling.RunnableModel)` factory and a returned object compatible with wrapper atomic behavior.

The model must implement DEVS lifecycle methods used by RPC mapping:

- `Initialize`, `Exit`
- `TA`
- `DeltInt`, `DeltExt`, `DeltCon`
- `Lambda`

### Python user models

The generated bootstrap imports `NewModel(config)` from `model.py`.
The returned model object must expose DEVS methods expected by Python RPC server:

- `initialize`, `exit`
- `ta`
- `delt_int`, `delt_ext`, `delt_con`
- `lambda_`
- port access helpers compatible with wrapper runtime (`get_ports`, `get_port_by_name`)

### Java user models

The java wrapper expect to have a java file that extends `Atomic` class and a constructor that take one parameter of type `RunnableModel`

## Serialization Rules

- `AddInput` receives `value_json` and deserializes JSON to native value before adding it to input port.
- `Output` serializes each output port value to JSON strings (`values_json`).
- Port payloads must be JSON-serializable for cross-language compatibility.
- Go wrapper has compatibility handling for `[]byte` JSON outputs before normalization.

## How Runner Uses Wrappers

1. Runner copies wrapper template directory for selected language into simulation temp workspace.
2. Runner writes generated user model code.
3. Runner writes language-specific bootstrap.
4. Runner starts process and waits until gRPC service responds.
5. Runner executes DEVS commands by forwarding Kafka instructions to gRPC methods.

## Adding a New Language Wrapper (Checklist)

1. Create `simulator/wrappers/<language>/modeling` runtime abstraction (ports, atomic lifecycle).
2. Implement `rpc` server that maps gRPC `AtomicModelService` methods to model methods.
3. Generate language proto bindings from `simulator/proto/devs.proto`.
4. Add runner preparation logic in `simulator/runner/internal/generators`.
5. Ensure JSON payload compatibility for `AddInput` and `Output`.
6. Add integration tests (single-language and mixed-language scenarios).

## Related Docs

- [Simulator README](../README.md)
- [Backend README](../../back/README.md)
- [Frontend README](../../front/README.md)
- [Root README](../../README.md)
- [Reproducibility Guide](../../docs/reproducibility.md)
