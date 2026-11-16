import copy
import json
import tempfile
import time
import unittest
from unittest.mock import patch

import agent
import server
from sessions import Store, fingerprint, public
from test_importer import package


def invoke(name, args):
    return {"role": "assistant", "tool_calls": [{"id": name, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}


class ConversationTest(unittest.TestCase):
    def test_adaptation_preserves_semantics_but_allows_documentation_changes(self):
        original = package()
        documented = copy.deepcopy(original)
        documented["models"][0]["parameters"][0]["description"] = "Now injected through a setter"
        documented["models"][0]["parameters"].append({"name": "recovered", "type": "int", "value": 2})
        changed = copy.deepcopy(documented)
        changed["models"][0]["parameters"][0]["value"] = "a different default"
        replies = iter([invoke("finish_import", {"package": changed, "warnings": []}), invoke("finish_import", {"package": documented, "warnings": []})])
        executed, results = [], []
        def simulate(p):
            executed.append(p)
            return {"status": "completed"}
        agent.run({}, {}, {"action": "adapt", "currentPackage": original}, lambda _: None, lambda: False,
                  lambda *p: results.append(p), call=lambda: next(replies), reply=lambda _: None, simulate=simulate)
        self.assertEqual(len(executed), 1)
        self.assertEqual(results[0][0]["models"][0]["parameters"][0]["value"], "abc")

    def test_discussion_can_explain_and_cannot_modify_or_execute(self):
        original = package()
        replies, saves, executions = [], [], []
        calls = iter([invoke("finish_import", {"package": package(), "warnings": []}),
                      invoke("test_import", {"package": package()}),
                      {"role": "assistant", "content": "The helper is missing. Shall we adapt it?"}])
        agent.run({}, {}, {"action": "discuss", "currentPackage": original}, lambda _: None, lambda: False,
                  lambda *x: saves.append(x), call=lambda: next(calls), reply=replies.append,
                  simulate=lambda p: executions.append(p))
        self.assertEqual(len(replies), 1)
        self.assertFalse(saves)
        self.assertFalse(executions)
        self.assertEqual(original, package())

    def test_failed_simulation_is_repaired_and_reexecuted_before_finish(self):
        first = package()
        second = copy.deepcopy(first)
        second["models"][0]["code"] = "corrected source"
        calls = iter([invoke("finish_import", {"package": first, "warnings": []}),
                      invoke("test_import", {"package": second}),
                      invoke("finish_import", {"package": second, "warnings": ["Review the adaptation"]})])
        tested, results = [], []
        def simulate(p):
            tested.append(copy.deepcopy(p))
            return {"status": "failed", "error": "missing helper"} if len(tested) == 1 else {"status": "completed"}
        agent.run({}, {}, {"action": "adapt"}, lambda _: None, lambda: False, lambda *p: results.append(p),
                  call=lambda: next(calls), reply=lambda _: None, simulate=simulate)
        self.assertEqual(len(tested), 2)
        self.assertEqual(results[0][0]["models"][0]["code"], "corrected source")

    def test_three_attempt_limit_and_question_instead_of_infinite_repair(self):
        drafts = []
        for i in range(4):
            p = package(); p["models"][0]["code"] = str(i); drafts.append(p)
        calls = iter([*(invoke("test_import", {"package": p}) for p in drafts), invoke("respond", {"message": "This requires the missing library. Can you supply its API?"})])
        tested, replies = [], []
        def simulate(p):
            tested.append(p)
            return {"status": "failed"}
        agent.run({}, {}, {"action": "adapt"}, lambda _: None, lambda: False, lambda *p: self.fail("not ready"),
                  call=lambda: next(calls), reply=replies.append, simulate=simulate)
        self.assertEqual(len(tested), 3)
        self.assertEqual(len(replies), 1)

    def test_resume_after_restart_private_files_and_test_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(directory)
            original = package()
            job = {"id": "a"*48, "user": "one", "created": time.time(), "state": "running", "cancel": False,
                   "package": original, "_original": copy.deepcopy(original), "_files": {"a.py": {"text": "original", "size": 8}}, "revision": 1}
            store.save(job)
            resumed = store.load()[job["id"]]
            self.assertEqual(resumed["state"], "ready")
            self.assertNotIn("_files", public(resumed))
            self.assertNotIn("user", public(resumed))
            with patch.object(server, "STORE", store), patch.object(server.verification, "simulate", return_value={"status": "completed"}) as simulation:
                server.SLOTS.acquire()
                server.process(resumed, {"action": "test", "rootId": "a", "maxTime": 400})
                simulation.assert_called_once()
                self.assertEqual(resumed["verification"]["status"], "completed")
                self.assertEqual(resumed["verification"]["maxTime"], 400)
                self.assertEqual(resumed["verification"]["digest"], fingerprint(original))
                resumed["package"]["models"][0]["code"] = "edited"
                server.SLOTS.acquire()
                server.process(resumed, {"action": "restore"})
                self.assertEqual(resumed["package"]["models"][0]["code"], original["models"][0]["code"])
            stored_text = store.path(resumed).read_text(encoding="utf-8")
            self.assertNotIn('"llm"', stored_text)
            store.delete(resumed)
            self.assertFalse(store.load())

    def test_provider_failure_keeps_draft_and_can_resume(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(server, "STORE", Store(directory)), patch.object(agent, "run", side_effect=ValueError("provider unavailable")):
            job = {"id": "b"*48, "user": "one", "cancel": False, "package": package(), "_files": {"a.py": {"text": "source", "size": 6}}}
            original = copy.deepcopy(job["package"])
            body = {"action": "discuss", "llm": {"url": "unused", "model": "unused", "key": "secret-never-persist"}}
            server.SLOTS.acquire(); server.process(job, body)
            self.assertEqual(job["state"], "ready")
            self.assertEqual(job["package"], original)
            self.assertNotIn("secret-never-persist", server.STORE.path(job).read_text())


if __name__ == "__main__":
    unittest.main()
