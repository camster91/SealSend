# Native candidate verification and release gates

Date: 11 October 2026. Branch: `feat/native-mobile-apps`, based on `efff91bdd98703e18bef9263801ede5cf38c96c6`. This is an implemented local candidate. No store-signed package, TestFlight/Play distribution, production mobile gateway or real-customer validation is claimed. Android compilation progress is recorded in the dated continuation below; iOS compilation completed on 12 October; the subsequent architecture evidence check failed and its repaired rerun is pending.

## What exists

Shared Expo SDK57/React Native app with Expo Router routes, native labeled inputs/date-time picker, safe areas, keyboard-aware scrolling, email OTP host auth, owned-event dashboard, create/edit/publish/archive, native sharing, online guest search and check-in/undo, optional personal-QR scanner, calendar composer, session revocation/local sign-out, support/privacy links, account-deletion initiation/cancellation and guest browser RSVP fallback.

Camera/check-in uses `/e/<selected event slug>?t=<personal token>`; it does not mistake the public event QR for a personal guest identifier. Incoming native routes are bounded and allowlisted; universal/verified app links are not configured or claimed. Calendar composer is available on Android and iOS17+, avoiding broader calendar access on iOS16.4. Users on older supported iOS retain other app functions. No microphone, contacts, shared-storage or calendar read/write permissions are requested; generated Android manifests contain explicit removal directives. iOS camera is the only usage permission string generated for these features.

The default-disabled `/api/mobile/v1` gateway validates revocable seven-day database sessions. Supported operations are explicitly allowlisted; browser APIs retain cookies and the existing CSRF protection. OTP consumption is atomic. Missing/deleted accounts fail closed. Event ownership, roles, quotas, publication validation and check-in semantics remain enforced by shared business handlers.

Create uses a client UUID stored with the pending payload in device SecureStore, in Unicode-safe items smaller than 2KB. A host-scoped server mutation table stores the request hash and resulting event in the same transaction under the existing host lock. A lost response or app restart retries the original key and returns the same event; different payloads conflict. Keys survive event deletion as tombstones, preventing resurrection. Temporary encrypted draft records are removed after confirmation/sign-out. Guests/attendee lists are never cached on disk. Web preview storage is memory only.

Unknown check-in results block further local changes until a successful refresh. Backend attendee locks suppress duplicate audit/webhook effects and preserve original arrival timestamps for repeated desired states. Offline sign-out attempts credential and draft removal independently, always clears private UI, and distinguishes unconfirmed server revocation. If the OS refuses storage removal, the app warns and offers a cleanup retry; actual keychain failure/lock behavior needs device testing. Repeated pending deletion requests keep the original seven-day date; the deletion processor has local isolated HTTP proof; production scheduling, vendor retention and operational proof remain open.

## Evidence

| Check | Evidence/status |
| --- | --- |
| Mobile TypeScript | Pass, independent TS6/React19.2 tree |
| Mobile lint | Pass, separate TypeScript and hooks rules, zero warnings |
| Mobile tests | 24 passing: origin/link validation, source-aware arrival commands, fetch failures, no auto retry, credentials/redirect handling, browser fetch receiver binding, Unicode-safe draft recovery across store re-instantiation and failed local writes, account-scoped recovery visibility, corrupt recovery storage and cleanup failure isolation |
| Gateway unit tests | 3 passing within root suite: allowlist, bearer format, concurrent async identity isolation |
| Isolated PostgreSQL + actual Next HTTP | 58 assertions pass: native vs cookie auth, OTP single use/concurrent consumption, roles/cross-owner access, expiry/deletion/orphan identity, create retry/conflict/quota, edit/publish/archive, arrival retries, deletion-date stability, logout and CSRF; plus due-account processor authentication, account/event/session/recovery-key/upload cleanup, future/cancelled preservation and paid-account blocking/resumption |
| iOS, Android, web JS exports | Pass; Hermes output for both native platforms. These are bundles, not signed installable apps. |
| Native prebuild | Pass, iOS/Android project generation and permission configuration inspected. Android native compilation and packaged permission verification passed at `20456b8`; iOS compiler passed at `48e5a84`, but its evidence check failed; repaired verification is pending. |
| Web root checks | Typecheck/lint and full 609-test suite checked; see final run logs. The check-in source assertion was updated for preserving original attribution, with HTTP persistence/effect checks added. |
| Next production build | Pass on the 11 October retry after disk capacity increased. Earlier ENOSPC attempt retained as history; current successful log is `web-build-pass.log`. Remote full web/native source CI subsequently passed at `20456b8` (run `38282448228`). |
| Rendered browser preview | Welcome/sign-in inspected at 390×844; invalid email keeps submit disabled. Final Router welcome and sign-in rendering re-checked at 390×844; screenshot at `outputs/sealsend-mobile/final-welcome-390.png`. A preview-server directory replacement was corrected before the final check. No native-device UI claim. |
| Independent review | Two substantive read-only reviews; material recovery, calendar, navigation and permissions findings repaired. Final source re-review confirmed the idempotency design; conditional sign-out cleanup finding repaired with independent cleanup attempts and failure-injection tests. Focused final independent confirmation passed 19 tests, typecheck/lint and found no new P1 issue in that repair. |
| CI definition | Branch pushed and draft PR #249 opened on 12 October. Full web Build and native source/bundle jobs passed at `20456b8`; any subsequent candidate still requires its own CI checks. Audit artifact is informational; a green job does not mean release approval. |

