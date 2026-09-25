# SealSend

**Digital Invitations & RSVP Platform**

SealSend is a modern, high-performance SaaS platform for creating, sending, and tracking digital invitations with robust RSVP management. Built for event organizers who need reliability, elegance, and powerful automation.

## Features

### Authentication
- **Passwordless Login:** 6-digit SMS or Email OTP authentication
- **Secure Sessions:** JWT-based session management
- **Multi-device Support:** Seamless login across devices

### Event Management
- **Dynamic Dashboards:** Dedicated views for event hosts and guests
- **Custom Invitations:** Beautiful, customizable digital invitations
- **Guest Lists:** Manage guests, plus-ones, and dietary restrictions
- **QR Codes:** Automatic QR code generation for event entry

### RSVP Tracking
- **Real-time Metrics:** Track attendance, plus-ones, and responses
- **Automated Reminders:** Scheduled dispatch of event updates
- **Guest Communication:** SMS and email notifications via Twilio/Mailgun

### Integrations
- **Payment Processing:** Stripe integration for premium features
- **Calendar Export:** Add events to Google, Apple, or Outlook calendars

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16 (raw SQL via `pg`) |
| Authentication | Custom database-backed sessions, email/SMS OTP |
| Styling | Tailwind CSS 4 + Radix UI primitives |
| SMS | Twilio |
| Email | Mailgun |
| Payments | Stripe |
| Deployment | Docker / Coolify |

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Twilio, Mailgun and Stripe accounts (test credentials are fine for local work)

## Installation

```bash
git clone https://github.com/camster91/SealSend.git
cd SealSend
npm install
cp .env.example .env.local   # then fill in values; see comments in .env.example
```

Keep `PAYMENTS_TEST_ONLY=true` and `COMMUNICATIONS_TEST_ONLY=true` outside production.

### Database Setup

```bash
# Fresh database
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/db/schema.sql

# Upgrading an existing database (idempotent)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply-security-indexes.sql
```

## Usage

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
```

## Testing

```bash
npm run typecheck
npm run lint        # zero warnings allowed
npm test            # unit and readiness tests
npm run test:e2e    # Playwright
npm run test:config # check provider configuration
npm run test:email  # send a test email
npm run test:sms    # send a test SMS
```

## Deployment

SealSend ships as a Docker image (`Dockerfile`) and runs on a VPS under Coolify with PostgreSQL in a separate container. `docker-compose.yml` runs the stack locally.

Release steps, current production state and rollback targets are in `DEPLOYMENT_READINESS.md`. Backup, health-check, maintenance and release-rehearsal scripts are in `ops/`.

## Documentation

- `CLAUDE.md` - Codebase guide (architecture, auth, database, conventions)
- `DEPLOYMENT_READINESS.md` - Release status and production runbook
- `docs/launch-operations.md` - Beta and launch operations
- `docs/paid-beta-evidence-register.md` - Launch evidence
- `docs/AUTOMATIC_REMINDERS.md` - Reminder scheduling

## Roadmap

- [ ] GlowOS integration for AI-generated event descriptions
- [ ] Premium tiers with 24-hour token reset model
- [ ] Advanced automated follow-ups
- [ ] Calendar integration improvements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a Pull Request

## License

MIT. See [LICENSE](LICENSE).

---
Developed by Cameron Ashley / Nexus AI.
