# Existing testing-account registration

Verified 13 October 2026. Reuse Cameron's existing Apple and Google accounts. These are identity records, not signing secrets or proof of an uploaded beta.

| Field | Verified record |
| --- | --- |
| Apple owner / team | Cameron Ashley / `NVJ5UY3T2X` |
| Explicit Apple bundle ID | `com.ashbi.sealsend`, registered and observed in Identifiers |
| App Store Connect name / app ID | SealSend / `6822377285` |
| SKU / language | `sealsend-ios` / English (Canada), `en-CA` |
| Apple state | Created; initial store version 1.0 is Prepare for Submission. Source version remains 0.1.0; align the store draft before public submission. |
| Google owner | Ashbi Design, organization account `4743214850621961541`, authenticated inventory observed earlier on 13 October |
| Android package | `com.ashbi.sealsend` in source; no SealSend record appeared in the observed five-app Play inventory |

The created record was verified at [App Store Connect](https://appstoreconnect.apple.com/apps/6822377285/distribution/ios/version/inflight). Its [TestFlight link](https://appstoreconnect.apple.com/teams/7b13498f-be1f-4198-8348-7f218758a85c/apps/6822377285/testflight) was visible; the browser connection disappeared before its contents could be inspected. No build upload, beta-review submission, invitation, privacy declaration or public release was performed. No optional App ID capability was enabled. Apple's default In-App Purchase capability does not mean SealSend implements purchases.

`submit.beta.ios` in `apps/mobile/eas.json` now targets the verified app/team, SKU and language, following the [EAS Submit schema](https://docs.expo.dev/eas/json/). It does not authenticate Expo/Apple, create signing credentials, queue a paid build or submit a binary. Android remains an internal-track draft profile; no automatic upload is configured.

## Resume

1. Restore Chrome control; inspect the existing SealSend TestFlight record and prepare SealSend under Ashbi Design in Google Play. Read the actual Play creation declarations; obtain action-time confirmation before accepting a legally binding agreement.
2. Prepare matching distribution signing using protected existing identities. Keep keys and profiles out of source/chat; do not export private keys to a hosted runner without explicit authority.
3. Build signed store artifacts from a clean reviewed commit using the approved build path; inspect identity, signatures, permissions and privacy manifests. EAS needs its account/project and approved build cost. Current local free space is approximately 2.4GB, so a full local archive is not safe yet.
4. Complete the backend, dependency/privacy and operational gates in READINESS.md, exact-build uploads and DEVICE_TESTING.md. Store registration does not make the current 404 native gateway functional or establish physical-device proof.

Android registration and further TestFlight configuration remain unperformed. The user's unrelated BETA_RELEASE.md edit is preserved.
