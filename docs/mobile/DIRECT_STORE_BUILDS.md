# Direct store build path

The existing Expo project can be compiled by GitHub Actions and signed locally for TestFlight and Google Play. An Expo cloud-build account is not required for this path. Expo prebuild still generates native projects from the checked-in configuration; generated native directories remain ignored and are not edited by hand.

## Build candidates

- `iOS TestFlight device archive` generates an unsigned ARM64 iPhoneOS archive on a standard macOS runner. It verifies identity, embedded JavaScript, sensitive permissions and packaged privacy manifests, then retains the archive with source and checksum evidence for one day.
- `Android store bundle candidate` builds an ARM64 AAB on a standard Ubuntu runner. It verifies application identity, embedded JavaScript, Hermes and merged release permissions, removes the generated development signature and retains the unsigned bundle with source and checksum evidence for one day.

Both workflows support manual dispatch once available on the default branch. The preparation branch also has narrowly scoped push triggers for the workflow files. They do not use signing secrets, submit to stores, activate a testing release or deploy the website. Retrieve successful artifacts before their one-day expiry. Public repository artifacts contain application code, so never include private configuration, signing material or user data in build inputs.

## Local signing and upload

1. Verify `SHA256SUMS`, immutable source commit and mobile source tree against the reviewed candidate. Check available disk space before downloading or extracting. Reject unexpected archive paths and identity/version/platform mismatches.
2. For iOS, export the verified archive with Xcode using `method=app-store-connect`, `teamID=NVJ5UY3T2X`, the existing Apple distribution certificate and `manageAppVersionAndBuildNumber=false`. Authenticate through the existing Xcode account. Inspect the signed IPA, verify all signatures with `codesign --verify --deep --strict`, and verify its matching distribution profile, app identifier and disabled debug entitlement. Compare embedded JavaScript with the original archive and record a signed IPA checksum.
3. Upload through Xcode's App Store Connect distribution path. Keep upload logs outside source. A successful export is not a successful upload; upload success is not processing success or tester availability. Inspect the processed build in SealSend's existing TestFlight record before assigning it to the intended internal group.
4. For Android, sign the verified unsigned AAB with SealSend's protected upload keystore using `jarsigner`. Use password-file input rather than command-line secrets. Verify the JAR signature and certificate fingerprint, record the signed bundle checksum, and preserve a secure backup of the upload key before relying on it for future updates. Never use the generated Android development key for a Play upload.
5. Upload the signed AAB to SealSend's existing internal testing track. Inspect Play's actual validation and signing prompts. Do not accept new legal declarations, change protection settings, expose an external beta or publish a public release implicitly.

## Testing gates

Use the existing [device protocol](DEVICE_TESTING.md). Verify backend migrations and authenticated journeys separately from the public health/unauthorized checks. Complete dependency, privacy and reviewer-access requirements before external testing. Only record installation and native feature tests after observing the installed exact build. Store registration, source tests and compiler success do not complete these gates.
