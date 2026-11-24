import json
import plistlib
import tempfile
import unittest
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location


ROOT = Path(__file__).parents[3]
SPEC = spec_from_file_location("verify_ios_privacy_manifest", ROOT / "scripts/mobile/verify-ios-privacy-manifest.py")
VERIFY = module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(VERIFY)


class IOSPrivacyManifestTest(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "apps/mobile/app.json").read_text(encoding="utf-8"))
        self.privacy = self.config["expo"]["ios"]["privacyManifests"]

    def emitted_manifest(self, *, data_types=None, reasons=None):
        manifest = {
            "NSPrivacyTracking": self.privacy["NSPrivacyTracking"],
            "NSPrivacyTrackingDomains": self.privacy["NSPrivacyTrackingDomains"],
            "NSPrivacyCollectedDataTypes": self.privacy["NSPrivacyCollectedDataTypes"] if data_types is None else data_types,
            "NSPrivacyAccessedAPITypes": self.privacy["NSPrivacyAccessedAPITypes"] if reasons is None else reasons,
        }
        handle = tempfile.NamedTemporaryFile(suffix=".xcprivacy", delete=False)
        handle.close()
        path = Path(handle.name)
        with path.open("wb") as file:
            plistlib.dump(manifest, file)
        self.addCleanup(path.unlink)
        return path

    def test_emitted_root_manifest_matches_source_and_required_reasons(self):
        manifest = self.emitted_manifest()
        result = VERIFY.verify(ROOT / "apps/mobile/app.json", manifest)
        self.assertEqual(result["iosBuildNumber"], "4")
        self.assertEqual(len(result["collectedDataTypes"]), 6)
        self.assertEqual(len(result["requiredReasonAPIs"]), 3)

    def test_empty_sdk_style_manifest_cannot_pass_as_root_manifest(self):
        manifest = self.emitted_manifest(data_types=[])
        with self.assertRaisesRegex(AssertionError, "data declarations"):
            VERIFY.verify(ROOT / "apps/mobile/app.json", manifest)

    def test_missing_required_reason_is_rejected(self):
        reasons = self.privacy["NSPrivacyAccessedAPITypes"][:-1]
        manifest = self.emitted_manifest(reasons=reasons)
        with self.assertRaisesRegex(AssertionError, "required-reason"):
            VERIFY.verify(ROOT / "apps/mobile/app.json", manifest)


if __name__ == "__main__":
    unittest.main()
