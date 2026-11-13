"""Vendor the native PyPDEVS modeling subset referenced by a DEVSimPy checkout."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

source, pypdevs = (Path(arg).resolve() for arg in sys.argv[1:])
root = Path(__file__).resolve().parent
wrapper = root / "wrapper"
commit = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
reference = "devsimpy/DEVSKernel/PyPDEVS/pypdevs241/pypdevs"
pinned = subprocess.check_output(["git", "-C", str(source), "ls-tree", "HEAD", reference], text=True).split()[2]
actual = subprocess.check_output(["git", "-C", str(pypdevs), "rev-parse", "HEAD"], text=True).strip()
if actual != pinned:
    raise SystemExit(f"Expected the PyPDEVS revision pinned by DEVSimPy: {pinned}, got {actual}")
records = {}
for name in ("__init__.py", "DEVS.py", "infinity.py", "logger.py", "util.py", "middleware.py", "MPIRedirect.py"):
    upstream = pypdevs / "pypdevs" / name
    original = upstream.read_bytes()
    text = original.decode("utf-8")
    if name == "MPIRedirect.py":
        text = text.replace("import exceptions", "# DEVSForge Python 3 compatibility adaptation, 2026-11-13.\nimport builtins as exceptions")
    if name == "util.py":
        text = text.replace('str(self.message)', 'str(self.args[0])  # DEVSForge Python 3 compatibility, 2026-11-13')
    target = wrapper / "pypdevs" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    records["pypdevs/" + name] = {
        "upstream": "pypdevs/" + name,
        "originalSha256": hashlib.sha256(original).hexdigest(),
        "installedSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    }
for name in ("LICENSE", "NOTICE"):
    shutil.copyfile(pypdevs / name, wrapper / "pypdevs" / name)
fixture = "examples/trafficlight_parallel/model.py"
fixture_target = root / "tests/fixtures/trafficlight_parallel.py"
fixture_target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(pypdevs / fixture, fixture_target)
(root / "upstream.json").write_text(json.dumps({
    "devsimpy": {"repository": "https://github.com/capocchi/DEVSimPy", "commit": commit, "reference": reference},
    "repository": "https://github.com/kdheepak/pypdevs",
    "commit": actual,
    "version": "2.4.1",
    "license": "Apache-2.0",
    "files": records,
    "fixture": {"path": "tests/fixtures/trafficlight_parallel.py", "upstream": fixture, "sha256": hashlib.sha256(fixture_target.read_bytes()).hexdigest()},
    "adaptations": ["MPIRedirect imports builtins instead of Python 2 exceptions", "DEVSException.__str__ reads Exception.args on Python 3", "DEVS.py and its native bag/transition API are unchanged"],
}, indent=2) + "\n")
