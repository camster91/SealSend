# SealSend deployment readiness

Date: 2026-08-08

## Release decision

- **Controlled AI beta:** deployed and verified for test-only operation.
- **Paid beta:** not cleared. Stripe's complete test lifecycle and controlled Mailgun/Twilio delivery/callback tests still require verified provider configuration.
- **Public paid launch:** not cleared. It additionally requires five real hosts to complete workflows, professional legal/accounting review, and observed conversion/cost evidence.

Payments and external communications must remain explicitly test-only until their provider gates pass. A green local build is not evidence of a completed charge or delivered message.

## Current production

- Public origin: `https://sealsend.app`
- Host: Hostinger VPS `vps.ashbi.ca` (`187.77.26.99`)
- Application container: `x8okwogw0so8s08oss04s088-011248616962`
- Database container: `sealsend-postgres` (`postgres:16-alpine`)
- Current verified image: `sealsend:20260809T170408Z`
- Current verified application commit: `bb7c882309215c4d578b1fe8f49a4cc63e1b87a3`
- Current release source: `/opt/sealsend/releases/20260809T170408Z`
- Immediate rollback image/source: `sealsend:20260809T031926Z` and `/opt/sealsend/releases/20260809T031926Z`
- Earlier rollback source: `/opt/sealsend/releases/20260808T130600Z`
- Verified pre-release database backup: `/opt/sealsend/backups/automated/sealsend-20260809T170408Z.dump`
- Pre-change Coolify configuration backup: `/opt/sealsend/backups/20260808T134336Z/coolify.env`

The application and PostgreSQL containers are healthy and `/api/health` returns HTTP 200. HTTP redirects to HTTPS, the expected CSP/HSTS/content-type/referrer headers are present, protected cron returns 401, and the synthetic monitoring route returns 404 without its secret. The health cron and verified database backup are installed.

## Locally verified release candidate

- 110 unit/readiness tests passed, including provider readiness, fail-closed launch evidence, cross-browser coverage, replay-safe callbacks, alert delivery backoff, Stripe lifecycle mapping, account deletion/export, upload quotas, timezone/DST handling, selected-channel cost preview, atomic RSVP-field, checkout authorization, accessible checkout failures, and operational cron safeguards.
- TypeScript typecheck passed.
- ESLint passed with zero warnings.
- Next.js 16 production build passed.
- The complete local Playwright run passed 31 tests with 12 intentional credential skips; three tests that timed out only under six-worker development-server load then passed serially (six accessibility and four visual checks).
- Axe found no serious or critical violations on the audited public routes at 375, 768, and 1440 pixels.
- Visual/responsive coverage ran at 375, 768, and 1440 pixels with reduced motion.
- Fresh PostgreSQL 16 schema and the production migration applied successfully, and the migration applied a second time successfully to prove idempotency; 34 public tables were verified.
- Runtime dependency audit reported zero known vulnerabilities; GitHub Dependabot had zero open alerts when checked on 2026-08-08.
- `git diff --check` passed.

## Production QA evidence

