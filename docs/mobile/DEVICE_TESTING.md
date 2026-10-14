# Native beta testing

Prepared 13 October 2026 for Google Play internal testing and Apple TestFlight. This is a test protocol, not completed device evidence. Start only after a signed build is installed and the reviewed native backend is available. Compilation-only CI does not provide an installable store build.

## Release record

Record source commit, platform, store build ID, version/build number, signing owner, device model/OS, tester and date for every test session. Use the exact verified EAS build IDs for submission; do not select an ambiguous latest build. Record the checksum of each downloaded artifact and keep signing secrets outside this record. Confirm the same source is tested on both platforms.

Use one physical Android device and one physical iPhone. Include iPad while tablet support is enabled. The app supports iOS16.4+, but calendar composition requires iOS17+. Test both normal and large text, portrait/landscape and VoiceOver/TalkBack. Simulator compilation and browser fixture results cannot fill these device results.

## Setup and installation

1. Confirm the registered `com.ashbi.sealsend` identifiers, Expo project, Apple Developer team/App Store Connect app and Google Play app. Confirm build costs before queuing hosted signed builds.
2. Verify the reviewed backend migration, gateway activation, session/auth configuration and deletion scheduling. Release builds accept only `https://sealsend.app`; they cannot be redirected to an arbitrary beta hostname. A 404 from `/api/mobile/v1/me` means the native gateway is unavailable, not a successful authentication check. Check the approved deployed gateway returns the expected unauthorized response before functional testing.
3. Build store artifacts from the clean reviewed commit with the production EAS profile. Check binary permissions/privacy manifests before upload. Android requires the owner-signed AAB; the CI development-key APK is not a Play release. TestFlight requires a signed device build; the unsigned simulator app cannot be uploaded there.
4. Upload the exact verified artifacts. Android `submit.beta` creates an internal-track draft; complete the internal rollout in Play Console after review. For iOS, wait for App Store Connect processing and required compliance/review before selecting the build for TestFlight.
5. After authorized tester enrollment, Android testers accept the internal-testing opt-in using the enrolled Google account and install through Play. Apple testers install TestFlight and accept the appropriate invitation using their enrolled account. Verify the installed version/build number before recording results.

Use a dedicated owner-controlled QA mailbox for OTP, fabricated event details and fabricated guests. Do not recruit or message people, send real guest invitations, purchase plans or process payments as part of this protocol. Stop if the app points to an unexpected origin or exposes another host's data.

## Device cases

| ID | Action | Required outcome |
| --- | --- | --- |
| N01 | Install and cold launch; background and reopen | Welcome loads without crash or private data before sign-in. |
| N02 | Invalid email; valid QA email; wrong/expired code; correct code | Invalid input is explained, wrong codes fail, successful sign-in reaches the host dashboard. |
| N03 | Restart with valid session; expire/revoke session | Valid session restores; stale session clears private state and allows sign-in. |
| N04 | Temporarily disconnect while loading events; reconnect and retry | Clear error and explicit retry; failed load is never represented as an empty account. |
| N05 | Create one fabricated event; edit details/date; publish; archive | Correct details and status persist after refresh/restart. Invalid publication gives actionable feedback. |
| N06 | Disconnect during save; restart; inspect events and recover original pending save | Outcome is explained; retry produces at most one event. Do not submit a changed payload under the original retry key. |
| N07 | Sign out with an interrupted draft; sign in as a second QA host | No previous host's draft, event or guest details appear. |
| N08 | Search fabricated guests; no-match search; switch events | Correct guests/counts; no stale search or other event's attendees. |
| N09 | Check in and undo; tap repeatedly; disconnect during action and refresh | At most one confirmed state change; uncertain result blocks further local actions until refresh. |
| N10 | Deny camera; use guest search; later grant camera | Search remains usable; scanner permission can be recovered without a crash. |
| N11 | Scan a personal guest QR; wrong-event QR; public invitation; malformed QR | Matching guest can be checked in; unrelated/missing/invalid personal tokens are rejected without guest data leakage. |
| N12 | Open share sheet; cancel; share to a controlled destination | Correct invitation link, cancellation safe, no automatic guest message. |
| N13 | Open calendar composer; cancel; explicitly save | Correct date/time/venue; cancellation changes nothing. On iOS16.4, feature limitation is explained and other actions work. |
| N14 | Sign out while offline; use any cleanup retry | Private UI clears immediately; unconfirmed revocation/storage failure is explained. Reopen does not silently show a signed-out host's data. |
| N15 | Open privacy/support; request deletion twice; cancel deletion | Links load, original scheduled date remains stable, cancellation is reflected after refresh. Final due deletion is an operational test in the approved QA environment, never a disposable action on a real account. |
| N16 | Large text, screen reader, keyboard, rotation and tablet layout | Controls remain reachable/labeled; focus and errors make sense; no clipped primary actions or unintended scroll traps. |
| N17 | Upgrade to the next approved beta build | Compatible session/recovery state remains safe; installed version is correct. Run after a second signed build exists. |

For every case record Pass/Fail/Blocked/Not run, steps, observed result, device/build identity and evidence. A blocked or unrun case is not a pass. Use redacted screenshots or screen recordings; exclude OTPs, bearer tokens, personal guest tokens and real names. Log a reproducible defect in the existing GitHub PR/issue, repair material failures and repeat the affected cases.

## Exit criteria

Both platforms must complete N01–N16 with no material unresolved defect before widening the pilot. Run N17 when an upgrade build exists. Source CI, dependency risk review, signed-binary privacy checks and operational backend checks also remain required. Then use the human study in RESEARCH.md; device checks do not establish customer validation. No successful install, store acceptance or tester result is claimed by this file.

References: [Expo build setup](https://docs.expo.dev/build/setup/), [Android submission](https://docs.expo.dev/submit/android/), [iOS submission](https://docs.expo.dev/submit/ios/). The existing BETA_RELEASE.md packet contains build and submission commands and privacy preparation.
