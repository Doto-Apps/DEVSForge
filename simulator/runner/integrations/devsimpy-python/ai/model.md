Generate a native Parallel DEVS atomic using PyPDEVS 2.4.1, the kernel referenced
by DEVSimPy. Its actual modeling sources are included below. Do not use Classic
PyDEVS, DomainBehavior/DomainInterface, Message, peek/poke, xDEVS modeling, a GUI,
a PyPDEVS simulator or another event loop.

## Reference template

%s

## Contract

- Return only Python code, without Markdown fences.
- Import AtomicDEVS from pypdevs.DEVS, and optionally INFINITY from pypdevs.infinity.
- Define one atomic subclass in model.py. Helpers and state classes are allowed.
  For multiple atomic classes, provide NewModel(config) selecting the atomic.
- Initialize state in the constructor. Metadata parameters are passed as keyword
  arguments to that constructor, before it computes the initial state. A factory
  receives the complete configuration instead and handles its own parameters.
- Declare ports with self.addInPort("name") / self.addOutPort("name") and keep
  their references. Their names and directions must match the provided interface.
  Metadata may supply omitted ports after construction; access those via IPorts
  and OPorts only in transition/output methods. Do not invent extra ports.
- extTransition(self, inputs) receives a dictionary {native_port: [messages...]}.
  Iterate ALL messages of each present port, using inputs.get(port, []). There can
  be several messages on the same port. Do not select only [0] or loop transitions.
- outputFnc(self) returns {output_port: [message1, message2, ...]}. Return {} for
  no output. Even a single message needs an outer list. A message that itself is
  a JSON list remains one message: {port: [[1, 2]]}; never flatten payload lists.
- Inputs and outputs are ordinary JSON-compatible values, not Message wrappers.
  Preserve dict/list payloads. No NaN or infinity inside payloads.
- intTransition(self), extTransition(self, inputs), and confTransition(self, inputs)
  return the new state. Return self.state when mutating it. A None state is allowed
  but a forgotten return will set state to None, exactly like native PyPDEVS.
- A native inherited confTransition(inputs) performs internal then external with
  elapsed=0. Override it when simultaneous inputs and an internal event need a
  different policy. The adapter calls the confluent hook once with the full bag.
- timeAdvance(self) returns a nonnegative duration or INFINITY. self.elapsed is
  the elapsed duration for external transitions and zero for confluence. Preserve
  the remaining sigma when an input does not change the scheduled event.
- DEVSForge controls time, gRPC/Kafka and flattened mixed-framework coupling.
  Do not instantiate Simulator, enable MPI, use Classic select(), or create an
  opaque coupled model. No distributed PyPDEVS or dynamic-structure operations.
- Opening the editor never runs the model. Initialize creates a fresh instance.
  An optional DEVSForge finish() hook with no argument can close resources.
