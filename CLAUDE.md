# CLAUDE.md - SealSend Codebase Guide

## What is SealSend?

SealSend is a digital invitation and RSVP platform. Hosts create event invitations, send them by email or SMS, and track guest responses. Live at https://sealsend.app.

**Current state:** controlled beta. `BETA_MODE = true` in `src/lib/constants.ts` hides paid checkout and gives every account the beta entitlement (one active event, up to 100 guests). Payments and outbound messages stay test-only (`PAYMENTS_TEST_ONLY`, `COMMUNICATIONS_TEST_ONLY`) until the launch gates pass. See `DEPLOYMENT_READINESS.md` and `docs/launch-operations.md` before changing any of this.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4, design tokens in `src/app/globals.css`
- **Database**: PostgreSQL 16 via `pg` (raw SQL, no ORM)
- **Auth**: Custom database-backed sessions; email/SMS OTP for hosts, password login for admins
- **Email / SMS**: Mailgun / Twilio (`libphonenumber-js` for phone validation)
- **Payments**: Stripe
- **Other**: Framer Motion, React Hook Form + Zod, Sharp, QR code generation

## Commands

```bash
npm run dev            # Dev server
npm run build          # Production build
npm run typecheck      # tsc for app and scripts
npm run lint           # ESLint, --max-warnings=0 (any warning fails)
npm test               # Unit/readiness tests (node --test; files are listed explicitly in package.json)
npm run test:e2e       # Playwright (5 browser projects, tests/e2e)
npm run quality:score  # Evidence-bounded release scorecard
npm run launch:decision
npm run create-admin   # Create an admin user
```

Before pushing, run `typecheck`, `lint`, `test` and `build` — CI (`.github/workflows/ci.yml`) runs the same checks. When adding a unit test file, also add it to the `test` script in `package.json` or it will not run.

## Project Structure

```
src/
  app/
    (marketing)/  (auth)/  (dashboard)/   # Route groups
    e/[slug]/  invite/  guest/  team/      # Public event, invite, guest and co-host pages
    api/                                  # ~64 route handlers
      auth/        send-code, verify-code, login-password, logout, change-password
      events/      CRUD plus guests, responses, announcements, members, check-in, publish, clone, ...
      rsvp/ comments/ signups/ calendar/ guest-qr/   # Public, slug/token-scoped endpoints
      checkout/ subscriptions/                       # Stripe checkout
      webhooks/    stripe, twilio, mailgun           # Signature-verified
      cron/        send-reminders, send-announcements, send-host-lifecycle,
                   cleanup-drafts, cleanup-uploads, delete-accounts
      operations/ monitoring/ health/                # Ops endpoints (secret-protected except health)
      ai/ beta/ account/ upload/ uploads/ waitlist/ feedback/ team-invites/
  components/     ui/ auth/ dashboard/ events/ guests/ responses/ public-event/
                  pricing/ marketing/ features/ team/ layout/
  lib/
    auth/         session, api-auth, event-api-access, event-access, auth-service
    db/           client.ts, schema.sql (fresh schema), waitlist.sql
    ai/ messages/ monitoring/ analytics/
    constants.ts  BETA_MODE, FEATURE_FLAGS, tiers and pricing plans
    entitlements.ts, billing.ts, subscription.ts
    beta-*.ts     Controlled-beta enrollment, metrics and acceptance logic
  proxy.ts        Next 16 proxy (formerly middleware): CSRF origin check + route protection
tests/            Unit/readiness tests (node:test), e2e/ (Playwright), fixtures/
scripts/          Admin/beta CLIs, release/ (launch decision, scorecard), load/, test/
ops/              Backup, health, maintenance and release-rehearsal scripts for the VPS
config/           Launch evidence, quality scorecard, beta acceptance policy
docs/             Launch operations, evidence register, policy decisions
```

## Key Patterns

