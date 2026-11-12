#!/usr/bin/env python3
"""Publish Pyright's matching standard-library stubs as static browser data."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

REVISION = "64408a1d1e5b2a59abc562e2782a735c03146073"

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="devsforge-pyright-") as temp:
    subprocess.run(["git", "init", "-q", temp], check=True)
    subprocess.run(["git", "-C", temp, "fetch", "-q", "--depth", "1", "https://github.com/TypeFox/pyright", REVISION], check=True)
    subprocess.run(["git", "-C", temp, "checkout", "-q", "FETCH_HEAD"], check=True)
    root = Path(temp) / "packages/pyright-internal/typeshed-fallback"
    files = {"/typeshed/" + p.relative_to(root).as_posix(): p.read_text()
             for p in (root / "stdlib").rglob("*") if p.is_file()}
    (args.output / "stdlib.json").write_text(json.dumps(files, separators=(",", ":")))
    shutil.copyfile(root / "LICENSE", args.output / "LICENSE-typeshed")
