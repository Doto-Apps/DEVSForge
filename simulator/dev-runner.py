#!/usr/bin/env python3
"""Development launcher: keep the runner binary in sync with its Go sources."""
import fcntl
import hashlib
import os
from pathlib import Path
import subprocess
import sys


def main():
    workspace = Path(os.environ.get("DEVSFORGE_DEV_WORKSPACE", "/app"))
    binary = Path(os.environ.get("DEVSFORGE_DEV_RUNNER_BINARY", "/runner-build/devsforge-runner"))
    binary.parent.mkdir(parents=True, exist_ok=True)
    with binary.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        sources = [workspace / name for name in ("go.work", "go.work.sum")]
        for module in ("runner", "shared"):
            root = workspace / "simulator" / module
            sources.extend(root.rglob("*.go"))
            sources.extend(root / name for name in ("go.mod", "go.sum"))
        digest = hashlib.sha256()
        for source in sorted(set(sources)):
            if source.is_file():
                digest.update(source.relative_to(workspace).as_posix().encode() + b"\0")
                digest.update(source.read_bytes() + b"\0")
        fingerprint = digest.hexdigest()
        stamp = binary.with_suffix(".sha256")
        if not binary.exists() or not stamp.exists() or stamp.read_text() != fingerprint:
            temporary = binary.with_suffix(".next")
            subprocess.run(["go", "build", "-ldflags=-s -w", "-o", str(temporary), "./simulator/runner"], cwd=workspace, env={**os.environ, "CGO_ENABLED": "0"}, check=True)
            os.replace(temporary, binary)
            stamp.write_text(fingerprint)
    # The lock is closed before exec, so other model instances start immediately.
    os.execv(str(binary), [str(binary), *sys.argv[1:]])


if __name__ == "__main__":
    main()
