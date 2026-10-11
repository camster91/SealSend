# Native candidate verification and release gates

Date: 11 October 2026. Branch: `feat/native-mobile-apps`, based on `efff91bdd98703e18bef9263801ede5cf38c96c6`. This is an implemented local candidate. No iOS/Android binary, signed package, TestFlight/Play distribution, production mobile gateway or real-customer validation is claimed.

## What exists

Shared Expo SDK57/React Native app with Expo Router routes, native labeled inputs/date-time picker, safe areas, keyboard-aware scrolling, email OTP host auth, owned-event dashboard, create/edit/publish/archive, native sharing, online guest search and check-in/undo, optional personal-QR scanner, calendar composer, session revocation/local sign-out, support/privacy links, account-deletion initiation/cancellation and guest browser RSVP fallback.

Camera/check-in uses `/e/<selected event slug>?t=<personal token>`; it does not mistake the public event QR for a personal guest identifier. Incoming native routes are bounded and allowlisted; universal/verified app links are not configured or claimed. Calendar composer is available on Android and iOS17+, avoiding broader calendar access on iOS16.4. Users on older supported iOS retain other app functions. No microphone, contacts, shared-storage or calendar read/write permissions are requested; generated Android manifests contain explicit removal directives. iOS camera is the only usage permission string generated for these features.

The default-disabled `/api/mobile/v1` gateway validates revocable seven-day database sessions. Supported operations are explicitly allowlisted; browser APIs retain cookies and the existing CSRF protection. OTP consumption is atomic. Missing/deleted accounts fail closed. Event ownership, roles, quotas, publication validation and check-in semantics remain enforced by shared business handlers.

Create uses a client UUID stored with the pending payload in device SecureStore, in Unicode-safe items smaller than 2KB. A host-scoped server mutation table stores the request hash and resulting event in the same transaction under the existing host lock. A lost response or app restart retries the original key and returns the same event; different payloads conflict. Keys survive event deletion as tombstones, preventing resurrection. Temporary encrypted draft records are removed after confirmation/sign-out. Guests/attendee lists are never cached on disk. Web preview storage is memory only.

Unknown check-in results block further local changes until a successful refresh. Backend attendee locks suppress duplicate audit/webhook effects and preserve original arrival timestamps for repeated desired states. Offline sign-out attempts credential and draft removal independently, always clears private UI, and distinguishes unconfirmed server revocation. If the OS refuses storage removal, the app warns and offers a cleanup retry; actual keychain failure/lock behavior needs device testing. Repeated pending deletion requests keep the original seven-day date; the deletion processor itself still needs release-time proof.

## Evidence

| Check | Evidence/status |
| --- | --- |
| Mobile TypeScript | Pass, independent TS6/React19.2 tree |
| Mobile lint | Pass, separate TypeScript and hooks rules, zero warnings |
| Mobile tests | 19 passing: origin/link validation, source-aware arrival commands, fetch failures, no auto retry, credentials/redirect handling, Unicode-safe draft recovery across store re-instantiation and failed local writes |
| Gateway unit tests | 3 passing within root suite: allowlist, bearer format, concurrent async identity isolation |
| Isolated PostgreSQL + actual Next HTTP | 39 assertions pass: native vs cookie auth, OTP single use/concurrent consumption, roles/cross-owner access, expiry/deletion/orphan identity, create retry/conflict/quota, edit/publish/archive, arrival retries, deletion-date stability, logout and CSRF |
| iOS, Android, web JS exports | Pass; Hermes output for both native platforms. These are bundles, not signed installable apps. |
| Native prebuild | Pass, iOS/Android project generation and permission configuration inspected. Native compilation not performed. |
| Web root checks | Typecheck/lint and full 609-test suite checked; see final run logs. The check-in source assertion was updated for preserving original attribution, with HTTP persistence/effect checks added. |
| Next production build | Attempted, failed with `ENOSPC`/StorageFull, not a code-validation pass. Must rerun with space/CI before merge. |
| Rendered browser preview | Welcome/sign-in inspected at 390×844; invalid email keeps submit disabled. Final Router welcome and sign-in rendering re-checked at 390×844; screenshot at `outputs/sealsend-mobile/final-welcome-390.png`. A preview-server directory replacement was corrected before the final check. No native-device UI claim. |
| Independent review | Two substantive read-only reviews; material recovery, calendar, navigation and permissions findings repaired. Final source re-review confirmed the idempotency design; conditional sign-out cleanup finding repaired with independent cleanup attempts and failure-injection tests. Focused final independent confirmation passed 19 tests, typecheck/lint and found no new P1 issue in that repair. |
| CI definition | New independent Node22 native source/bundle job prepared. Remote CI not run until branch is pushed. Audit artifact is informational; a green job does not mean release approval. |

