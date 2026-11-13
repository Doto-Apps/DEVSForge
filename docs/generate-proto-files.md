# Generate gRPC bindings

The source of truth is `simulator/proto/devs.proto`. `PortOutput.values_json` is a repeated JSON-string field shared by all runtime adapters.

Generate one language at a time from the repository root:

```sh
task simulator:proto -- xdevs-go
task simulator:proto -- xdevs-python
task simulator:proto -- xdevs-java
task simulator:proto -- ms4me-java
task simulator:proto -- devsimpy-python
```

Go uses `protoc`, `protoc-gen-go v1.36.11`, and `protoc-gen-go-grpc v1.5.1`, with output in `simulator/shared/proto`. The checked-in Go files were generated with protoc 29.3. Install the plugins with `go install ...@version` and add their directory to PATH.

Python requires `grpcio-tools` from its wrapper requirements in an isolated Python environment. Its script fixes the generated package-relative import. DEVSimPy delegates to that same Python generator with its own output directory. Java requires `protoc` 34.1 (matching protobuf-java 4.34.1; set `PROTOC_JAVA` when it is not the default compiler) and `GRPC_JAVA_PLUGIN` pointing at protoc-gen-grpc-java 1.60.0 for your OS/architecture; Java output stays in its wrapper.

Compiler versions can differ between languages; preserve field numbers, message shapes, and service names. Changing only an integration, without changing the protocol, does not require regenerating every language. Whenever the protocol changes, regenerate all affected bindings and run mixed-language simulation tests before release.

See [integration development](integrations.md) for the full extension and deployment workflow.
