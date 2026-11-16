"""Private, resumable import sessions with bounded agent turns and real verification."""
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import threading
import time
import copy

import agent
import verification
from sessions import Store, public, message, fingerprint, RETENTION
from formats import apply_adapter, read_uploads, normalize_python_headers
from adapters.iso21175_v07 import convert as iso
from schema import validate_target

LOCK = threading.RLock()
SLOTS = threading.BoundedSemaphore(2)
TOKEN = os.environ.get("IMPORT_INTERNAL_TOKEN", "")
DATA = Path(os.environ.get("IMPORT_DATA_DIR", "/data"))
STORE = Store(DATA)
JOBS = STORE.load()


def scrub(job):
    return public(job)


def process(job, body):
    try:
        files = job.get("_files") or read_uploads(body.get("files", []))
        job["_files"] = files
        action = body.get("action", "analyze")
        context = {"request": body.get("instructions", ""), "files": list(files), "integrations": body.get("integrations", []), "integrationContexts": body.get("integrationContexts", []), "target": body.get("target"), "conversionRequested": bool(body.get("target")), "action": action}
        job["_context"] = {k: v for k, v in context.items() if k not in ("request", "action")}
        if job.get("package"):
            context["currentPackage"] = {k: v for k, v in job["package"].items() if k != "assets"}
        context["conversation"] = job.get("messages", [])[-20:]
        context["initialRequest"] = job.get("_initial_request", "")
        context["previousAttempts"] = job.get("attempts", [])[-3:]
        if job.get("_last_tested"):
            context["lastTestedPackage"] = job["_last_tested"]
        with LOCK:
            if job["cancel"]:
                return
            STORE.save(job)

        def progress(message):
            with LOCK:
                job["progress"] = message

        def respond(text):
            with LOCK:
                if job["cancel"]:
                    return
                message(job, "assistant", text)
                if job.get("package") and job.get("verification", {}).get("digest") != fingerprint(job["package"]):
                    job["verification"] = {"status": "not_tested"}
                job.update(state="ready" if job.get("package") else "awaiting_user", phase="discussion", progress="Your turn")
                STORE.save(job)

        def test(package):
            if job["cancel"]:
                raise ValueError("Import stopped")
            if len(job.get("attempts", [])) >= 30:
                raise ValueError("Session limit of 30 verification attempts reached; keep the draft or start a new import")
            root = body.get("rootId") or package["roots"][0]
            horizon = body.get("maxTime", 100)
            progress("Compiling and running a verification simulation")
            report = verification.simulate({k: v for k, v in package.items() if k != "assets"}, horizon, root, job["user"])
            report.update(rootId=root, maxTime=horizon, digest=fingerprint(package), revision=job.get("revision", 0) + (action == "adapt"))
            with LOCK:
                if job["cancel"]:
                    raise ValueError("Import stopped")
                job.setdefault("attempts", []).append(report)
                job["_last_tested"] = copy.deepcopy({k: v for k, v in package.items() if k != "assets"})
                job["verification"] = report
                message(job, "system", f"Verification {len(job['attempts'])}: {report.get('status', 'unknown')} (root {root}, horizon {horizon}). " + report.get("error", ""))
                STORE.save(job)
            return report

        def finish(package, adapter=None, warnings=None):
            if job["cancel"]:
                return
            # Original files remain available after conversion and can be downloaded.
            package["assets"] = files
            warnings = list(warnings or []) + normalize_python_headers(package)
            if body.get("target"):
                # Code translation is not a structural parser and must not be reused for other source.
                adapter = None
                validate_target(package, body["target"])
            if adapter:
                directory = DATA / hashlib.sha256(job["user"].encode()).hexdigest()
                directory.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256(json.dumps(adapter, sort_keys=True).encode()).hexdigest()
                if len(list(directory.glob("*.json"))) >= 100 and not (directory / (digest + ".json")).exists():
                    adapter = None
                # File path is content-addressed, never chosen by the agent.
                if adapter:
                    (directory / (digest + ".json")).write_text(json.dumps(adapter), encoding="utf-8")
            with LOCK:
                if job["cancel"]:
                    return
                job.setdefault("_original", copy.deepcopy({k: v for k, v in package.items() if k != "assets"}))
                original = {m["id"]: m for m in job["_original"]["models"]}
                changes = []
                for model in package["models"]:
                    before = original.get(model["id"])
                    if before is None:
                        changes.append(model["name"] + ": added model definition")
                    else:
                        fields = [k for k in ("code", "ports", "parameters", "components", "connections", "integrationId") if before.get(k) != model.get(k)]
                        if fields:
                            changes.append(model["name"] + ": changed " + ", ".join(fields))
                current_ids = {m["id"] for m in package["models"]}
                changes.extend(m["name"] + ": removed model definition" for mid, m in original.items() if mid not in current_ids)
                job["changes"] = changes
                job["revision"] = job.get("revision", 0) + 1
                if job.get("verification", {}).get("digest") != fingerprint(package):
                    job["verification"] = {"status": "not_tested"}
                job.update(state="ready", phase="review", package=package, warnings=warnings or [], strategy="adapter" if adapter else ("iso" if body.get("mode") == "iso" else "one-off"), progress="Review the imported models before saving")
                status = job.get("verification", {}).get("status", "not_tested")
                message(job, "assistant", f"I recovered {len(package['models'])} model definitions. " + ("The verification simulation completed. This checks execution, not equivalence with the original model." if status == "completed" else "Execution is not verified. You can discuss the report, verify this draft, adapt it to an installed framework, or keep it for editing.") + ("\n\n" + "\n".join(warnings[:8]) if warnings else ""))
                STORE.save(job)

        if action == "restore":
            package = copy.deepcopy(job["_original"])
            body.pop("target", None)
            finish(package, warnings=["Restored the first imported draft. Original uploaded files were retained throughout."])
            return
        if action == "test":
            test(job["package"])
            respond("The verification result is available below. You can discuss any failure, adapt and retry, or keep the draft for editing.")
            return

        if body.get("mode") == "iso":
            texts = [f["text"] for f in files.values() if "text" in f]
            if len(texts) != 1 or len(files) != 1:
                raise ValueError("Select exactly one ISO JSON document")
            finish(iso(json.loads(texts[0])))
        elif body.get("mode") == "ai" or action in ("discuss", "adapt"):
            settings = body.get("llm", {})
            if not settings.get("url") or not settings.get("model"):
                raise ValueError("Configure an LLM URL and a tool-calling model in Settings")
            directory = DATA / hashlib.sha256(job["user"].encode()).hexdigest()
            if action == "analyze" and not body.get("target") and len(files) == 1 and directory.exists():
                source = next(iter(files.values()))
                for p in sorted(directory.glob("*.json"))[:100]:
                    try:
                        adapter = json.loads(p.read_text(encoding="utf-8"))
                        package = apply_adapter(adapter, source.get("text", ""))
                        finish(package, adapter, ["Reused a user-scoped declarative adapter; structure revalidated. Review source semantics."])
                        return
                    except (ValueError, KeyError, TypeError, IndexError):
                        continue
            context["verificationSettings"] = {"rootId": body.get("rootId"), "maxTime": body.get("maxTime", 100)}
            agent.run(files, settings, context, progress, lambda: job["cancel"], finish, reply=respond, simulate=test if action == "adapt" else None)
        else:
            raise ValueError("Select ISO or AI import")
    except Exception as e:
        with LOCK:
            if not job["cancel"]:
                job.update(state="ready" if job.get("package") else "awaiting_user", phase="interrupted", error=str(e)[:1200])
                message(job, "assistant", "This step could not be completed: " + str(e)[:1200] + " Your previous draft is preserved.")
                STORE.save(job)
    finally:
        body.pop("llm", None)
        SLOTS.release()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log uploaded source, API keys or provider responses.

    def reply(self, status, body):
        encoded = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def dispatch(self):
        if self.path == "/health" and self.command == "GET":
            return self.reply(200, {"status": "ok"})
        if not TOKEN or not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN):
            return self.reply(401, {"error": "Unauthorized"})
        user = self.headers.get("X-Import-User", "")
        if not user:
            return self.reply(401, {"error": "Missing user"})
        with LOCK:
            for jid, job in list(JOBS.items()):
                if job["state"] != "running" and time.time() - job.get("updated", job["created"]) > RETENTION:
                    job["cancel"] = True
                    del JOBS[jid]
                    STORE.delete(job)
            if self.command == "GET" and self.path == "/jobs":
                drafts = []
                for job in sorted(JOBS.values(), key=lambda j: j.get("updated", j["created"]), reverse=True):
                    if job["user"] != user or job["cancel"]:
                        continue
                    package = job.get("package") or {}
                    models = {m["id"]: m for m in package.get("models", [])}
                    names = [models[mid]["name"] for mid in package.get("roots", []) if mid in models]
                    files = list(job.get("_files", {}))
                    drafts.append({"id": job["id"], "title": ", ".join(names)[:200] or (files[0] if files else "Model import"),
                                   "state": job["state"], "updated": job.get("updated", job["created"]),
                                   "modelCount": len(models), "verificationStatus": job.get("verification", {}).get("status", "not_tested")})
                return self.reply(200, drafts)
            if self.command == "POST" and self.path == "/jobs":
                # Failed analyses retain no package; let retries reclaim their small records.
                for old_id, old in sorted(list(JOBS.items()), key=lambda item: item[1]["created"]):
                    if len(JOBS) < 8:
                        break
                    if old["state"] == "failed" or old.get("_sealed"):
                        del JOBS[old_id]
                        STORE.delete(old)
                if any(j["user"] == user and j["state"] == "running" for j in JOBS.values()):
                    return self.reply(429, {"error": "One import per user can run at a time"})
                if len(JOBS) >= 8 or not SLOTS.acquire(blocking=False):
                    return self.reply(429, {"error": "Import service busy; retry shortly"})
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if size <= 0 or size > 20 * 1024 * 1024:
                        raise ValueError("Request must be between 1 byte and 20 MiB")
                    body = json.loads(self.rfile.read(size))
                    if not isinstance(body, dict):
                        raise ValueError("Expected a JSON object")
                except (ValueError, TypeError) as e:
                    SLOTS.release()
                    return self.reply(400, {"error": str(e)})
                jid = secrets.token_hex(24)
                job = {"id": jid, "user": user, "created": time.time(), "state": "running", "phase": "analysis", "progress": "Reading files", "cancel": False, "revision": 0, "attempts": [], "_initial_request": body.get("instructions", "")}
                message(job, "user", body.get("instructions") or "Import these model files.")
                JOBS[jid] = job
                threading.Thread(target=process, args=(job, body), daemon=True).start()
                return self.reply(202, scrub(job))
            parts = self.path.removeprefix("/jobs/").split("/")
            jid = parts[0]
            job = JOBS.get(jid)
            if not job or job["user"] != user:
                return self.reply(404, {"error": "Import not found or expired"})
            if self.command == "POST" and len(parts) == 2 and parts[1] == "seal":
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if not 0 < size < 1024:
                        raise ValueError("Invalid seal request")
                    expected = json.loads(self.rfile.read(size)).get("revision")
                    if job["state"] != "ready" or expected != job.get("revision"):
                        return self.reply(409, {"error": "The draft changed or is still running; review its latest revision"})
                    job["_sealed"] = True
                    STORE.save(job)
                    return self.reply(200, {"sealed": True})
                except (ValueError, TypeError, AttributeError) as e:
                    return self.reply(400, {"error": str(e)})
            if self.command == "POST" and len(parts) == 2 and parts[1] == "turns":
                if job.get("_sealed"):
                    return self.reply(409, {"error": "This revision is being saved. Retry saving it or start a new import."})
                if any(j["user"] == user and j["state"] == "running" for j in JOBS.values()):
                    return self.reply(409, {"error": "An import step is already running"})
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if not 0 < size < 512 * 1024:
                        raise ValueError("Invalid turn size")
                    body = json.loads(self.rfile.read(size))
                    action = body.get("action")
                    if action not in ("discuss", "adapt", "test", "restore"):
                        raise ValueError("Unknown action")
                    if action in ("adapt", "test", "restore") and not job.get("package"):
                        raise ValueError("Recover a model draft first")
                    if action == "adapt" and not body.get("target"):
                        raise ValueError("Choose an installed target integration")
                    if not isinstance(body.get("instructions", ""), str) or len(body.get("instructions", "")) > 12000:
                        raise ValueError("Message too long")
                    if not 0 < float(body.get("maxTime", 100)) <= 1000000:
                        raise ValueError("Simulation horizon must be between 0 and 1000000")
                except (ValueError, TypeError, AttributeError) as e:
                    return self.reply(400, {"error": str(e)})
                if not SLOTS.acquire(blocking=False):
                    return self.reply(429, {"error": "Import service busy; retry shortly"})
                job.update(state="running", phase=action, progress="Preparing next step", cancel=False)
                job.pop("error", None)
                message(job, "user", body.get("instructions") or {"test": "Verify this draft by simulation.", "restore": "Restore the original draft.", "adapt": "Adapt to the selected framework and verify."}.get(action, "Continue the analysis."))
                STORE.save(job)
                threading.Thread(target=process, args=(job, body), daemon=True).start()
                return self.reply(202, scrub(job))
            if self.command == "DELETE":
                job["cancel"] = True
                job["state"] = "cancelled"
                job.pop("package", None)
                del JOBS[jid]
                STORE.delete(job)
                return self.reply(200, {"state": "cancelled"})
            if self.command == "GET":
                return self.reply(200, scrub(job))
            return self.reply(405, {"error": "Method not allowed"})

    def do_GET(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch()

    def do_DELETE(self):
        self.dispatch()


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("IMPORT_INTERNAL_TOKEN is required")
    ThreadingHTTPServer(("0.0.0.0", 8091), Handler).serve_forever()