### Authentication and authorization
- Hosts sign in with a 6-digit email/SMS code (`/api/auth/send-code` → `/api/auth/verify-code`). Admins use `/api/auth/login-password` (`admin_users` table).
- Cookies: `sealsend_session` (httpOnly, authoritative) and `sealsend_user` (client-readable display data only — never trust it for authorization).
- In API routes:
  - `requireApiHost()` from `@/lib/auth/api-auth` for any signed-in host.
  - `requireEventPermission(eventId, permission)` from `@/lib/auth/event-api-access` for anything scoped to an event. It handles owner and co-host roles; use it rather than hand-rolled ownership checks.
  - Both return `{ error }` or `{ user }`; return `auth.error` early.
- Server components: `getCurrentUser()` from `@/lib/auth/session`. Client: `getClientUser()` from `@/lib/auth/client-auth`.
- `src/proxy.ts` rejects state-changing `/api/*` requests without a same-origin `Origin`/`Referer`, except `/api/webhooks/*` and `/api/cron/*`.
- Cron routes require `Authorization: Bearer $CRON_SECRET`; operations routes use `OPERATIONS_SECRET`.

### Database
- Use `query()` / `queryOne()` from `@/lib/db/client` with parameterized SQL only.
- `src/lib/db/schema.sql` is the schema for a fresh database (also used by e2e setup and `ops/rehearse-retention.sh`). `src/lib/db/waitlist.sql` creates `waitlist_signups`, which is not yet in `schema.sql` or the upgrade migration and has to be applied separately.
- `apply-security-indexes.sql` (repo root) is the idempotent upgrade migration applied to production with `psql -v ON_ERROR_STOP=1`. `tests/readiness.test.mjs` asserts on its contents, so schema changes usually touch both files plus that test.
- Write migrations with `IF NOT EXISTS` / `IF EXISTS` so they can run twice.

### Tiers and entitlements
- Per-event tiers (`events.tier`): `free`, `silver`, `gold`, `platinum`, `diamond`. Legacy `standard`/`premium` are still accepted and map to silver/gold limits.
- Recurring plans: Pro annual (`PRO_ANNUAL`) plus `SUBSCRIPTION_TIERS` in `constants.ts`.
- Resolve limits and features through `src/lib/entitlements.ts` (`getEffectiveEventLimits`, `canUseFeature`, `getTeamMemberLimit`), passing the account plan from `getUserTier()` in `src/lib/subscription.ts`. That returns `"beta"` while `BETA_MODE` is on, so don't read tier constants directly.
- `FeatureGate` (`src/components/features/FeatureGate.tsx`) gates UI by tier.

### Feature flags (`FEATURE_FLAGS` in `constants.ts`)
`subscriptions`, `teams` (co-host roles), `templates`, `analytics` are on; `aiAssistant` is off. AI event/announcement drafting lives in `src/lib/ai` and `/api/ai/*`, configured by `AI_PROVIDER`/`AI_MODEL`.

## Conventions

- Validate API input with Zod (`src/lib/validations.ts` and per-feature schemas).
- Rate-limit sensitive endpoints with `rateLimit()` from `@/lib/rate-limit`.
- Icons from `lucide-react`; `cn()` from `@/lib/utils` for class merging.
- Client components need `"use client"`; wrap `useSearchParams()` in `<Suspense>`.
- UI primitives in `src/components/ui/` use `forwardRef` and extend native element props.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`).

## Environment

See `.env.example` for the full list. Core: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `SESSION_SECRET`, Mailgun (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `FROM_EMAIL`, `MAILGUN_WEBHOOK_SIGNING_KEY`), Twilio (`TWILIO_*`), Stripe (`STRIPE_*`), `CRON_SECRET`, `OPERATIONS_SECRET`, and the safety switches `PAYMENTS_TEST_ONLY` / `COMMUNICATIONS_TEST_ONLY`.

## Deployment

Docker image (`Dockerfile`, Next standalone output) on a Hostinger VPS behind Coolify, with PostgreSQL 16 in its own container. Current production details, release steps and rollback targets are in `DEPLOYMENT_READINESS.md`; operational scripts are in `ops/`. An external scheduler calls the `/api/cron/*` endpoints.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
