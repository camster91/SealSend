# SealSend deployment readiness

Date: 2026-08-08

## Release decision

- **Controlled AI beta:** deployed and verified for test-only operation.
- **Paid beta:** not cleared. Stripe's complete test lifecycle and controlled Mailgun/Twilio delivery/callback tests still require verified provider configuration.
- **Public paid launch:** not cleared. It additionally requires five real hosts to complete workflows, approved retention/support/refund policies, and observed conversion/cost evidence.

Payments and external communications must remain explicitly test-only until their provider gates pass. A green local build is not evidence of a completed charge or delivered message.

## Current production

- Public origin: `https://sealsend.app`
- Host: Hostinger VPS `vps.ashbi.ca` (`187.77.26.99`)
- Application container: `x8okwogw0so8s08oss04s088-011248616962`
- Database container: `sealsend-postgres` (`postgres:16-alpine`)
- Current verified image: `sealsend:20260808T135549Z`
- Current verified application commit: `8e04ba4`
- Current release source: `/opt/sealsend/releases/20260808T135549Z`
- Immediate rollback image/source: `sealsend:20260808T134336Z` and `/opt/sealsend/releases/20260808T134336Z`
- Earlier rollback source: `/opt/sealsend/releases/20260808T130600Z`
- Verified pre-release database backup: `/opt/sealsend/backups/automated/sealsend-20260808T134326Z.dump`
- Pre-change Coolify configuration backup: `/opt/sealsend/backups/20260808T134336Z/coolify.env`

The application and PostgreSQL containers are healthy and `/api/health` returns HTTP 200. HTTP redirects to HTTPS, the expected CSP/HSTS/content-type/referrer headers are present, protected cron returns 401, and the synthetic monitoring route returns 404 without its secret. The health cron and verified database backup are installed.

## Locally verified release candidate

- 86 unit/readiness tests passed, including selected-channel cost-preview and atomic RSVP-field regressions.
- TypeScript typecheck passed.
- ESLint passed with zero warnings.
- Next.js 16 production build passed.
- Playwright passed 34 applicable desktop/mobile tests; four production-credential tests were intentionally skipped locally.
- Axe found no serious or critical violations on the audited public routes at 375, 768, and 1440 pixels.
- Visual/responsive coverage ran at 375, 768, and 1440 pixels with reduced motion.
- Fresh PostgreSQL 16 schema applied successfully; the production migration then applied twice successfully, proving idempotency for the tested schema.
- Runtime dependency audit reported zero known vulnerabilities; GitHub Dependabot had zero open alerts when checked on 2026-08-08.
- `git diff --check` passed.

## Production QA evidence

- A disposable production owner completed the authenticated lifecycle on Chromium; public navigation/responsive checks passed on desktop and Pixel 7 emulation.
- Verified AI event fallback and acceptance, template-to-wizard routing, event creation/publishing, default RSVP fields and JSON options, guests/bulk guests, magic links, public RSVP plus-one, comments, response dashboard, CSV, and plan enforcement.
- Verified aggregate RSVP summary, resolved email audience and selected-channel counts, AI message fallback and helpful/accepted feedback, and beta-feedback persistence. No announcement was scheduled or sent.
- The monitoring test captured one sanitized `/api/monitoring/test` event. No guest content, error message, stack, token, or contact value was stored in that monitoring row.
- Disposable account/event/feedback data was deleted; final checks returned `qa_accounts=0`, `qa_events=0`, and no orphan feedback.
- The earlier release exposed an RSVP-option serialization defect in production logs. It was fixed in `8e04ba4`, redeployed, and the complete lifecycle plus explicit six-field/option assertions passed. The corrected release has no recurrence of that database error.
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

## Production configuration gates

- `PAYMENTS_TEST_ONLY=true` must remain set.
- `COMMUNICATIONS_TEST_ONLY=true` must remain set.
- Use a Stripe **test-mode** secret, recurring annual Pro price, and webhook secret before payment QA. Verify success, cancellation, failure, delayed payment, renewal/update, cancellation, and webhook replay.
- Verify Mailgun/Twilio credentials and allowlists before sending only to approved recipients. Confirm queued, accepted, delivered, failed, bounced, and opted-out states where supported.
- Configure `ERROR_ALERT_WEBHOOK_URL`, then call the secret-protected monitoring test route and verify receipt. The health cron alone does not prove alert delivery.
- Set channel-specific `EMAIL_ESTIMATED_COST_MICROS` and `SMS_ESTIMATED_COST_MICROS` from current provider pricing before relying on the approval estimate.
- Approve a retention policy before enabling draft cleanup. Reminder/announcement cron jobs remain gated until controlled delivery verification.
- Keep `/app/uploads` on persistent storage and retain verified database backups before every migration.

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