Final command logs and the dependency audit are preserved in the task output folder `/Users/Cameron/Documents/Codex/2026-10-08/re/outputs/sealsend-mobile/`. HTTP tests use an isolated loopback PostgreSQL cluster and fabricated `.example.test` accounts. They do not send emails, access production data or accept store terms.

## Welcome and host-journey polish

The next local polish pass adds a custom digital gathering graphic, a single host CTA, a compact expandable guest fallback, quiet legal actions, readable event statuses and wrapping header/action rows. Native iOS/Android accessibility hiding and web aria-hidden suppress the decorative graphic. Invalid invitation feedback stays beside its input; archive is placed after everyday event actions.

A discovered privacy issue was repaired: pending recovery state is derived from the active host ID, explicitly replaced at sign-in/restore, and private form/event/guest/account state is cleared on session expiry and sign-out. A regression test proves no draft details are surfaced to a signed-out or different host. Independent review found no material issue in these scoped changes.

Final mobile typecheck, lint, all 23 tests and iOS/Android/web exports pass. Browser rendering was inspected at 320, 390 and 768 pixel widths. Interactive checks verified guest expansion, inline invalid-link feedback, incoming-link expansion, host CTA to login, invalid-email disabled submission and signed-out private-route redirection. No real email, account, guest action or external provider communication was used in these checks. Screenshot: `outputs/sealsend-mobile/polished-welcome-390.png`. These browser checks do not establish native keyboard, large-text or screen-reader behavior; those remain in the device matrix.

Quality target: clear first action, no known material finding in the reviewed source/surfaces, account-safe recovery and verified failure feedback. A numerical 100/100 release score cannot be evidenced before the remaining binary/device, dependency and human-pilot gates.

## Recovery and build preparation continuation

Corrupt or inaccessible local recovery records no longer abort authenticated event loading. Draft creation stays disabled until the host reviews saved events and explicitly clears device recovery data in Account and privacy. Other-host recovery is hidden and also requires device cleanup before new creation. Clearing removes only local details/retry keys, never server events, and the confirmation explains the loss of interrupted-save replay. All 33 storage deletions are attempted despite individual failures; incomplete cleanup is reported. Sign-out isolates synchronous and asynchronous cleanup failures, and its retry action remains visible after repeated failures independently of notice wording.

Three failure-injection tests were added (23 total pass). Mobile typecheck/lint and final iOS/Android/web exports pass. Independent review found no material auth/recovery issue and the reported retry-affordance caveat was repaired. These storage scenarios are host-level tests, not physical-keychain or rendered signed-device proof.

Local EAS profiles are prepared in `apps/mobile/eas.json`: iOS simulator, internal APK/provisioned iOS preview, and store AAB/iOS builds. Public Expo configuration resolves SDK57 and the initial native version identifiers. No EAS CLI/account setup, source upload/archive inspection, credential creation, cloud job, signed artifact or submission was performed. Profiles still need actual EAS build validation after authorization; the README contains the commands, archive-inspection requirement and current official source links. At that checkpoint local disk was approximately 160MB free. It later increased to approximately 3GB; the full Next build now passes, but safe native compilation capacity remains insufficient.

## Authenticated host browser QA continuation

The 11 October continuation exposed a browser runtime failure: storing global fetch and invoking it as an Api method caused an illegal receiver error before network access. The default fetch is now bound to globalThis, with a regression test that verifies its receiver. An empty-string notice also produced a React Native text-node warning; its conditional now uses an explicit boolean.

