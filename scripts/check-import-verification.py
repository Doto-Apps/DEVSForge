"""Real import -> backend manifest -> coordinator -> runner verification (no DB writes, no LLM)."""
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def verify(package):
    program = "import json,sys,verification; p=json.load(sys.stdin); print(json.dumps(verification.simulate(p,100,p['roots'][0],'verification-check')))"
    result = subprocess.run(["docker", "exec", "-i", "devsforge-importer-1", "python", "-c", program],
                            input=json.dumps(package), capture_output=True, text=True, timeout=120, check=True)
    return json.loads(result.stdout)


def main():
    code = (ROOT / "simulator/runner/integrations/devsimpy-python/templates/atomic.tmpl").read_text().replace("{{.Name}}", "ImportProbe")
    package = {"version": "1", "roots": ["probe"], "models": [{"id": "probe", "name": "ImportProbe", "type": "atomic", "language": "python", "framework": "DEVSimPy", "integrationId": "devsimpy-python", "integrationVersion": "1.0.0", "code": code, "ports": [{"name": "out", "type": "out"}], "parameters": [], "components": [], "connections": []}]}
    report = verify(package)
    assert report["status"] == "completed", report
    print("PASS: native PyPDEVS draft compiled and simulated through the import verification endpoint")
    package["models"][0]["code"] = code + "\nraise RuntimeError('verification-deliberate-failure')\n"
    report = verify(package)
    assert report["status"] == "failed", report
    assert "verification-deliberate-failure" in report.get("logs", ""), report
    print("PASS: real execution failure returned to the orchestrator with source diagnostics")
    package["models"][0].update(name="LegacyMS4", language="java", framework="MS4 Me", integrationId="ms4me-java", code="import com.ms4systems.devs.core.model.impl.AtomicModelImpl; public class LegacyMS4 extends PhaseAtomic {}")
    report = verify(package)
    assert report["status"] == "blocked" and "API variant" in report["error"], report
    print("PASS: legacy MS4 API mismatch blocked before execution")
    if "--timeout" in sys.argv:
        slow = code.replace('return {"phase": "passive", "sigma": INFINITY}', 'import time\n        time.sleep(2)\n        return {"phase": "active", "sigma": 1.0}')
        package["models"][0].update(name="ImportProbe", language="python", framework="DEVSimPy", integrationId="devsimpy-python", code=slow)
        started = time.monotonic()
        report = verify(package)
        elapsed = time.monotonic() - started
        assert report["status"] == "timeout", report
        assert 85 < elapsed < 110, elapsed
        print("PASS: a real blocked runner was stopped at the wall-clock deadline, with a timeout report")


if __name__ == "__main__":
    main()
