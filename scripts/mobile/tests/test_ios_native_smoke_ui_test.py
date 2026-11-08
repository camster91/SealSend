import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "run-sealsend-ui-test.sh"


class IOSNativeSmokeUITestRunnerTests(unittest.TestCase):
    def run_runner(self, xcodebuild_output: str):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            args_file = root / "xcodebuild-args.txt"
            output_file = root / "xcodebuild-output.txt"
            output_file.write_text(xcodebuild_output, encoding="utf-8")
            fake_xcodebuild = fake_bin / "xcodebuild"
            fake_xcodebuild.write_text(
                "#!/bin/sh\n"
                "printf '%s\\n' \"$@\" > \"$FAKE_XCODEBUILD_ARGS\"\n"
                "cat \"$FAKE_XCODEBUILD_OUTPUT\"\n"
                "exit 0\n",
                encoding="utf-8",
            )
            fake_xcodebuild.chmod(0o755)
            output_root = root / "output"
            runner_temp = root / "runner-temp"
            env = os.environ.copy()
            env.update(
                {
                    "FAKE_XCODEBUILD_ARGS": str(args_file),
                    "FAKE_XCODEBUILD_OUTPUT": str(output_file),
                    "HARNESS_ROOT": str(SCRIPT.parents[2]),
                    "UI_TEST_OUTPUT_ROOT": str(output_root),
                    "RUNNER_TEMP": str(runner_temp),
                    "UI_TEST_DEVICE_UDID": "SIMULATOR-TEST",
                    "UI_TEST_CASE": "testLaunchesInForeground",
                    "PATH": f"{fake_bin}:{env['PATH']}",
                }
            )
            result = subprocess.run(
                ["bash", str(SCRIPT)],
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            args = args_file.read_text(encoding="utf-8").splitlines() if args_file.exists() else []
            failure = (
                (output_root / "test-execution-failure.txt").read_text(encoding="utf-8")
                if (output_root / "test-execution-failure.txt").exists()
                else ""
            )
            result_file_exists = (output_root / "result.txt").exists()
            return result, args, failure, result_file_exists

    def test_invokes_xcodebuild_and_accepts_the_named_passing_test(self):
        output = (
            "Test Case '-[SealSendSmokeUITests.SealSendSmokeUITests "
            "testLaunchesInForeground]' started.\n"
            "Test Case '-[SealSendSmokeUITests.SealSendSmokeUITests "
            "testLaunchesInForeground]' passed (0.001 seconds).\n"
            "\\t Executed 1 test, with 0 failures (0 unexpected) in 0.001 seconds\n"
        )
        result, args, _, result_file_exists = self.run_runner(output)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(args[0], "test")
        self.assertIn("-project", args)
        self.assertIn("-only-testing:SealSendSmokeUITests/SealSendSmokeUITests/testLaunchesInForeground", args)
        self.assertTrue(result_file_exists)

    def test_rejects_zero_tests_even_when_xcodebuild_exits_zero(self):
        output = (
            "Test Suite 'Selected tests' passed at 2026-11-08 00:00:00.000.\n"
            "\\t Executed 0 tests, with 0 failures (0 unexpected) in 0.000 seconds\n"
        )
        result, _, failure, result_file_exists = self.run_runner(output)

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(result_file_exists)
        self.assertIn("started=0", failure)
        self.assertIn("passed=0", failure)


if __name__ == "__main__":
    unittest.main()
