import base64
import ast
import copy
import io
import json
import pickle
import sqlite3
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
import zipfile
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from unittest.mock import patch

import agent
import server
from formats import apply_adapter, decode, read_uploads, inspect_binary, normalize_python_headers
from adapters.iso21175_v07 import convert as iso
from schema import validate
from source import extract


def package():
    return {"version": "1", "roots": ["a"], "models": [{"id": "a", "name": "Example", "type": "atomic", "language": "python", "framework": "unrecognized", "code": "print('source retained')", "ports": [{"name": "out", "type": "out"}], "parameters": [{"name": "label", "type": "string", "value": "abc"}]}]}


def leaf():
    return {"schemaVersion": "21175-3-draft-0.7", "kind": "ModelSpecification", "modelId": "a", "name": "Example", "type": "leaf", "ports": [{"name": "out", "type": "out", "payload": {}}], "implementation": {"language": "python", "code": "class A: pass"}}


def upload(name, text):
    return {"name": name, "base64": base64.b64encode(text.encode() if isinstance(text, str) else text).decode()}


class FormatsTest(unittest.TestCase):
    def test_python_declared_latin1_is_text_in_files_and_archives(self):
        code = '# -*- coding: Latin-1 -*-\n# Modèle hérité\nclass TrafficSystem:\n    label = "feu allumé"\n'
        raw = code.encode("latin-1")
        f = read_uploads([upload("models/trafficLightModel.py", raw)])["models/trafficLightModel.py"]
        self.assertEqual(f["text"], code)
        self.assertFalse(f.get("binary", False))
        self.assertEqual(base64.b64decode(f["base64"]), raw)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as z:
            z.writestr("trafficLightModel.py", raw)
        f = read_uploads([upload("examples.zip", archive.getvalue())])["examples.zip/trafficLightModel.py"]
        self.assertEqual(f["text"], code)

    def test_python_encoding_errors_are_explicit_and_utf8_remains_readable(self):
        for raw in (b"# coding: missing-encoding\nsource", b"# coding: utf-8\n\xff"):
            f = read_uploads([upload("broken.py", raw)])["broken.py"]
            self.assertTrue(f["binary"])
            self.assertTrue(f["decodeError"])
        f = read_uploads([upload("utf8.py", "# coding: utf-8\n# Modèle")])["utf8.py"]
        self.assertIn("Modèle", f["text"])
        self.assertNotIn("base64", f)

    def test_imported_python_unicode_literals_survive_utf8_storage(self):
        code = '# coding: Latin-1\nlabel = "feu allumé"\n'
        p = package()
        p["models"][0]["code"] = code
        warnings = normalize_python_headers(p)
        stored = p["models"][0]["code"].encode("utf-8")
        tree = ast.parse(stored)
        self.assertEqual(tree.body[0].value.value, "feu allumé")
        self.assertTrue(warnings)
        self.assertEqual(normalize_python_headers(p), [])

    def test_sqlite_and_pickle_inspection_do_not_execute_uploaded_code(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE models(name TEXT, code TEXT)")
        db.execute("INSERT INTO models VALUES('A','class A: pass')")
        files = read_uploads([upload("models.db", db.serialize())])
        db.close()
        self.assertEqual(inspect_binary(files["models.db"], "sqlite")["tables"][0][0], "models")
        self.assertEqual(inspect_binary(files["models.db"], "sqlite", "models")["rows"][0][0], "A")
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "should-not-exist"

            class Payload:
                def __reduce__(self):
                    return (eval, (f"__import__('pathlib').Path({str(marker)!r}).write_text('bad')",))

            f = read_uploads([upload("unsafe.dsp", pickle.dumps(Payload()))])["unsafe.dsp"]
            report = inspect_binary(f, "pickle")
            self.assertTrue(report["operations"])
            self.assertFalse(marker.exists())

    def test_iso_leaf_and_shared_definitions_preserve_hierarchy(self):
        source = leaf()
        root = {**source, "modelId": "root-definition", "name": "Root", "type": "composite", "composition": {"components": [{"instanceId": "one", "modelId": "a"}, {"instanceId": "two", "modelId": "a"}], "connections": [{"from": {"instanceId": "one", "port": "out"}, "to": {"instanceId": "root", "port": "out"}}]}}
        root.pop("implementation")
        result = iso({"schemaVersion": source["schemaVersion"], "kind": "ModelPackage", "rootModelId": "root-definition", "models": [root, source]})
        self.assertEqual(len(result["models"]), 2)
        self.assertEqual(result["models"][0]["components"][0]["modelId"], result["models"][0]["components"][1]["modelId"])
        self.assertEqual(result["models"][1]["original"], source)

    def test_iso_versions_and_incomplete_packages_are_rejected(self):
        for change in ({"schemaVersion": "future"}, {"type": "composite"}, {"ports": [{"name": "out", "type": "out"}]}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                iso({**leaf(), **change})

    def test_reject_invalid_topology_types_and_cycles(self):
        for change in ("port", "type", "cycle", "root"):
            p = package()
            if change == "port":
                p["models"][0]["ports"].append({"name": "out", "type": "in"})
            elif change == "type":
                p["models"][0]["parameters"][0]["value"] = 4
            elif change == "root":
                p["roots"] = ["missing"]
            else:
                p["models"][0].update(type="coupled", components=[{"instanceId": "self", "modelId": "a"}])
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate(p)

    def test_archive_traversal_duplicates_and_bomb_limits(self):
        for name in ("../outside.py", "/outside.py", "C:/outside.py"):
            with self.assertRaises(ValueError):
                read_uploads([upload(name, "source")])
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as z:
            z.writestr("../outside", "source")
        with self.assertRaises(ValueError):
            read_uploads([upload("input.zip", archive.getvalue())])
        with self.assertRaises(ValueError):
            read_uploads([upload("a", "a"), upload("a", "b")])

    def test_readers_never_execute_source_or_binary(self):
        files = read_uploads([upload("a.py", "raise RuntimeError('never run')"), upload("binary.dsp", b"\x00\xff")])
        self.assertIn("never run", files["a.py"]["text"])
        self.assertTrue(files["binary.dsp"]["binary"])
        self.assertEqual(decode("name,kind\na,atomic", "csv")[0]["name"], "a")
        self.assertEqual(decode('<model name="A"/>', "xml")["attributes"]["name"], "A")
        with self.assertRaises(ValueError):
            decode('<!DOCTYPE x [<!ENTITY z "x">]><x/>', "xml")

    def test_reusable_adapter_extracts_new_values_and_checks_signature(self):
        adapter = {"codec": "json", "signature": [{"path": ["format"], "equals": "example-v1"}], "mapping": {"version": "1", "roots": ["a"], "models": {"$each": ["models"], "template": {"id": "a", "name": {"$path": ["name"]}, "type": "atomic", "code": {"$path": ["code"]}}}}}
        for name in ("First", "Second"):
            result = apply_adapter(adapter, json.dumps({"format": "example-v1", "models": [{"name": name, "code": name}]}))
            self.assertEqual(result["models"][0]["code"], name)
        with self.assertRaises(ValueError):
            apply_adapter(adapter, '{"format":"example-v2"}')


class AgentTest(unittest.TestCase):
    def test_source_references_preserve_helpers_without_regenerating_or_executing(self):
        text = "# original license\nfrom engine import Atomic\nLIMIT = 4\nclass State:\n    label = 'été'\nclass First(Atomic):\n    def __init__(self):\n        self.state = State()\n        self.limit = LIMIT\nclass Second(Atomic):\n    pass\n"
        selected = extract({"text": text}, ["First"])
        self.assertIn("# original license", selected)
        self.assertIn("label = 'été'", selected)
        self.assertIn("LIMIT = 4", selected)
        self.assertNotIn("class Second", selected)
        self.assertEqual([n.name for n in ast.parse(selected).body if isinstance(n, ast.ClassDef)], ["State", "First"])
        self.assertEqual(extract({"text": "raise RuntimeError('never executed')"}), "raise RuntimeError('never executed')")
        with self.assertRaisesRegex(ValueError, "Dynamic"):
            extract({"text": text + "raise RuntimeError('never executed')\n"}, ["First"])
        with self.assertRaisesRegex(ValueError, "Unknown source symbols"):
            extract({"text": text}, ["Missing"])
        source = package()
        source["models"][0].pop("code")
        source["models"][0]["codeRef"] = "source-1"
        invalid = copy.deepcopy(source)
        invalid["models"][0]["codeRef"] = "missing-reference"
        calls = iter([("finish_import", {"package": invalid, "warnings": []}), ("select_source", {"name": "model.py", "symbols": ["First"]}), ("finish_import", {"package": source, "warnings": []})])
        def call():
            name, args = next(calls)
            return {"role": "assistant", "tool_calls": [{"id": name, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}
        results = []
        agent.run({"model.py": {"text": text, "size": len(text)}}, {}, {}, lambda _: None, lambda: False, lambda *args: results.append(args), call)
        self.assertEqual(results[0][0]["models"][0]["code"], selected)
        self.assertNotIn("codeRef", results[0][0]["models"][0])

    def test_validation_feedback_repair_and_unknown_framework_retention(self):
        responses = iter([
            ("read_file", {"name": "model.py"}),
            ("finish_import", {"package": {"version": "bad"}, "warnings": []}),
            ("finish_import", {"package": package(), "warnings": ["Unknown framework"]}),
        ])

        def call():
            name, args = next(responses)
            return {"role": "assistant", "tool_calls": [{"id": name, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}

        results = []
        agent.run({"model.py": {"text": "original", "size": 8}}, {}, {}, lambda _: None, lambda: False, lambda *args: results.append(args), call)
        self.assertEqual(results[0][0]["models"][0]["framework"], "unrecognized")
        self.assertIsNone(results[0][1])

    def test_bounded_agent_cancels_and_never_accepts_text_as_a_package(self):
        with self.assertRaisesRegex(ValueError, "cancelled"):
            agent.run({}, {}, {}, lambda _: None, lambda: True, lambda *args: None)
        with self.assertRaisesRegex(ValueError, "tool-calling support"):
            agent.run({}, {}, {}, lambda _: None, lambda: False, lambda *args: None, lambda: {"role": "assistant", "content": "done"})


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        store = patch.object(server, "STORE", server.Store(self.directory.name))
        store.start()
        self.addCleanup(store.stop)
    def test_adapter_cache_is_user_scoped_and_revalidates_new_source(self):
        adapter = {"codec": "json", "signature": [{"path": ["format"], "equals": "fixture-v1"}], "mapping": {"version": "1", "roots": ["a"], "models": [{"id": "a", "type": "atomic", "name": {"$path": ["name"]}, "code": {"$path": ["code"]}}]}}
        calls = []

        def fake_agent(files, settings, context, progress, cancel, finish, **kwargs):
            calls.append(True)
            finish(apply_adapter(adapter, next(iter(files.values()))["text"]), adapter, [])

        with tempfile.TemporaryDirectory() as directory, patch.object(server, "DATA", Path(directory)), patch.object(server.agent, "run", fake_agent):
            for user, name in (("one", "First"), ("one", "Second"), ("two", "Other user")):
                body = {"mode": "ai", "files": [upload("input.json", json.dumps({"format": "fixture-v1", "name": name, "code": name}))], "llm": {"url": "http://not-contacted.test", "model": "mock"}}
                job = {"id": name, "user": user, "cancel": False}
                server.SLOTS.acquire()
                server.process(job, body)
                self.assertEqual(job["state"], "ready", job)
                self.assertEqual(job["package"]["models"][0]["code"], name)
            self.assertEqual(len(calls), 2)

    def test_actual_agent_http_provider_repair_and_conversion_target(self):
        calls = []
        source = package()
        source["models"][0].update(integrationId="devsimpy-python", integrationVersion="1.0.0", framework="DEVSimPy")

        class Provider(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                calls.append(request)
                if len(calls) == 1:
                    name, args = "read_file", {"name": "model.py"}
                elif len(calls) == 2:
                    name, args = "finish_import", {"package": {"version": "bad"}, "warnings": []}
                elif len(calls) == 3:
                    # Valid core, but the agent forgot the selected target. This
                    # used to fail after leaving the tool loop, with no repair.
                    name, args = "finish_import", {"package": package(), "warnings": []}
                else:
                    name, args = "finish_import", {"package": source, "warnings": ["Converted behavior requires review"]}
                message = {"role": "assistant", "tool_calls": [{"id": str(len(calls)), "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"choices": [{"message": message}]}).encode())

        provider = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
        thread = threading.Thread(target=provider.serve_forever, daemon=True)
        thread.start()
        body = {"mode": "ai", "files": [upload("model.py", "original code")], "llm": {"url": f"http://127.0.0.1:{provider.server_port}/v1", "key": "mock-key", "model": "mock-model"}, "target": {"id": "devsimpy-python", "version": "1.0.0", "instructions": "real template context"}}
        job = {"id": "provider-test", "user": "mock-user", "cancel": False}
        try:
            server.SLOTS.acquire()
            server.process(job, body)
            self.assertEqual(job["state"], "ready", job)
            self.assertEqual(job["strategy"], "one-off")
            self.assertEqual(len(calls), 4)
            self.assertIn("real template context", calls[0]["messages"][1]["content"])
            self.assertIn("error", calls[2]["messages"][-1]["content"])
            self.assertIn("devsimpy-python@1.0.0", calls[3]["messages"][-1]["content"])
            self.assertNotIn("mock-key", json.dumps(job))
            self.assertNotIn("llm", body)
        finally:
            provider.shutdown()
            provider.server_close()

    def test_http_iso_ownership_cancel_and_private_token(self):
        with patch.object(server, "TOKEN", "private-test"):
            http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            thread = threading.Thread(target=http.serve_forever, daemon=True)
            thread.start()
            base = "http://127.0.0.1:" + str(http.server_port)

            def req(method, path, data=None, user="one", token="private-test"):
                request = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None, method=method, headers={"Authorization": "Bearer " + token, "X-Import-User": user})
                with urllib.request.urlopen(request, timeout=5) as r:
                    return json.load(r)

            try:
                job = req("POST", "/jobs", {"mode": "iso", "files": [upload("model.json", json.dumps(leaf()))]})
                for _ in range(100):
                    result = req("GET", "/jobs/" + job["id"])
                    if result["state"] != "running":
                        break
                    time.sleep(0.01)
                self.assertEqual(result["state"], "ready")
                self.assertEqual(result["package"]["models"][0]["code"], "class A: pass")
                drafts = req("GET", "/jobs")
                self.assertEqual([d["id"] for d in drafts], [job["id"]])
                self.assertEqual(drafts[0]["title"], "Example")
                self.assertNotIn("package", drafts[0])
                self.assertNotIn("user", drafts[0])
                self.assertEqual(req("GET", "/jobs", user="other"), [])
                with self.assertRaises(urllib.error.HTTPError) as stale:
                    req("POST", "/jobs/" + job["id"] + "/seal", {"revision": 999})
                self.assertEqual(stale.exception.code, 409)
                self.assertTrue(req("POST", "/jobs/" + job["id"] + "/seal", {"revision": result["revision"]})["sealed"])
                with self.assertRaises(urllib.error.HTTPError) as sealed:
                    req("POST", "/jobs/" + job["id"] + "/turns", {"action": "discuss", "instructions": "change this"})
                self.assertEqual(sealed.exception.code, 409)
                for user, token in (("other", "private-test"), ("one", "wrong")):
                    with self.assertRaises(urllib.error.HTTPError):
                        req("GET", "/jobs/" + job["id"], user=user, token=token)
                self.assertEqual(req("DELETE", "/jobs/" + job["id"])["state"], "cancelled")
                self.assertEqual(req("GET", "/jobs"), [])
                with self.assertRaises(urllib.error.HTTPError):
                    req("GET", "/jobs/" + job["id"])
            finally:
                http.shutdown()
                http.server_close()
