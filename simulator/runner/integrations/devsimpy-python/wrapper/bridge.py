# SPDX-License-Identifier: MIT
"""Transport native PyPDEVS bags through DEVSForge's flattened coordinator."""
from collections import defaultdict
from concurrent import futures
from copy import deepcopy
from functools import wraps
import importlib
import inspect
import json
import logging
import math
import threading

import grpc
from google.protobuf.empty_pb2 import Empty

from pypdevs.DEVS import AtomicDEVS
from proto import devs_pb2, devs_pb2_grpc


def rpc(method):
    @wraps(method)
    def call(self, request, context):
        with self.lock:
            try:
                if method.__name__ != "Initialize" and self.model is None:
                    context.abort(grpc.StatusCode.FAILED_PRECONDITION, "Initialize the model first")
                return method(self, request, context)
            except grpc.RpcError:
                raise
            except (ValueError, TypeError, KeyError, SyntaxError, ImportError, SystemExit) as exc:
                logging.exception("%s failed", method.__name__)
                context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"{type(exc).__name__}: {exc}")
            except Exception as exc:
                # ServicerContext.abort raises Exception in grpc's synchronous API.
                if context.code() is not None:
                    raise
                logging.exception("%s failed", method.__name__)
                context.abort(grpc.StatusCode.INTERNAL, f"{method.__name__}: {exc}")
    return call