Final command logs and the dependency audit are preserved in the task output folder `/Users/Cameron/Documents/Codex/2026-10-08/re/outputs/sealsend-mobile/`. HTTP tests use an isolated loopback PostgreSQL cluster and fabricated `.example.test` accounts. They do not send emails, access production data or accept store terms.

## Outstanding gates and owners

| Priority / gate | Owner | Resume condition |
| --- | --- | --- |
| Native binary builds and full Next build | Cameron / build environment | Free approximately 10GB for a safe local build, or explicitly select/authorize Expo cloud build/account/cost. Machine repeatedly ran out of disk during compilation; only this task's reconstructible artifacts/incomplete install were cleared. |
| Upstream dependency advisories | Engineering / dependency maintainers | Review current npm audit. At research time braces and node-forge had no published patched registry version; decode-uri-component0.5 fixes its advisory but is ESM and breaks the current query-string7 consumer when overridden directly. Do not force a downgrade to an incompatible Expo SDK or claim audit clean. Native intent filtering reduces arbitrary input but is not proof that the upstream advisory is fixed. Resolve/assess before external beta. |
| Reviewed backend beta release | Cameron / engineering | Green full web build/CI and reviewed additive migration; approve enabling `ENABLE_NATIVE_MOBILE_API=true` only after native testing. Gateway remains off by default. |
| Native platform QA | Engineering + Cameron/devices | Install compiled app on simulator/emulator and physical iOS/Android; inspect real keyboard, font scaling, VoiceOver/TalkBack, permissions, share/calendar cancel, rotations, cold starts, offline recovery and repeated actions. |
| Store ownership/signing | Cameron | Verify bundle/package IDs, Apple/Play/Expo account ownership, signing profile/keystore, certificates and account terms. Provisional identifier is `com.ashbi.sealsend`; no credentials created or exposed. |
| Privacy, billing and deletion | Cameron / engineering | Complete store privacy/data-safety forms from actual SDK manifests; prove scheduled deletion removes data, check web deletion pathway and paid-account cancellation policy. No native purchases implemented. |
| Human pilot and support | Cameron + pilot participants | Approved recruitment/invitations and mixed-device task testing; no recruited-user validation exists yet. |
| Store distribution | Cameron / Apple / Google | Signed artifacts, screenshots, support/privacy/review access, approved submission, processing/review acceptance and phased monitoring. |

## Release and recovery sequence

1. Review source changes and run full web/native CI. Do not merge red required checks. Do not expose the local preview externally.
2. Back up the database and apply the additive `scripts/migrations/native-mobile-event-mutations.sql` only in the approved beta backend environment. The base schema includes the same table for clean installs/local tests. No existing table/data is rewritten by this migration.
3. Build and install native artifacts; execute the device matrix and representative human study from RESEARCH.md. Fix material failures before inviting users.
4. After approval, activate the versioned gateway and verify host auth, stale/revoked session, create replay, cross-owner denial and QR arrival against fabricated beta data. Preserve old web contracts.
5. Prepare store metadata/privacy and obtain signing/submission authorization. Use staged distribution and monitor auth failures, create collisions and check-in error rates. No metric baseline has been collected for native yet.

Rollback: disable `ENABLE_NATIVE_MOBILE_API` and pause distribution; preserve the mutation table and event records for delayed retries and existing installs. Revert code through a reviewed Git change rather than deleting user data. Never drop the deduplication table during a live rollback. Unavailable gateway returns a clear beta-not-available error; the website remains the guest fallback. Retain the prior mobile/API version until installed clients are intentionally retired.

## Deliberate v0.1 limits

No full web parity: native billing, account export, bulk import/sends, photo/social moderation, polls, shared-team event discovery, invitation designer, push notifications and offline arrivals remain later work. No automatic guest messages or contacts upload. Keep marketing/store claims within this scope. The source review threshold does not waive signed builds, device tests or customer validation.