- A disposable production owner completed the authenticated lifecycle on Chromium; public navigation/responsive checks passed on desktop and Pixel 7 emulation.
- Verified AI event fallback and acceptance, template-to-wizard routing, event creation/publishing, default RSVP fields and JSON options, guests/bulk guests, magic links, public RSVP plus-one, comments, response dashboard, CSV, and plan enforcement.
- Verified aggregate RSVP summary, resolved email audience and selected-channel counts, AI message fallback and helpful/accepted feedback, and beta-feedback persistence. No announcement was scheduled or sent.
- The monitoring test captured one sanitized `/api/monitoring/test` event. No guest content, error message, stack, token, or contact value was stored in that monitoring row.
- Disposable account/event/feedback data was deleted; final checks returned `qa_accounts=0`, `qa_events=0`, and no orphan feedback.
- The earlier release exposed an RSVP-option serialization defect in production logs. It was fixed in `8e04ba4`, redeployed, and the complete lifecycle plus explicit six-field/option assertions passed. The corrected release has no recurrence of that database error.
- A disposable check-in-only staff account passed the production least-privilege matrix at 375px: guest list, check-in, check-out, keyboard focus, and no overflow passed; event edit, response export, member administration, messaging, and checkout were denied. The test exposed and drove fixes for checkout configuration leakage and a PostgreSQL UUID assignment error before passing. Final fixture counts were zero.
- A disposable paid-event fixture verified Google and Outlook calendar links plus a downloadable ICS with the stable event UID. A future approved email announcement remained queued with `dispatch=null`, appeared in status history, and was cancelled before dispatch. No provider send occurred and the fixture was deleted.
- All 13 launch templates passed production QA at 375px and 1440px. Both galleries had no horizontal overflow; every template opened the correct named wizard and persisted its complete customization into an isolated editable draft; no browser runtime errors occurred. The disposable account was deleted.
- The deployed Terms and Privacy pages match the verified support-request deletion workflow. Health and both policy pages returned HTTP 200, and 12 production desktop/mobile marketing and accessibility checks passed with no serious or critical Axe findings.
- A disposable production owner passed the new account-privacy lifecycle: authenticated JSON export, deletion scheduling, cooling-off cancellation, and settings accessibility. The account was removed directly after the non-destructive test; final counts showed zero QA accounts and zero pending QA deletion requests.
- Production contains the account-deletion, upload-asset, host-lifecycle-notification, and deleted-account-upload-cleanup tables. The revised maintenance runner was installed with backups; draft cleanup, orphan cleanup, and host lifecycle jobs passed in report-only/disabled mode.
- The current release keeps `PAYMENTS_TEST_ONLY=true`, `COMMUNICATIONS_TEST_ONLY=true`, all three automation enable flags false, and draft retention at 90 days. Public export and cron routes reject unauthenticated access, while the operations endpoint remains hidden until configured.
- Stripe now handles delayed-payment success, failed-payment recovery, safe subscription-state mapping, and replay claims. Twilio callbacks update delivery state transactionally, reject replays, preserve terminal states, and return 500 on transient processing failures so the provider can retry.
- The secret-gated provider-readiness endpoint reports configuration booleans and key mode without returning credentials. Production returns 404 without valid authorization; unsigned Stripe and Twilio probes returned 400 and 401 respectively.
- After the provider hardening deployment, 12 desktop/mobile public marketing and Axe checks passed at 375, 768, and 1440 pixels; the container remained healthy with no recent error, fatal, or panic log entries.
- A bounded production-safe load run completed 200 read-only requests at concurrency 10 with zero failures, 286 ms p95, and 629 ms maximum latency. A disposable capacity test sent ten simultaneous RSVPs to a three-seat event; exactly three persisted and seven were rejected, proving the production serialization boundary without overbooking. All fixtures were removed.
- The latest 33-table backup restored into isolated PostgreSQL 16 and booted both `sealsend:20260809T012633Z` and rollback image `sealsend:20260809T003511Z`; each returned health 200 and unauthenticated events 401. The rehearsal used isolated Docker networks and removed its containers after each run.
- Firefox, desktop WebKit, and iPhone WebKit emulation passed 27/27 live accessibility and public regression checks. The initial desktop WebKit run caught a transient reduced-motion hero contrast failure; the deployed fix suppresses entrance/floating motion for reduced-motion users and the complete production rerun passed.
- Alert delivery now verifies a successful webhook response, stores only a safe fingerprint/status/timestamps, suppresses successful repeats for 15 minutes by default, and retries failed delivery after one minute. Fresh PostgreSQL 16 schema plus the production migration succeeded twice idempotently with 34 public tables.
- The alert-delivery release `sealsend:20260809T170408Z` was deployed on 2026-08-09. Its container is healthy at application commit `bb7c882309215c4d578b1fe8f49a4cc63e1b87a3`; public health returned 200/no-store, unauthenticated operational metrics returned 404, and authorized aggregate metrics returned 200 with an empty alert-delivery summary. An alert receiver is still required to prove external alert receipt.
- The `20260808T134326Z` production backup restored successfully into an isolated PostgreSQL 16 container with 26 public tables. The restore container was removed after the rehearsal.
- Parallel Playwright navigation produced two Next.js “destination stream closed early” client-disconnect logs without failed assertions, unhealthy state, or persisted-data errors. Track recurrence, but this is not currently a release blocker.

## Implemented product scope

