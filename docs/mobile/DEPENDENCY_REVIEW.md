# Mobile dependency release review

Checked 11 October 2026 on local candidate daa251e. This is a fresh npm registry/advisory check, not release approval or a claim of exploitability.

`npm audit --prefix apps/mobile --json` reports 22 affected package entries: 19 high and 3 moderate, no critical. These aggregate three underlying advisories through their dependent packages; they are not 22 independently discovered defects. Full audit and npm dependency paths are retained in the task output folder.

| Underlying package | Installed path | Current disposition |
| --- | --- | --- |
| braces 3.0.3 | expo → @expo/metro → metro-file-map → micromatch | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects versions through 3.0.3; advisory lists no patched version and current npm latest is 3.0.3. Used by build tooling. Do not expose Metro to untrusted networks/pattern input; upstream remediation remains required. |
| node-forge 1.4.0 | expo → @expo/cli and @expo/code-signing-certificates | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) affects versions through 1.4.0; current npm latest remains 1.4.0. Tooling certificate/signature handling needs upstream resolution and release-time review before enabling remote signing/update workflows. No OTA or remote signing is configured. |
| decode-uri-component 0.2.2 | expo-router 57.0.25 → query-string 7.1.3 | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) affects versions through 0.4.2. Router is a runtime dependency. Existing incoming-link filtering is a partial boundary, not a dependency repair or proof of complete protection. Prior direct override to patched 0.5 failed CommonJS/ESM compatibility; do not repeat it without compatible consumer changes. |

The npm automated fix proposes Expo44 / React Native0.72 downgrades and Router58 for parts of this tree. These do not form a validated SDK57 dependency set. Current Router57.0.25 still depends on query-string7.1.3. No forced fix, SDK downgrade, audit suppression or unverified vendor patch was applied.

Resume with a compatible patched upstream release, or a separately tested bounded patch in an isolated branch that covers the vulnerable algorithm, Router link parsing, bundle exports and native behavior. Re-run the full dependency audit, source checks and device matrix. Security review must distinguish build-time tooling from runtime navigation and assess concrete input reachability; this document does not waive the external beta gate.
