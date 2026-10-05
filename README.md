# SealSend

Digital invitations with RSVP tracking, guest messaging and check-in, for one-off hosts and event planners.

SealSend lets a host design an invitation, send it by email or SMS, and watch responses come in. Guests RSVP from a public event page without creating an account. Planners who run events for clients get team workspaces, their own branding, client review links and webhooks into their other tools. It is a full-stack Next.js app backed by PostgreSQL, with Stripe billing and Mailgun/Twilio delivery.

## Features

**Events and invitations**
- Step-by-step event wizard: details, design upload, customization, custom RSVP fields, guest list and preview
- Optional AI draft: describe the event and get a structured draft for the host to review; the model is told not to invent venues, prices or dates, and every assumption is flagged for confirmation (OpenAI, with a non-AI fallback)
- Event templates, one-click clone for repeat events, and a publish readiness check before invitations go out
- Public event page with add-to-calendar (Google, Apple, Outlook / `.ics`), comments and a sign-up board

**Guests and RSVPs**
- Guest list with CSV import (partial imports and duplicate detection), tags, plus-ones and custom questions
- Response table, RSVP summary and analytics, CSV export
- Email and SMS invitations, reminders (manual or automatic) and announcements with audience selection and SMS cost preview
- Per-guest magic links and QR codes, plus a check-in screen for the door

**For event organizers**
- Workspaces with owner, admin, planner and check-in roles
- Brand kit: logo, colours, email sender name and SMS signature on every event
- Clients: client records, read-only review links with live RSVP totals, recorded approvals and per-client history
- Signed webhooks for RSVPs, check-ins, publishing and client approvals, for Zapier, Make or your own CRM ([docs](docs/webhooks.md))

**Accounts, billing and safety**
- Passwordless sign-in with 6-digit email or SMS codes (password sign-in also supported), database-backed sessions
- Stripe billing for a free tier, one-time Event Pass, annual Pro and SMS top-ups. During the controlled beta (`BETA_MODE` in `src/lib/constants.ts`) paid checkout is turned off and every account gets the beta plan
- Test-only switches for payments and outbound messages, plus opt-out and suppression handling for SMS and email
- Account data export and deletion, rate limiting, upload quotas, and a Content Security Policy with HSTS and `frame-ancestors 'none'`
- Web app manifest, so it can be added to a home screen

## Tech stack

| Area | Technology |
|------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16 with raw SQL via `pg` |
| Styling and UI | Tailwind CSS 4, Radix UI Tooltip, Framer Motion, Lucide icons |
| Forms and validation | React Hook Form, Zod |
| Email / SMS | Mailgun, Twilio |
| Payments | Stripe |
| AI drafts | OpenAI Responses API (structured JSON output) |
| Testing | Node test runner with `tsx`, Playwright, axe-core |
| Packaging | Docker (multi-stage `Dockerfile`) |

## Getting started

Prerequisites: Node.js 20+, PostgreSQL 16, and Mailgun, Twilio and Stripe accounts (test credentials are fine for local work).

```bash
git clone https://github.com/camster91/SealSend.git
cd SealSend
npm install
cp .env.example .env.local   # fill in values; see comments in .env.example
```

Keep `PAYMENTS_TEST_ONLY=true` and `COMMUNICATIONS_TEST_ONLY=true` outside production.

Set up the database:

```bash
# Fresh database
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/db/schema.sql

# Upgrading an existing database (idempotent)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply-security-indexes.sql
```

Run it:

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
```

`docker-compose.yml` builds and runs the web container (point `DATABASE_URL` at your PostgreSQL instance).

## Testing

```bash
npm run typecheck
npm run lint          # zero warnings allowed
npm test              # unit and readiness tests
npm run test:e2e      # Playwright end-to-end, accessibility and visual tests
npm run test:config   # check provider configuration
npm run test:email    # send a test email
npm run test:sms      # send a test SMS
```

## Project structure

```
src/
  app/
    (marketing)/   public site: home, pricing, use cases, legal
    (auth)/        sign-in, sign-up, password reset
    (dashboard)/   events, guests, responses, check-in, settings
    e/[slug]/      public event and RSVP page
    client/        client review links
    api/           route handlers (events, RSVPs, billing, webhooks, cron)
  components/      UI, wizard, dashboard and public-event components
  lib/             auth, db, email/SMS, billing, AI, webhooks, validation
tests/             unit tests and Playwright specs (tests/e2e)
scripts/           admin, beta and test utilities
docs/              feature and operations docs
```

## Documentation

- [docs/webhooks.md](docs/webhooks.md): webhook events and signature verification
- [docs/AUTOMATIC_REMINDERS.md](docs/AUTOMATIC_REMINDERS.md): reminder scheduling
- [docs/product-strategy-organizer-platform.md](docs/product-strategy-organizer-platform.md): product direction for one-off hosts and organizers

## License

GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See [LICENSE](LICENSE). Copyright (c) 2026 Cameron Ashley.

You can use, modify and self-host SealSend. If you run a modified version as a network service, you must offer every user who interacts with it the complete source of your version under the same licence. The app shows that offer through `SourceCodeLink` (marketing footer, dashboard and sign-in pages); set `NEXT_PUBLIC_SOURCE_CODE_URL` to your own repository, and add the link to guest-facing pages (`/e/[slug]`, invitations, `/client/[token]`) too if your version changes them.

Code published before the switch to AGPL on 2026-09-26 (up to commit `7361786`) was released under MIT, and copies obtained under that licence keep it.

---

Built by Cameron Ashley ([Ashbi Design](https://ashbi.ca)).
