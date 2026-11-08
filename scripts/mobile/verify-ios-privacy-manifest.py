#!/usr/bin/env python3
"""Verify SealSend's emitted iOS privacy manifest against Expo app config.

The root app manifest is distinct from the SDK manifests generated alongside it.
This check intentionally compares the CNG-emitted root file to the checked-in
source configuration so an empty SDK manifest cannot make the app pass by
accident. It is safe to run after ``expo prebuild`` and does not modify files.
"""

from __future__ import annotations

import argparse
import json
import plistlib
from pathlib import Path
from typing import Any


EXPECTED_BUILD = "4"
EXPECTED_VERSION = "0.1.0"
EXPECTED_ANDROID_VERSION_CODE = 2
EXPECTED_DATA_TYPES = [
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
    },
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
    },
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
    },
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            "NSPrivacyCollectedDataTypePurposeAnalytics",
        ],
    },
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeProductInteraction",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAnalytics"],
    },
    {
        "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherDiagnosticData",
        "NSPrivacyCollectedDataTypeLinked": True,
        "NSPrivacyCollectedDataTypeTracking": False,
        "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
    },
]
EXPECTED_REASONS = {
    "NSPrivacyAccessedAPICategoryUserDefaults": ["CA92.1"],
    "NSPrivacyAccessedAPICategoryFileTimestamp": ["C617.1"],
    "NSPrivacyAccessedAPICategorySystemBootTime": ["35F9.1"],
}


def _canonical_data_types(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise AssertionError("NSPrivacyCollectedDataTypes must be an array")
    result: list[dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict):
            raise AssertionError("every collected data declaration must be a dictionary")
        result.append({key: entry[key] for key in sorted(entry)})
    return sorted(result, key=lambda entry: entry["NSPrivacyCollectedDataType"])


def verify(config_path: Path, emitted_manifest_path: Path) -> dict[str, Any]:
    with config_path.open(encoding="utf-8") as file:
        config = json.load(file)["expo"]
    privacy = config["ios"]["privacyManifests"]

    assert config["version"] == EXPECTED_VERSION, "unexpected app version"
    assert config["ios"]["buildNumber"] == EXPECTED_BUILD, "unexpected iOS build number"
    assert config["android"]["versionCode"] == EXPECTED_ANDROID_VERSION_CODE, "Android versionCode changed"
    assert privacy["NSPrivacyTracking"] is False, "tracking must be disabled"
    assert privacy["NSPrivacyTrackingDomains"] == [], "tracking domains must stay empty"
    assert _canonical_data_types(privacy["NSPrivacyCollectedDataTypes"]) == _canonical_data_types(
        EXPECTED_DATA_TYPES
    ), "app.json data declarations changed"
    source_reasons = {
        entry.get("NSPrivacyAccessedAPIType"): entry.get("NSPrivacyAccessedAPITypeReasons")
        for entry in privacy.get("NSPrivacyAccessedAPITypes", [])
    }
    assert source_reasons == EXPECTED_REASONS, "app.json required-reason API declarations changed"

    with emitted_manifest_path.open("rb") as file:
        emitted = plistlib.load(file)

    assert emitted.get("NSPrivacyTracking") is False, "emitted root manifest tracking mismatch"
    assert emitted.get("NSPrivacyTrackingDomains") == [], "emitted root tracking domains mismatch"
    assert _canonical_data_types(emitted.get("NSPrivacyCollectedDataTypes")) == _canonical_data_types(
        privacy["NSPrivacyCollectedDataTypes"]
    ), "emitted root data declarations do not match app.json"

    emitted_reasons = {
        entry.get("NSPrivacyAccessedAPIType"): entry.get("NSPrivacyAccessedAPITypeReasons")
        for entry in emitted.get("NSPrivacyAccessedAPITypes", [])
    }
    assert emitted_reasons == EXPECTED_REASONS, "emitted required-reason API declarations changed"

    return {
        "config": str(config_path),
        "emittedManifest": str(emitted_manifest_path),
        "version": config["version"],
        "iosBuildNumber": config["ios"]["buildNumber"],
        "androidVersionCode": config["android"]["versionCode"],
        "collectedDataTypes": [
            entry["NSPrivacyCollectedDataType"] for entry in _canonical_data_types(privacy["NSPrivacyCollectedDataTypes"])
        ],
        "requiredReasonAPIs": sorted(EXPECTED_REASONS),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("apps/mobile/app.json"))
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.config, args.manifest), indent=2))


if __name__ == "__main__":
    main()
