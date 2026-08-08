# SealSend deployment readiness

Date: 2026-08-07

## QA-team release — 2026-08-08 UTC

Production now runs image `sealsend:20260808T013618Z`. Release source is stored at
`/opt/sealsend/releases/20260808T013618Z`; the pre-migration PostgreSQL/config backup
is retained at `/opt/sealsend/backups/20260808T012845Z`, and the final configuration
backup is at `/opt/sealsend/backups/20260808T013618Z`.

Five QA personas reviewed the product: casual mobile, power/security, frustrated-user,
accessibility, and internationalization. Confirmed fixes include the annual-Pro schema
contract, paid-status webhook gating, atomic RSVP/plus-one writes, serialized signup-slot
claims, host-timezone persistence and display, paid-plan handoff, wizard partial-save
feedback, mobile keyboard navigation, nested CTA semantics, auth/FAQ announcements, and
removal of misleading placeholder features.

Post-deploy verification passed the authenticated host/guest lifecycle, event creation,
publishing, guests, magic links, public RSVP, plus-ones, comments, response dashboard,
CSV export, plan limits, desktop/mobile navigation, responsive layouts, timezone display,
and cleanup. The final disposable QA account and event were removed. The app and database
containers are healthy and `/api/health` returns HTTP 200.

Billing is explicitly guarded by `PAYMENTS_TEST_ONLY=true`. The connected Stripe key is
live-mode and has no SealSend annual price, so checkout is intentionally unavailable and
the pricing page says “Test billing setup pending.” Connect a Stripe test-mode secret and
create/configure the $124.99 USD yearly test Price before running checkout/webhook tests.
No live charge, email, or SMS was sent during QA.

## Production deployment

Deployed to `root@187.77.26.99:22` (`vps.ashbi.ca`) on 2026-08-07 as image `sealsend:20260807T194445Z`.

- Public origin: `https://sealsend.app`
- Application container: `x8okwogw0so8s08oss04s088-011248616962`
- Database container: `sealsend-postgres` (`postgres:16-alpine`)
- Docker network: `proxy`
- Persistent volumes: `sealsend-uploads`, `sealsend-postgres-data`
- Release source: `/opt/sealsend/releases/20260807T194445Z`
- Rollback/config backup: `/opt/sealsend/backups/20260807T194445Z`
- Uploaded archive SHA-256: `52d2e4db5b9ca0f7b371ff8e9dd9fab78e6c327791f3c18b4dd3743d395e21b4`

Live verification passed for HTTP-to-HTTPS redirect, trusted Let's Encrypt TLS, `/api/health`, homepage, pricing, login, privacy, terms, robots, sitemap, CSP/HSTS/security headers, protected sensitive paths, container health, and desktop/mobile pricing rendering.

The deployment is operational but paid launch remains blocked: `STRIPE_PRO_YEARLY_PRICE_ID` is not configured, and read-only Mailgun and Twilio credential checks returned HTTP 401. Stripe account authentication returned HTTP 200. Do not advertise working annual Pro checkout, email onboarding, or SMS delivery until those provider configurations pass staging tests.

Because no prior SealSend container or database was running, rollback means stopping/removing the two new containers while retaining both named volumes, then restoring the backed-up Coolify `.env` and Compose file. Do not delete the volumes during rollback unless data destruction is explicitly approved.

## Status

The repository is a locally verified release candidate for a controlled beta. The approved hybrid billing model is implemented: Silver through Diamond are one-time event upgrades, while SealSend Pro is one annual account subscription. Production deployment is not yet approved or verified. Do not treat this report as evidence that the live service, billing, email, SMS, DNS, backups, or scheduled jobs are operational.

## Verified locally

