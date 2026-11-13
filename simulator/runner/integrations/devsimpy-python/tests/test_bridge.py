# SPDX-License-Identifier: MIT
from concurrent import futures
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
from types import ModuleType
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "wrapper"))

import grpc
from google.protobuf.empty_pb2 import Empty
from bridge import ModelHost
from proto import devs_pb2 as pb, devs_pb2_grpc as rpc


MODEL = '''from pypdevs.DEVS import AtomicDEVS
class Example(AtomicDEVS):
    def __init__(self, period=2):
        super().__init__()
        self.in_port = self.addInPort("in")
        self.out = self.addOutPort("out")
        self.period = period
        self.state = {"count": 0, "sigma": period, "received": []}
    def intTransition(self):
        return {**self.state, "count": self.state["count"] + 1, "sigma": self.period}
    def extTransition(self, inputs):
        for port, bag in inputs.items():
            for message in bag:
                self.state["received"].append((port.name, message, self.elapsed))
        self.state["sigma"] = max(0, self.state["sigma"] - self.elapsed)
        return self.state
    def outputFnc(self):
        return {self.out: [{"count": self.state["count"], "time": self.time_next[0]}, [1, 2]]}
    def timeAdvance(self):
        return self.state["sigma"]
'''


class BridgeTest(unittest.TestCase):
    def connect(self, code=MODEL, config=None):
        module = ModuleType("test_user_model")
        exec(code, module.__dict__)
        config = deepcopy(config if config is not None else {
            "id": "example", "name": "light ", "parameters": [{"name": "period", "value": 2.5}],
            "ports": [{"name": "in", "type": "in"}, {"name": "out", "type": "out"}],
        })
        host = ModelHost(config, module)
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=1))
        rpc.add_AtomicModelServiceServicer_to_server(host, server)
        port = server.add_insecure_port("127.0.0.1:0")
        server.start()
        channel = grpc.insecure_channel(f"127.0.0.1:{port}")
        self.addCleanup(lambda: server.stop(0).wait())
        self.addCleanup(channel.close)
        return host, rpc.AtomicModelServiceStub(channel)

    def call(self, fn, request=None):
        return fn(request or Empty(), timeout=5)

    def add(self, client, value, port="in"):
        return self.call(client.AddInput, pb.InputMessage(port_name=port, value_json=json.dumps(value)))

    def expect_error(self, fn, request, code, text):
        with self.assertRaises(grpc.RpcError) as error:
            self.call(fn, request)
        self.assertEqual(error.exception.code(), code)
        self.assertIn(text, error.exception.details())

    def test_native_ports_clock_state_returns_and_reinitialization(self):
        host, client = self.connect()
        self.call(client.Initialize)
        self.assertEqual(host.model.getModelFullName(), "light ")
        self.assertEqual(self.call(client.TimeAdvance).sigma, 2.5)
        out = self.call(client.Output)
        self.assertEqual(out.outputs[0].port_name, "out")
        self.assertEqual([json.loads(value) for value in out.outputs[0].values_json],
                         [{"count": 0, "time": 2.5}, [1, 2]])
        self.assertEqual(host.model.my_output[host.model.out], [{"count": 0, "time": 2.5}, [1, 2]])
        self.call(client.InternalTransition)
        self.assertEqual(host.model.time_last, (2.5, 1))
        self.assertEqual(host.model.time_next, (5.0, 1))
        self.add(client, {"value": 3})
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0.5))
        self.assertEqual(host.model.state["received"], [("in", {"value": 3}, 0.5)])
        self.assertEqual(host.model.my_input, {})
        self.assertEqual(self.call(client.TimeAdvance).sigma, 2.0)
        previous = host.model
        self.call(client.Initialize)
        self.assertIsNot(host.model, previous)
        self.assertEqual(host.model.state["count"], 0)
        self.assertEqual(host.model.state["received"], [])
        self.assertEqual(host.model.time_next, (2.5, 1))
        self.call(client.Finalize)
        self.expect_error(client.Output, None, grpc.StatusCode.FAILED_PRECONDITION, "Initialize")

    def test_complete_input_bags_keep_duplicates_nulls_and_list_payloads(self):
        host, client = self.connect()
        self.call(client.Initialize)
        payloads = [None, 7, 7, [1, 2], {"value": [3, 4]}, False]
        for value in payloads:
            self.add(client, value)
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0.5))
        self.assertEqual(host.model.state["received"], [("in", value, 0.5) for value in payloads])
        self.assertEqual(host.pending, {})
        self.add(client, "next")
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0.25))
        self.assertEqual(len(host.model.state["received"]), len(payloads) + 1)
        self.assertEqual(host.model.state["received"][-1], ("in", "next", 0.25))

    def test_bags_on_multiple_ports_are_delivered_in_one_transition(self):
        code = MODEL.replace('self.period = period', 'self.other = self.addInPort("other")\n        self.calls = 0\n        self.period = period')
        code = code.replace('    def extTransition(self, inputs):', '    def extTransition(self, inputs):\n        self.calls += 1')
        config = {"ports": [{"name": name, "type": kind} for name, kind in (("in", "in"), ("out", "out"), ("other", "in"))]}
        host, client = self.connect(code, config)
        self.call(client.Initialize)
        self.add(client, 1)
        self.add(client, 2, "other")
        self.add(client, 3)
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0))
        self.assertCountEqual(host.model.state["received"], [("in", 1, 0), ("in", 3, 0), ("other", 2, 0)])
        self.assertEqual(host.model.calls, 1)
        self.assertIs(host.inputs["in"], host.model.in_port)
        self.assertIs(host.inputs["other"], host.model.other)

    def test_native_default_confluence_receives_full_bag_once_with_zero_elapsed(self):
        host, client = self.connect()
        self.call(client.Initialize)
        self.add(client, 7)
        self.add(client, 8)
        self.call(client.Output)
        self.call(client.ConfluentTransition, pb.ElapsedTime(value=2.5))
        self.assertEqual(host.model.state["count"], 1)
        self.assertEqual(host.model.state["received"], [("in", 7, 0.0), ("in", 8, 0.0)])
        self.assertEqual(host.model.time_next, (5.0, 1))
        self.assertEqual(host.pending, {})

    def test_overridden_native_confluent_transition(self):
        code = MODEL + '''
    def confTransition(self, inputs):
        assert self.elapsed == 0
        return {"count": 42, "sigma": float("inf"), "received": inputs[self.in_port]}
'''
        host, client = self.connect(code)
        self.call(client.Initialize)
        self.add(client, "a")
        self.add(client, "b")
        self.call(client.ConfluentTransition, pb.ElapsedTime(value=2.5))
        self.assertEqual(host.model.state, {"count": 42, "sigma": float("inf"), "received": ["a", "b"]})
        self.assertEqual(self.call(client.TimeAdvance).sigma, float("inf"))

    def test_initial_elapsed_is_included_in_first_external_elapsed(self):
        code = MODEL.replace('self.period = period', 'self.elapsed = 0.5\n        self.period = period')
        host, client = self.connect(code)
        self.call(client.Initialize)
        self.assertEqual(self.call(client.TimeAdvance).sigma, 2)
        self.assertEqual(host.model.time_last, (-0.5, 1))
        self.add(client, "x")
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0.25))
        self.assertEqual(host.model.state["received"], [("in", "x", 0.75)])
        self.assertEqual(host.model.time_next[0], 2)

    def test_factory_and_resource_finalization(self):
        code = MODEL + '''
    def finish(self):
        self.finished = True
class Another(Example):
    pass
def NewModel(config):
    return Example(period=config["parameters"][0]["value"])
'''
        host, client = self.connect(code)
        self.call(client.Initialize)
        previous = host.model
        self.call(client.Initialize)
        self.assertTrue(previous.finished)
        current = host.model
        self.call(client.Finalize)
        self.assertTrue(current.finished)

    def test_invalid_port_json_time_and_internal_with_pending_inputs(self):
        host, client = self.connect()
        self.call(client.Initialize)
        self.expect_error(client.AddInput, pb.InputMessage(port_name="missing", value_json="0"),
                          grpc.StatusCode.NOT_FOUND, "Unknown input")
        self.expect_error(client.AddInput, pb.InputMessage(port_name="in", value_json="NaN"),
                          grpc.StatusCode.INVALID_ARGUMENT, "JSON")
        self.expect_error(client.ExternalTransition, pb.ElapsedTime(value=-1),
                          grpc.StatusCode.INVALID_ARGUMENT, "Elapsed")
        self.expect_error(client.ConfluentTransition, pb.ElapsedTime(value=1),
                          grpc.StatusCode.INVALID_ARGUMENT, "coincide")
        self.add(client, 7)
        self.expect_error(client.InternalTransition, None, grpc.StatusCode.INVALID_ARGUMENT, "Pending input bags")
        self.call(client.ExternalTransition, pb.ElapsedTime(value=0))
        self.assertEqual(host.model.state["received"], [("in", 7, 0)])

    def test_bad_output_bags_and_non_json_messages_are_rejected(self):
        expression = '{self.out: [{"count": self.state["count"], "time": self.time_next[0]}, [1, 2]]}'
        for replacement in ('None', '{self.out: 7}', '{self.out: (1, 2)}', '{self.in_port: [1]}',
                            '{self.out: [float("nan")]}', '{self.out: [{1, 2}]}'):
            with self.subTest(replacement=replacement):
                _, client = self.connect(MODEL.replace(expression, replacement))
                self.call(client.Initialize)
                self.expect_error(client.Output, None, grpc.StatusCode.INVALID_ARGUMENT, "")

    def test_empty_output_bags_and_explicit_none_state(self):
        code = MODEL.replace('return {self.out: [{"count": self.state["count"], "time": self.time_next[0]}, [1, 2]]}',
                             'return {self.out: []}')
        _, client = self.connect(code)
        self.call(client.Initialize)
        self.assertEqual(len(self.call(client.Output).outputs), 0)
        code = MODEL.replace('return {**self.state, "count": self.state["count"] + 1, "sigma": self.period}', 'return None')
        code = code.replace('return self.state["sigma"]', 'return 1.0')
        host, client = self.connect(code)
        self.call(client.Initialize)
        self.call(client.InternalTransition)
        self.assertIsNone(host.model.state)

    def test_constructor_and_interface_errors(self):
        cases = [
            (MODEL.replace('period=2', 'required'), "unexpected keyword"),
            (MODEL + '\nclass Second(Example):\n    pass\n', "one atomic class"),
            ('from pypdevs.DEVS import CoupledDEVS\nclass Coupled(CoupledDEVS): pass\ndef NewModel(config):\n return Coupled()\n', "flattened"),
            (MODEL.replace('return self.state["sigma"]', 'return -1'), "nonnegative"),
            (MODEL.replace('self.period = period', 'self.addInPort("extra")\n        self.period = period'), "more in ports"),
            (MODEL.replace('addInPort("in")', 'addInPort("wrong")'), "Cannot map"),
        ]
        for code, text in cases:
            with self.subTest(error=text):
                host, client = self.connect(code)
                self.expect_error(client.Initialize, None, grpc.StatusCode.INVALID_ARGUMENT, text)
                self.assertIsNone(host.model)

    def test_metadata_can_supply_missing_native_ports(self):
        code = MODEL.replace('self.in_port = self.addInPort("in")', 'pass').replace('self.out = self.addOutPort("out")', 'pass')
        host, client = self.connect(code)
        self.call(client.Initialize)
        self.assertEqual([p.name for p in host.model.IPorts], ["in"])
        self.assertEqual([p.name for p in host.model.OPorts], ["out"])
        self.assertIs(host.inputs["in"], host.model.IPorts[0])

    def test_actual_upstream_parallel_traffic_light_without_source_changes(self):
        code = (ROOT / "tests/fixtures/trafficlight_parallel.py").read_text()
        code += '\ndef NewModel(config):\n    return TrafficLight()\n'
        host, client = self.connect(code, {"name": "native traffic light", "ports": [
            {"name": "INTERRUPT", "type": "in"}, {"name": "OBSERVED", "type": "out"}]})
        self.call(client.Initialize)
        self.assertEqual(self.call(client.TimeAdvance).sigma, 58.5)
        self.assertEqual(json.loads(self.call(client.Output).outputs[0].values_json[0]), "grey")
        self.add(client, "toManual", "INTERRUPT")
        self.call(client.ExternalTransition, pb.ElapsedTime(value=2))
        self.assertEqual(host.model.state.get(), "manual")
        self.assertEqual(self.call(client.TimeAdvance).sigma, float("inf"))
        self.add(client, "toAutonomous", "INTERRUPT")
        self.call(client.ExternalTransition, pb.ElapsedTime(value=4))
        self.assertEqual(self.call(client.TimeAdvance).sigma, 60)
        self.call(client.InternalTransition)
        self.assertEqual(host.model.state.get(), "green")
        self.assertEqual(self.call(client.TimeAdvance).sigma, 50)

    def test_pinned_sources_and_native_exception(self):
        from pypdevs.util import DEVSException
        # The vendored Python 3 fix preserves useful error messages.
        self.assertIn("test message", str(DEVSException("test message")))
        manifest = json.loads((ROOT / "upstream.json").read_text())
        fixture = manifest["fixture"]
        self.assertEqual(hashlib.sha256((ROOT / fixture["path"]).read_bytes()).hexdigest(), fixture["sha256"])
        for relative, source in manifest["files"].items():
            self.assertEqual(hashlib.sha256((ROOT / "wrapper" / relative).read_bytes()).hexdigest(),
                             source["installedSha256"], relative)


if __name__ == "__main__":
    unittest.main()
