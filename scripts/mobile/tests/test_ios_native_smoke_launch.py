import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "ios-native-smoke.sh"


def extract_functions():
    source = SCRIPT.read_text(encoding="utf-8")
    run_start = source.index("run_bounded() {")
    run_end = source.index("\n\nrecord_pid_probe()", run_start)
    launch_start = source.index("launch_app() {")
    launch_end = source.index("\n\ncapture_raw_failure_screen()", launch_start)
    return source[run_start:run_end], source[launch_start:launch_end]


class IOSNativeSmokeLaunchTests(unittest.TestCase):
    def run_launch(self, mode):
        run_bounded, launch_app = extract_functions()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            fake_xcrun = fake_bin / "xcrun"
            fake_xcrun.write_text(
                "#!/bin/sh\n"
                "if [ \"$1 $2\" != \"simctl launch\" ]; then exit 99; fi\n"
                "case \"$FAKE_LAUNCH_MODE\" in\n"
                "  success) printf '%s\\n' 'com.ashbi.sealsend: 1234' ;;\n"
                "  wrong) printf '%s\\n' 'com.other.app: 1234' ;;\n"
                "  missing) printf '%s\\n' 'simctl launch completed' ;;\n"
                "  timeout) sleep 5 ;;\n"
                "esac\n",
                encoding="utf-8",
            )
            fake_xcrun.chmod(0o755)
            output_file = root / "launch.log"
            wrapper = root / "run-launch.sh"
            wrapper.write_text(
                "#!/bin/bash\n"
                "set -euo pipefail\n"
                f"OUTPUT_ROOT={str(root)!r}\n"
                "LAUNCH_TIMEOUT_SECONDS=1\n"
                "LAUNCHED_APP_PID=\"\"\n"
                f"{run_bounded}\n"
                f"{launch_app}\n"
                "set +e\n"
                f"launch_app SIMULATOR com.ashbi.sealsend {str(output_file)!r}\n"
                "status=$?\n"
                "set -e\n"
                "printf 'status=%s\\nappPid=%s\\n' \"$status\" \"$LAUNCHED_APP_PID\"\n"
                "cat \"$1\"\n",
                encoding="utf-8",
            )
            wrapper.chmod(0o755)
            env = os.environ.copy()
            env.update({"PATH": f"{fake_bin}:{env['PATH']}", "FAKE_LAUNCH_MODE": mode})
            return subprocess.run(
                ["bash", str(wrapper), str(output_file)],
                env=env,
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )

    def test_finite_launch_accepts_exact_bundle_acknowledgement(self):
        result = self.run_launch("success")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("status=0", result.stdout)
        self.assertIn("appPid=1234", result.stdout)
        self.assertIn("pidEvidence=exact bundle launch acknowledgement after finite simctl launch", result.stdout)

    def test_wrong_or_missing_bundle_acknowledgement_is_rejected(self):
        for mode in ("wrong", "missing"):
            with self.subTest(mode=mode):
                result = self.run_launch(mode)
                self.assertIn("status=1", result.stdout)
                self.assertIn("pidEvidence=missing exact bundle launch acknowledgement", result.stdout)

    def test_finite_launch_timeout_is_retained(self):
        result = self.run_launch("timeout")
        self.assertIn("status=124", result.stdout)
        self.assertIn("launchStatus=124", result.stdout)


if __name__ == "__main__":
    unittest.main()