- Strict ESLint gate with zero warnings.
- TypeScript typecheck.
- Unit and repository readiness tests.
- Chromium desktop and Pixel 7 browser tests, including auth protections, public pages, malformed magic links, runtime errors, and horizontal overflow.
- Production Next.js build.
- Docker image build and non-root runtime with a writable persistent uploads path.
- Database-aware `/api/health` readiness reporting and Docker health state; it returned HTTP 200 with PostgreSQL available and HTTP 503 when PostgreSQL was stopped.
- Fresh PostgreSQL 16 schema contract.
- Legacy-schema migration and data backfill contract.
- Concurrent database-backed rate-limit enforcement.
- One-time guest magic-link acceptance: first request created one guest session and redirected to the event; replay was rejected; the guest was updated exactly once.
- Production dependency audit with zero known runtime vulnerabilities.
- Public pages no longer render unsupported usage statistics or invented testimonials.
- Hybrid entitlements: one free event; per-event Silver, Gold, Platinum, and Diamond limits; annual Pro unlimited events and 2,500 guests/responses per event; cancellation preserves separately purchased event tiers.
- Pricing page desktop and mobile visual review, with no observed clipping or horizontal overflow.
- Security headers including CSP, HSTS, frame protection, content-type protection, referrer policy, and permissions policy.
- Release-candidate Docker image `sealsend:release-candidate` built successfully with zero dependency vulnerabilities reported during installation.

## Required production configuration

- Set `DATABASE_URL`, `APP_URL`, and `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin.
- Generate and store a strong `SESSION_SECRET` and `CRON_SECRET` in the deployment platform.
- Create one recurring annual Stripe Price for SealSend Pro and set `STRIPE_PRO_YEARLY_PRICE_ID`. Event upgrades use one-time dynamic Stripe Checkout prices.
- Set Stripe secret and publishable keys, register `/api/webhooks/stripe`, and set `STRIPE_WEBHOOK_SECRET`.
- Configure Mailgun and verify the sending domain and From address.
- Configure Twilio if SMS is offered; register delivery callbacks and confirm regional/compliance requirements.
- Set `TRUST_PROXY_HEADERS=true` only when the production reverse proxy removes untrusted forwarded headers and supplies its own trusted values.
- Mount persistent storage at `/app/uploads`. Confirm the deployment platform actually uses the Compose volume or configure an equivalent volume.
- Schedule authenticated requests to `/api/cron/send-reminders` and `/api/cron/cleanup-drafts`.

## Approved product model

- Free: one event, 15 guests/responses.
- Silver: $8.99 once for one event, 50 guests/responses.
- Gold: $17.99 once for one event, 150 guests/responses.
- Platinum: $34.99 once for one event, 500 guests/responses.
- Diamond: $49.99 once for one event, 750 guests/responses.
- SealSend Pro: $124.99/year, unlimited events and 2,500 guests/responses per event.

Annual Pro is stored as `pro_annual` account entitlement. One-time purchases remain stored on each event. Ending Pro therefore falls back to the event's independently purchased tier rather than overwriting it.

## Production launch checks

1. Back up the production database and verify restore instructions.
2. Apply `apply-security-indexes.sql`, then run representative smoke queries before accepting traffic.
3. Deploy to a staging hostname with production-equivalent PostgreSQL, storage, proxy, and environment variables.
4. Complete Stripe test-mode checkout, webhook, renewal/update, failed-payment, and cancellation checks.
5. Send real test email and SMS messages and verify delivery callbacks.
6. Verify magic links, login, event creation, uploads, publishing, invitations, RSVP, reminders, sign-up claims, CSV export, and subscription entitlements end to end.
7. Check desktop and mobile layouts on the staging hostname, plus Safari and Firefox or real-device equivalents.
8. Confirm TLS, DNS, cookie security, backups, log retention, error monitoring, uptime monitoring, privacy/terms accuracy, support contact, and incident ownership.
9. Obtain real customer permission and supporting data before restoring testimonials, ratings, or adoption statistics.

## Known informational warning

Next.js 16 emits an Edge Runtime deprecation warning for the framework proxy convention. The production build succeeds, and the current proxy is required for request gating. Track the framework migration path when Next.js provides a compatible Node-runtime replacement.

## Release decision

Code infrastructure readiness: **pass**.

Product release readiness: **pass for a controlled beta; broader paid launch should follow real-customer onboarding and support validation**.

Production readiness: **pending external configuration, Stripe test-mode lifecycle verification, and staging/live verification**.
