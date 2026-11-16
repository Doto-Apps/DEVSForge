"""Opt-in live worker check. API key comes from stdin, never from arguments/files."""
import argparse
import base64
import getpass
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("folder", type=Path)
parser.add_argument("--model", default="gpt-5.4")
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--include", action="append", help="Include only these relative file names")
parser.add_argument("--instructions", default="", help="Optional import context, as entered in the interface")
parser.add_argument("--expect-traffic-system", action="store_true", help="Assert the fixture's three models, ports and coupling")
args = parser.parse_args()
print("Waiting for API key on stdin", flush=True)
key = getpass.getpass("API key: ") if sys.stdin.isatty() else sys.stdin.readline().strip()
if not key:
    raise SystemExit("Missing API key")

def worker(method, path, body=None):
    code = """import sys,json,os,urllib.request
method,path,body=json.load(sys.stdin)
req=urllib.request.Request('http://127.0.0.1:8091'+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+os.environ['IMPORT_INTERNAL_TOKEN'],'X-Import-User':'live-import-audit','Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=30) as response: print(response.read().decode())
"""
    result = subprocess.run(["docker", "exec", "-i", "devsforge-importer-1", "python", "-c", code], input=json.dumps([method, path, body]), text=True, encoding="utf-8", capture_output=True)
    if result.returncode:
        raise RuntimeError("Worker request failed: " + result.stderr[-1200:])
    return json.loads(result.stdout)

with urllib.request.urlopen("http://127.0.0.1:3000/integrations") as response:
    integrations = json.load(response)
contexts = []
for integration in integrations:
    root = Path(__file__).resolve().parents[1] / "simulator" / "runner" / "integrations" / integration["id"]
    if not integration.get("capabilities", {}).get("ai"):
        continue
    definition = json.loads((root / "integration.json").read_text(encoding="utf-8"))
    template = (root / definition["template"]).read_text(encoding="utf-8").replace("{{.Name}}", "MyModel")
    contract = (root / definition["prompt"]).read_text(encoding="utf-8").replace("%s", template)
    contexts.append({**{k: integration[k] for k in ("id", "version", "framework", "language")}, "contract": contract[:16000]})
files = [{"name": p.relative_to(args.folder).as_posix(), "base64": base64.b64encode(p.read_bytes()).decode()} for p in sorted(args.folder.rglob("*.py")) if not args.include or p.relative_to(args.folder).as_posix() in args.include]
if not files:
    raise SystemExit("No Python source files selected")
print(f"Testing {len(files)} real source files with {args.model}", flush=True)
job = worker("POST", "/jobs", {"mode": "ai", "files": files, "integrations": integrations, "integrationContexts": contexts, "llm": {"url": "https://api.openai.com/v1", "key": key, "model": args.model}, "instructions": args.instructions})
key = None
last = None
deadline = time.monotonic() + 670
while time.monotonic() < deadline:
    job = worker("GET", "/jobs/" + job["id"])
    status = (job.get("state"), job.get("progress"))
    if status != last:
        print(*status, flush=True)
        last = status
    if job["state"] != "running":
        break
    time.sleep(2)
else:
    worker("DELETE", "/jobs/" + job["id"])
    raise SystemExit("Live check timed out; job cancelled")
if job["state"] != "ready":
    print(job.get("error", "Import failed"), flush=True)
    raise SystemExit(1)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"models": [{k: m.get(k) for k in ("name", "type", "framework", "integrationId", "ports", "components", "connections", "missing")} for m in job["package"]["models"]], "warnings": job.get("warnings")}, ensure_ascii=True), flush=True)
worker("DELETE", "/jobs/" + job["id"])
if args.expect_traffic_system:
    models = {m["name"]: m for m in job["package"]["models"]}
    assert set(models) == {"TrafficLight", "Policeman", "TrafficSystem"}, "Unexpected model definitions"
    assert {(p["name"], p["type"]) for p in models["TrafficLight"]["ports"]} == {("INTERRUPT", "in"), ("OBSERVED", "out")}, "TrafficLight ports incomplete"
    assert {(p["name"], p["type"]) for p in models["Policeman"]["ports"]} == {("OUT", "out")}, "Policeman ports incomplete"
    root = models["TrafficSystem"]
    assert len(root["components"]) == 2 and len(root["connections"]) == 1, "TrafficSystem topology incomplete"
    assert root["id"] in job["package"]["roots"], "TrafficSystem is not a root"
    instances = {c["instanceId"]: c["modelId"] for c in root["components"]}
    connection = root["connections"][0]
    assert instances[connection["from"]["instanceId"]] == models["Policeman"]["id"] and connection["from"]["port"] == "OUT", "Wrong coupling source"
    assert instances[connection["to"]["instanceId"]] == models["TrafficLight"]["id"] and connection["to"]["port"] == "INTERRUPT", "Wrong coupling destination"
    print("PASS_TRAFFIC_SYSTEM_STRUCTURE", flush=True)
print("PASS_LIVE_PROVIDER_IMPORT", flush=True)