Authenticated entry is shared by OTP, startup restoration and retry restoration. Each path scopes device draft recovery, preserves its warning, routes to the dashboard before event loading, and offers retry on a failed list request. Creation is disabled until events load, and a failed load no longer looks like an empty account or leaves a host stranded at sign-in. Guest-list entry clears the previous search, and arrival counts use singular wording for one person. Independent read-only review confirmed the reported recovery issue was resolved and found no new material issue in the scoped auth/recovery changes.

Final TypeScript, zero-warning lint, 24 mobile tests and iOS/Android/web JavaScript exports pass. Browser UI was exercised at 390×844 against a fabricated loopback API fixture: OTP sign-in, injected event-list 503 and successful retry, saved-event navigation, draft creation, editing, publication status, source-specific guest check-in/undo, no-match search, account privacy navigation and sign-out clearing private UI. No real email, production account, publication or guest data was involved. This fixture verifies UI wiring and feedback; it does not replace the earlier actual Next/PostgreSQL tests or native platform validation. Native date picking, camera, sharing, calendar and destructive confirmation flows still need device testing.

Screenshots: `host-dashboard-390.png` and `guest-check-in-390.png` in the task output folder. Final command logs use the `journey-` prefix; the isolated Python fixture is preserved there for reproduction. Production-origin exports were generated without the local fixture API override. Full Next production build passed separately with root source unchanged.

## Native build environment and dependency continuation

Fresh 11 October audit still reports 22 affected package entries (19 high, 3 moderate), aggregating three underlying advisories. Current registry versions and paths were checked; no compatible validated automatic fix was found. See [DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md) and `dependency-audit-2026-10-11.json` / `dependency-paths-2026-10-11.log` in the task output folder. No forced dependency downgrade or audit suppression was applied.

Available disk temporarily increased to 9.6GB. Xcode27 and CocoaPods are installed; an iOS26.5 simulator runtime is available. Local `pod install` advanced through native module, React Native, Hermes and framework staging, but disk dropped below 2GB during the attempt. It was explicitly cancelled before Xcode compilation to avoid another storage-full failure. Its log is `ios-pods-attempt.log`; there is no completed CocoaPods installation/workspace or native binary. The incomplete task-created Pods directory was removed after preserving the log, leaving roughly 1.9GB free. No unrelated checkout, cache, simulator or user file was deleted. Do not infer all observed disk changes came from this process.

Android readiness is independently blocked: `/usr/libexec/java_home -V` reports no Java runtime, and the standard `~/Library/Android/sdk` is absent. The `/usr/bin/java` launcher alone does not provide a JDK. No Android tools or cloud build were installed/started. Resume native compilation with materially more disk headroom (target at least 15–20GB before dependencies and derived data), a working platform toolchain, or explicit cloud build/account/cost authorization. Store signing and physical-device QA remain separate gates.

Historical web findings were reconciled against current source: `b7ac828` already repairs private sharing, authorized transactional RSVP edits, scoped check-in camera policy and HTTPS artwork CSP. Current `tests/rsvp-edit.test.ts` passes all six tests, including persisted edit identity, capacity, rollback and guest status synchronization. Log: `web-findings-recheck.log`. This is a local regression/source recheck, not a new deployment or current production-policy verification.

## Android testing and TestFlight preparation

