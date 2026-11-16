"""Exercise the development launcher with real Go builds, including shared edits."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class DevRunnerTest(unittest.TestCase):
    def test_rebuilds_shared_changes_once_and_preserves_arguments(self):
        launcher = Path(__file__).resolve().parents[1] / "dev-runner.py"
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            runner = workspace / "simulator" / "runner"
            shared = workspace / "simulator" / "shared"
            runner.mkdir(parents=True)
            shared.mkdir(parents=True)
            (workspace / "go.mod").write_text("module example\n\ngo 1.26.2\n")
            (runner / "main.go").write_text('package main\nimport ("fmt"; "os"; "example/simulator/shared")\nfunc main() { fmt.Print(shared.Value, "|", os.Args[1]) }\n')
            source = shared / "value.go"
            source.write_text('package shared\nconst Value = "first"\n')
            binary = workspace / "build" / "runner"
            env = {**os.environ, "GOWORK": "off", "DEVSFORGE_DEV_WORKSPACE": str(workspace), "DEVSFORGE_DEV_RUNNER_BINARY": str(binary)}

            def launch():
                return subprocess.check_output([sys.executable, str(launcher), "model-argument"], env=env, text=True, timeout=60)

            self.assertEqual(launch(), "first|model-argument")
            first_build = binary.stat().st_mtime_ns
            self.assertEqual(launch(), "first|model-argument")
            self.assertEqual(binary.stat().st_mtime_ns, first_build)
            source.write_text('package shared\nconst Value = "updated-shared-reader"\n')
            with ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(list(pool.map(lambda _: launch(), range(2))), ["updated-shared-reader|model-argument"] * 2)
            self.assertNotEqual(binary.stat().st_mtime_ns, first_build)
            updated_build = binary.stat().st_mtime_ns
            self.assertEqual(launch(), "updated-shared-reader|model-argument")
            self.assertEqual(binary.stat().st_mtime_ns, updated_build)


if __name__ == "__main__":
    unittest.main()
