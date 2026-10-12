# Android testing and TestFlight release packet

12 October 2026. Cameron selected Android testing and Apple TestFlight. This packet prepares those beta channels; Android assembly has completed on a hosted runner with a development key, but repaired evidence verification is pending. No store-signed binary has been uploaded and no tester has been invited.

## Candidate and authority

Draft PR: https://github.com/camster91/SealSend/pull/249. The native gateway remains off by default. Source/bundle CI is separate from native compilation, store processing, real-device verification and human validation. Complete required CI and resolve/assess the recorded dependency risks before beta exposure.

Required owner inputs: Expo account/project and build spending limit; Apple Developer team and App Store Connect app; Google Play developer account/app; confirmation of provisional `com.ashbi.sealsend`; test devices and a nominated tester group. Enter credentials through official account/CLI flows, never in chat, source or this packet. No account terms or new security permissions have been accepted.

## Build and beta distribution

A separate `Android native compilation` workflow uses a standard Ubuntu24.04 runner for this public repository, Node22 and Java21. It generates Android from the checked-in Expo configuration, assembles an ARM64 release-mode APK with the generated development key and records source/hash/bundle evidence. No store credentials, caches or APK artifacts are uploaded by this workflow. Compilation proof does not supply an installable download or Play-signed build; signed distribution and device testing retain their gates. The first execution assembled an APK, then failed its ripgrep-based evidence step. The repaired standard-library verifier also checks compiled permission declarations; its rerun is pending.

Run from `apps/mobile` after account setup, archive inspection and clean-commit verification. The existing production build profile produces store-distribution iOS output and Android AAB, suitable for the selected beta channels. The preview APK profile remains available for direct Android device installation. The simulator profile cannot be used for TestFlight.

```sh
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Record the exact source SHA and EAS build IDs, checksum/downloaded artifact, platform version/build number, signing owner and any build charges. Inspect binary permissions and privacy manifests. Smoke-test cold start and native integrations privately before enabling the reviewed beta backend. Then verify complete host journeys against fabricated beta data on actual devices before inviting people.

The `submit.beta` profile targets Android's internal track with `releaseStatus: draft`, so upload holds for review in Play Console. Select an explicit verified build ID; do not select an ambiguous latest build:

```sh
npx eas-cli@latest submit --platform android --profile beta --id VERIFIED_ANDROID_BUILD_ID
npx eas-cli@latest submit --platform ios --profile beta --id VERIFIED_IOS_BUILD_ID
```

The iOS profile deliberately has no guessed app/team identifiers; interactive account configuration is still required. iOS submission uploads to App Store Connect for TestFlight processing. Complete compliance and tester setup there. No automatic submission workflow is configured. Android draft upload is not an active testing release; finish the approved internal rollout in Play Console. External TestFlight distribution can require beta review. No public store launch is included in this testing decision.

References: [Expo submission profiles](https://docs.expo.dev/submit/eas-json/), [Android submission](https://docs.expo.dev/submit/android/), [iOS submission](https://docs.expo.dev/submit/ios/).

## Store materials

`store-metadata.json` contains a bounded draft description, platform short copy, support/privacy URLs and reviewer notes. Character limits were checked. Confirm developer identity, category, age/content ratings and actual release functionality before saving it in either store. Do not claim push notifications, offline arrivals, native billing, shared-team discovery, polls or invitation design.

Capture screenshots from the signed native builds with fabricated data: welcome, event dashboard, create/edit, published event, guest search/check-in and account controls. Browser screenshots are QA evidence, not native store screenshots. Capture iPad layouts while `supportsTablet` remains enabled. Final screenshot dimensions and declarations must match the store's current upload requirements.

A reviewer needs a dedicated host sign-in mailbox/code-access process and a published fabricated event, plus personal guest QR codes. No credentials are embedded in metadata. Privacy: https://sealsend.app/privacy. Support: https://sealsend.app/support. Confirm both links work and the web account-deletion route is discoverable before submission.

## Privacy and data-safety worksheet

This is an evidence worksheet, not a submitted declaration or legal certification. Verify the signed binaries, actual production infrastructure and vendor practices before entering store answers. Apple's [privacy guidance](https://developer.apple.com/app-store/app-privacy-details/) and Google's [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) cover third-party practices as well as app code.

| Data/function | Source evidence | Draft treatment and final verification |
| --- | --- | --- |
| Host email and account ID | OTP authentication, backend host/session records | Account-linked data for authentication/app functionality; email provider and retention must be included. |
| Event title, description, venue and time | Native create/edit sends details to the backend | Account-linked user content for app functionality. User-entered venues may be addresses; classify using actual stored content, not the absence of GPS permission. |
| Guest name, RSVP, headcount and arrival | Authenticated online attendee API | Existing host-managed guest information is read/updated; evaluate names/contact data and other user content across native and website fallback. Do not claim no personal data. |
| Session and pending draft | SecureStore; pending payload is sent when saving | Credentials stay on-device except bearer use; backend maintains sessions and events. Distinguish local-only storage from transmitted data and account identifiers. |
| Personal QR scan | Camera scan validates invitation token | No image upload in this feature; decoded token reaches the backend. Confirm binary permissions and actual traffic. Camera permission is optional. |
| Calendar and share sheet | Native OS composition | No calendar read/contact-book access requested. User explicitly chooses save/share recipients; verify platform behavior and third-party destinations. |
| Diagnostics, IP/security logs and support | Server logs/rate limits/error monitoring and support channels | Final infrastructure/vendor and retention review required; no unsupported claim that diagnostics are never collected. |
| Advertising/tracking | No advertising SDK intentionally added | Source inventory found nine privacy manifests, all parsed and none declared tracking. This does not prove complete runtime behavior; inspect aggregate signed manifests and network activity before selecting final tracking answers. |

Source inventory is preserved as `sdk-privacy-source-inventory.json` in the task output folder. It includes required-reason API declarations; review the aggregate manifest from the actual archive, not source files alone. No native payment details, contacts upload, microphone recording, GPS collection or photo upload is implemented. Reassess when scope or SDKs change.

## Device and human acceptance

Use at least one physical iOS and Android device. For each record artifact ID, OS, device, tester, observed outcome and defect: OTP and stale session; event creation/edit/publish/archive; ambiguous-save recovery without duplication; personal QR and denied camera; search/check-in/undo; offline recovery; share/calendar save and cancel; rotations; large text and VoiceOver/TalkBack; sign-out and account deletion/support. A source/bundle test is not a substitute.

Then run the existing seven-person study in RESEARCH.md with fabricated guests. Ask participants to complete tasks without coaching; record assistance, confusion, lost/duplicate mutations, ownership leaks and accessibility failures. Critical tasks must complete and material defects be repaired before wider rollout. Recruitment waits for a nominated group and send-time authorization; no participants or results have been invented.

## Deletion and recovery evidence

Expanded isolated PostgreSQL + actual Next HTTP checks pass 58 assertions, including processor authentication, due-account removal, event/session/create-key cleanup, upload directory removal, preservation of cancelled/future requests, active-paid-account blocking and completion after billing cancellation. The fixtures also verify successor promotion/shared-event inheritance, co-owner inheritance and personal-workspace rehoming for another host when an orphan workspace is removed. These prove local controlled behavior. They do not establish production scheduling, vendor-data erasure, billing-provider cancellation or workspace ownership-handover coverage. Verify the production scheduler and operational retention obligations before store claims.

Rollback: disable the mobile gateway and pause tester distribution; retain server mutation records and existing user data. Do not delete credentials or drop the deduplication table as a shortcut. Existing website invitations remain the guest fallback.