On 12 October Cameron selected Android testing and Apple TestFlight. Branch `feat/native-mobile-apps` was pushed and [draft PR #249](https://github.com/camster91/SealSend/pull/249) opened/attached. No merge or backend deployment occurred. `submit.beta` prepares an Android internal-track draft upload and interactive iOS submission; no guessed owner/app IDs or automatic upload are configured. The beta packet and bounded metadata draft are in [BETA_RELEASE.md](BETA_RELEASE.md) and `store-metadata.json`.

Actual isolated Next/PostgreSQL checks now pass 58 assertions. They prove due-account removal of events, sessions, mutation recovery records and local upload files; cancelled/future requests are retained; active paid accounts are blocked and their requests complete after billing cancellation. Processor authorization is tested. This does not establish production scheduling or Stripe/vendor erasure, and team workspace ownership/event handover also passes the representative processor fixtures. Store support and privacy URLs returned HTTP200 on 12 October.

Nine installed source SDK privacy manifests were parsed and none declared tracking. This is a source inventory, not a signed aggregate manifest or a complete production data-safety declaration. The worksheet explicitly retains backend diagnostics, email-provider and retention review. Signing, store ownership, build path/cost, device verification and tester group remain unresolved owner inputs. Physical-device results, testers and store acceptance are not invented.

## Standard hosted Android compilation

A standard Ubuntu24.04 public-repository workflow now generates Android from checked-in Expo configuration and compiles an ARM64 release-mode APK without Apple/Google/Expo credentials. It uploads no APK and caches no native artifacts. The first run at `f762763` completed Gradle assembly successfully in 11m16s and produced an APK checksum, but the evidence step failed because the runner did not include ripgrep. This was an evidence-tool failure, not a failed native compiler. Its logs are retained as `android-first-assembly.log` and `android-first-evidence-failure.log`.

The verifier has been replaced with Python standard-library archive checks and Android SDK manifest inspection: embedded JS, ARM64 Hermes, no extra ABI libraries, scanner camera declaration, and no microphone/contact/calendar/shared-storage/overlay/location permissions. The repaired workflow passed at `20456b8` in run `38282440886`. An assembled APK with Expo's generated development key is not a Play-signed release, retained download, installed-device proof or human beta. The full web and mobile source/bundle CI run passed `f762763`; full CI also passed at `20456b8` in run `38282448228`.

A standard ARM64 macOS26 workflow is prepared for unsigned iOS Release simulator assembly, embedded bundle/identity/permission checks and packaged privacy manifest inspection. It uploads no app and uses no signing credentials. Its first execution at `48e5a84` completed Xcode compilation in 26m31s, then failed because the lipo architecture-check arguments were ordered incorrectly. The command is corrected at `57eb5b9`; the rerun targets ARM64 only and is pending. No signed archive or device result is claimed.

## 13 October testing preparation

The first iOS native compiler succeeded; the workflow remained red because its post-build lipo invocation was invalid. The corrected input-first invocation was checked against a local Mach-O binary. A fresh hosted ARM64-only compilation and binary verification is running. Full CI passed at `48e5a84`; later candidates require their own checks. Mobile typecheck, lint and all 24 tests pass on this continuation.

`DEVICE_TESTING.md` supplies the signed-build identity record, installation prerequisites and 17 device cases with explicit Pass/Fail/Blocked/Not run outcomes. Independent review found no material issue. None is a recorded device result. A read-only production check on 13 October still returned 404 from `/api/mobile/v1/me`. There is no local Expo session. Valid Apple signing identities exist locally, but the owning team, registered SealSend app and usable provisioning remain unconfirmed. No identity has been exported or uploaded. The fresh mobile dependency audit remains 22 entries (19 high, 3 moderate), with no critical entries.

## Outstanding gates and owners

| Priority / gate | Owner | Resume condition |
| --- | --- | --- |
| Native binary builds | Cameron / build environment | Provide at least 15–20GB local headroom plus the required platform toolchain, or explicitly select/authorize Expo cloud build/account/cost. Earlier compilation attempts ran out of disk. The full Next production build has since passed; iOS native compilation passed on the hosted runner, with repaired binary verification pending; Android assembly and verification passed there. Signed distributable builds still require the owning account/toolchain. No unrelated files were removed. |
| Upstream dependency advisories | Engineering / dependency maintainers | Review current npm audit. At research time braces and node-forge had no published patched registry version; decode-uri-component0.5 fixes its advisory but is ESM and breaks the current query-string7 consumer when overridden directly. Do not force a downgrade to an incompatible Expo SDK or claim audit clean. Native intent filtering reduces arbitrary input but is not proof that the upstream advisory is fixed. Resolve/assess before external beta. |
| Reviewed backend beta release | Cameron / engineering | Green full web build/CI and reviewed additive migration; approve enabling `ENABLE_NATIVE_MOBILE_API=true` only after native testing. Gateway remains off by default. |
| Native platform QA | Engineering + Cameron/devices | Install compiled app on simulator/emulator and physical iOS/Android; inspect real keyboard, font scaling, VoiceOver/TalkBack, permissions, share/calendar cancel, rotations, cold starts, offline recovery and repeated actions. |
| Store ownership/signing | Cameron | Verify bundle/package IDs, Apple/Play/Expo account ownership, signing profile/keystore, certificates and account terms. Provisional identifier is `com.ashbi.sealsend`; no credentials created or exposed. |
| Privacy, billing and deletion | Cameron / engineering | Complete store privacy/data-safety forms from actual SDK manifests; verify production deletion scheduling/vendor retention (local processor assertions pass), check web deletion pathway and paid-account cancellation policy. No native purchases implemented. |
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