- Core host/guest lifecycle: account access, events, publishing, guests, RSVP fields, plus-ones, comments, signup boards, tags, invitations, reminders, announcements, responses, CSV, QR/magic links, and plan enforcement.
- Least-privilege event collaboration with owner, manager, check-in-only, and viewer roles plus audit records.
- Stable timezone-aware ICS and Google Calendar output.
- Scheduled/targeted messaging with resolved-recipient preview, delivery state, retry safeguards, explicit approval, and selected-channel cost status.
- Mobile guest search, QR-assisted check-in, and reversible check-in audit history.
- Structured prompt-to-event AI drafts with strict validation, assumptions, deterministic fallback, quotas, telemetry, and manual review.
- AI-assisted message drafts with tone, length, urgency, and channel controls; no AI route can send externally.
- Traceable aggregate RSVP intelligence that excludes guest free text from AI interpretation.
- Thirteen editable templates, template-to-wizard population, safe artwork upload, and non-destructive crop/focus controls.
- Privacy-limited activation analytics, sanitized server-error monitoring, authenticated beta feedback, health checks, backups, and rollback artifacts.
- Self-service portable JSON export plus scheduled account deletion with a seven-day cooling-off period, paid-subscription protection, cancellation, and retry-safe upload cleanup.
- Per-account upload accounting and serialized quotas: 250 MB free, 1 GB paid-event, and 5 GB annual Pro; orphan deletion remains report-only until explicitly enabled.
- First-event onboarding, checkout lifecycle analytics, aggregate secret-gated operational metrics, and deduplicated host lifecycle messaging that remains disabled until provider verification.
- Explicit English/USD controlled-beta scope, locale-aware previews, selected event-timezone conversion, DST validation, and international E.164 guest phone handling.

## Production configuration gates

- `PAYMENTS_TEST_ONLY=true` must remain set.
- `COMMUNICATIONS_TEST_ONLY=true` must remain set.
- Use a Stripe **test-mode** secret, recurring annual Pro price, and webhook secret before payment QA. Verify success, cancellation, failure, delayed payment, renewal/update, cancellation, and webhook replay.
- Verify Mailgun/Twilio credentials and allowlists before sending only to approved recipients. Confirm queued, accepted, delivered, failed, bounced, and opted-out states where supported.
- Configure `ERROR_ALERT_WEBHOOK_URL`, then call the secret-protected monitoring test route and verify receipt. The health cron alone does not prove alert delivery.
- Set channel-specific `EMAIL_ESTIMATED_COST_MICROS` and `SMS_ESTIMATED_COST_MICROS` from current provider pricing before relying on the approval estimate.
- Approve a retention policy before enabling draft cleanup. Reminder/announcement cron jobs remain gated until controlled delivery verification.
- Keep `ENABLE_STALE_DRAFT_CLEANUP=false`, `ENABLE_ORPHAN_UPLOAD_CLEANUP=false`, and `ENABLE_HOST_LIFECYCLE_EMAILS=false` until retention/provider gates are approved and verified.
- Keep the configured `OPERATIONS_SECRET` private, rotate it after any suspected exposure, and retrieve aggregate operational metrics only from an approved operator context.
- Keep `/app/uploads` on persistent storage and retain verified database backups before every migration.

The read-only production provider probe on 2026-08-08 returned: Stripe authentication HTTP 200 with a live-mode key, Mailgun HTTP 401, Twilio unconfigured, and OpenAI unconfigured. Therefore provider-dependent tests remain blocked and both test-only flags remain mandatory.

On 2026-08-08, a generated 64-character `OPERATIONS_SECRET` was installed in the protected Coolify environment after backing it up to `/opt/sealsend/backups/20260809T014642Z-coolify.env`. The authenticated readiness endpoint worked without returning credential values. Fresh read-only probes returned Stripe HTTP 200 in live mode, Mailgun HTTP 401, and Twilio HTTP 401; the connected Stripe app also required reauthentication. No charge, message, refund, provider mutation, or guest-data submission occurred.

## Required deployment and QA sequence

1. Run unit/readiness tests, typecheck, lint, production build, dependency audit, and the complete local Playwright suite.
2. Commit and push only the reviewed source; exclude `.hermes/`, screenshots, reports, credentials, and temporary archives.
3. Create and verify a new PostgreSQL backup, retain the prior image/release, and record an explicit rollback target.
4. Build a uniquely tagged image and apply `apply-security-indexes.sql` with `ON_ERROR_STOP` before switching the app.
5. Verify explicit test-only environment flags, container health, logs, HTTP-to-HTTPS, TLS, CSP/security headers, sensitive-path protection, robots, sitemap, and `/api/health`.
6. Use a disposable production QA owner to exercise AI fallback, templates, event create/edit/publish, guests, public RSVP/plus-one/comment, RSVP summary, audience/cost preview, message-draft feedback, calendar/CSV, beta feedback, and cleanup.
7. Verify a disposable check-in-only user can check guests in but cannot access event design, exports, or billing.
8. Run public visual/accessibility checks at 375, 768, and 1440 pixels, including long content and missing artwork.
9. Remove all disposable QA accounts/events/feedback and verify cleanup counts.
10. Update this file with the deployed commit/image, backup, rollback target, exact QA results, and remaining external gates.

## Known informational warning

Next.js 16 reports that the Edge Runtime used by the framework proxy convention is deprecated. The production build succeeds; track the supported migration path in a later framework upgrade.
