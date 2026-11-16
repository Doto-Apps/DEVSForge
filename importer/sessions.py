"""Durable, user-scoped import drafts. Credentials and provider tool history never persist."""
import copy
import hashlib
import json
import os
from pathlib import Path
import time

PUBLIC = {"id", "state", "progress", "error", "strategy", "warnings", "package",
          "messages", "attempts", "revision", "verification", "updated", "phase", "changes"}
RETENTION = 7 * 86400


def public(job):
    return copy.deepcopy({k: v for k, v in job.items() if k in PUBLIC})


def fingerprint(package):
    return hashlib.sha256(json.dumps({k: v for k, v in package.items() if k != "assets"},
                                    sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def message(job, role, text):
    job.setdefault("messages", []).append({"id": str(time.time_ns()), "role": role, "content": str(text)[:12000]})
    job["messages"] = job["messages"][-80:]


class Store:
    def __init__(self, directory):
        self.directory = Path(directory) / "sessions"

    def path(self, job):
        user = hashlib.sha256(job["user"].encode()).hexdigest()
        return self.directory / user / (job["id"] + ".json")

    def save(self, job):
        job["updated"] = time.time()
        path = self.path(job)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        # Context is a whitelist built by the server; no LLM settings here.
        data = {k: v for k, v in job.items() if k != "cancel"}
        temporary.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(temporary, path)

    def delete(self, job):
        self.path(job).unlink(missing_ok=True)

    def load(self):
        jobs = {}
        for path in self.directory.glob("*/*.json"):
            try:
                job = json.loads(path.read_text(encoding="utf-8"))
                if time.time() - job["updated"] > RETENTION:
                    path.unlink()
                    continue
                job["cancel"] = False
                if job["state"] == "running":
                    job.update(state="ready" if job.get("package") else "awaiting_user", phase="interrupted",
                               progress="The service restarted. Your draft is preserved; resume when ready.")
                    message(job, "assistant", job["progress"])
                jobs[job["id"]] = job
            except (ValueError, KeyError, OSError):
                continue
        return jobs