class ModelHost(devs_pb2_grpc.AtomicModelServiceServicer):
    def __init__(self, config, module=None):
        self.config = deepcopy(config)
        self.module = module
        self.model = None
        self.pending = {}
        self.lock = threading.RLock()

    def create_model(self):
        module = self.module or importlib.import_module("model")
        factory = getattr(module, "NewModel", None)
        if callable(factory):
            model = factory(deepcopy(self.config))
        else:
            classes = [cls for cls in vars(module).values()
                       if inspect.isclass(cls) and cls.__module__ == module.__name__
                       and issubclass(cls, AtomicDEVS)]
            # Aliases of the same class do not create ambiguity.
            classes = list(dict.fromkeys(classes))
            if len(classes) != 1:
                raise ValueError("Define one atomic class in model.py, or provide NewModel(config)")
            params = {}
            for p in self.config.get("parameters") or []:
                name = p.get("name")
                if not name or name in params:
                    raise ValueError("Parameter names must be nonempty and unique")
                params[name] = p.get("value")
            model = classes[0](**params)
        if not isinstance(model, AtomicDEVS):
            raise ValueError("Expected a native PyPDEVS atomic; coupled models are flattened by DEVSForge")
        if model.name is None:
            model.name = self.config.get("name") or self.config.get("id") or type(model).__name__
        # Native hierarchy finalization sets model_id/full_name without launching
        # a PyPDEVS simulator, scheduler or MPI middleware.
        model.finalize("", 0, [], defaultdict(list), [])
        return model

    def bind_ports(self):
        """Match native named ports, preserving references saved by the constructor.

        Metadata may also supply ports omitted from a constructor. Generic native
        portN names map by order; a named mismatch is always an error.
        """
        self.inputs, self.outputs = {}, {}
        metadata = self.config.get("ports") or []
        seen = set()
        for item in metadata:
            name = item.get("name")
            if not name or name in seen or item.get("type") not in ("in", "out"):
                raise ValueError("Port names must be nonempty, unique, and have type in/out")
            seen.add(name)
        for direction, ports, add, mapped in (
            ("in", self.model.IPorts, self.model.addInPort, self.inputs),
            ("out", self.model.OPorts, self.model.addOutPort, self.outputs),
        ):
            names = [p["name"] for p in metadata if p["type"] == direction]
            if len(ports) > len(names):
                raise ValueError(f"Constructor declares more {direction} ports than the model interface")
            used = set()
            for index, name in enumerate(names):
                matches = [p for p in ports if p not in used and p.name == name]
                port = matches[0] if len(matches) == 1 else None
                if port is None and index < len(ports):
                    candidate = ports[index]
                    if candidate not in used and candidate.name == f"port{candidate.port_id}":
                        port = candidate
                if port is None:
                    if len(ports) >= len(names):
                        raise ValueError(f"Cannot map {direction} port {name!r}; check constructor names/order")
                    port = add(name)
                port.name = name
                used.add(port)
                mapped[name] = port
            if len(used) != len(ports):
                raise ValueError(f"Unmapped constructor {direction} ports")

    def invoke(self, hook, *args):
        # Native PyPDEVS assigns the returned state, including a legitimate None.
        self.model.state = hook(*args)

    def sigma(self):
        value = float(self.model.timeAdvance())
        if math.isnan(value) or value < 0:
            raise ValueError("timeAdvance() must return a nonnegative duration or infinity")
        return value

    def schedule(self, now, age):
        self.now = now
        sigma = self.sigma()
        self.model.time_last = (now, age)
        self.model.time_next = (now + sigma, 1 if sigma else age + 1)
        self.model.elapsed = 0.0
        self.model.my_input = {}
        self.model.my_output = {}
        self.pending.clear()

    def external_time(self, elapsed):
        if not math.isfinite(elapsed) or elapsed < 0:
            raise ValueError("Elapsed time must be finite and nonnegative")
        now = self.now + elapsed
        if now > self.model.time_next[0] and not math.isclose(now, self.model.time_next[0]):
            raise ValueError("External event is later than the scheduled internal transition")
        return now

    def deliver(self):
        # Keep native port identities while isolating user payload mutations.
        self.model.my_input = {port: deepcopy(values) for port, values in self.pending.items()}
        return self.model.my_input

    @rpc
    def Initialize(self, request, context):
        previous = self.model
        self.model = None
        self.pending.clear()
        if previous is not None:
            finish = getattr(previous, "finish", None)
            if callable(finish):
                finish()
        model = self.create_model()
        self.model = model
        try:
            self.bind_ports()
            elapsed = float(model.elapsed)
            if not math.isfinite(elapsed) or elapsed < 0:
                raise ValueError("Initial elapsed time must be finite and nonnegative")
            self.schedule(-elapsed, 1)
            self.now = 0.0
            if model.time_next[0] < 0:
                raise ValueError("Initial elapsed time exceeds timeAdvance()")
        except Exception:
            self.model = None
            raise
        return Empty()

    @rpc
    def TimeAdvance(self, request, context):
        return devs_pb2.TimeAdvanceResponse(sigma=self.model.time_next[0] - self.now)

    @rpc
    def InternalTransition(self, request, context):
        now, age = self.model.time_next
        if not math.isfinite(now):
            raise ValueError("Cannot execute an internal transition at infinity")
        if self.pending:
            raise ValueError("Pending input bags require an external or confluent transition")
        self.model.my_input = {}
        self.invoke(self.model.intTransition)
        self.schedule(now, age)
        return Empty()

    @rpc
    def ExternalTransition(self, request, context):
        now = self.external_time(request.value)
        self.model.elapsed = now - self.model.time_last[0]
        self.invoke(self.model.extTransition, self.deliver())
        age = self.model.time_last[1] + 1 if now == self.model.time_last[0] else 1
        self.schedule(now, age)
        return Empty()

    @rpc
    def ConfluentTransition(self, request, context):
        now = self.external_time(request.value)
        if not math.isfinite(self.model.time_next[0]) or not math.isclose(now, self.model.time_next[0]):
            raise ValueError("Confluent event must coincide with the internal transition")
        # PyPDEVS calls the confluent hook with elapsed=0. Its native inherited
        # implementation performs internal then external on the complete bag.
        self.model.elapsed = 0.0
        self.invoke(self.model.confTransition, self.deliver())
        self.schedule(now, self.model.time_next[1])
        return Empty()

    @rpc
    def Output(self, request, context):
        outputs = self.model.outputFnc()
        if not isinstance(outputs, dict):
            raise ValueError("outputFnc() must return a dictionary port -> list of messages, even when empty")
        self.model.my_output = outputs
        response = devs_pb2.OutputResponse()
        known = set(self.outputs.values())
        if any(p not in known for p in outputs):
            raise ValueError("Output targets a port absent from the model interface")
        for name, port in self.outputs.items():
            if port in outputs:
                values = outputs[port]
                if not isinstance(values, list):
                    raise ValueError(f"Output bag for port {name!r} must be a list; wrap a single message in [message]")
                if values:
                    response.outputs.add(port_name=name, values_json=[json.dumps(value, allow_nan=False) for value in values])
        return response

    @rpc
    def AddInput(self, request, context):
        port = self.inputs.get(request.port_name)
        if port is None:
            context.abort(grpc.StatusCode.NOT_FOUND, f"Unknown input port {request.port_name!r}")
        def reject_constant(value):
            raise ValueError(f"Invalid JSON constant: {value}")
        value = json.loads(request.value_json, parse_constant=reject_constant)
        self.pending.setdefault(port, []).append(value)
        return Empty()

    @rpc
    def Finalize(self, request, context):
        try:
            finalize = getattr(self.model, "finish", None)
            if callable(finalize):
                finalize()
        finally:
            self.pending.clear()
            self.model = None
        return Empty()


def serve(config, host="127.0.0.1", port=50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=1))
    devs_pb2_grpc.add_AtomicModelServiceServicer_to_server(ModelHost(config), server)
    if server.add_insecure_port(f"{host}:{port}") == 0:
        raise RuntimeError("Cannot bind the DEVSimPy RPC server")
    server.start()
    logging.info("Atomic RPC server listening on %s:%d", host, port)
    try:
        server.wait_for_termination()
    finally:
        server.stop(0).wait()
