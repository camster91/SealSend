# CLAUDE.md - SealSend Codebase Guide

## What is SealSend?

SealSend is a modern digital invitation and RSVP management platform (competitor to Evite, 50% cheaper pricing). Users create beautiful event invitations, send them via email/SMS, and manage guest RSVPs with tracking and analytics. Live at https://sealsend.app.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router) with React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 with custom design tokens in `globals.css`
- **Database**: PostgreSQL via `pg` (raw SQL, no ORM)
- **Auth**: Custom JWT sessions with email/SMS OTP (6-digit codes) + password login for admins
- **Email**: Resend (primary), Mailgun (legacy fallback)
- **SMS**: Twilio with phone validation via `libphonenumber-js`
- **Payments**: Stripe (per-event checkout + subscription billing)
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation
- **Images**: Sharp for optimization, QR code generation

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (use this to verify changes)
npm run lint         # ESLint (currently 0 errors, ~50 warnings)
npm run test:email   # Test email sending
npm run test:sms     # Test SMS sending
npm run test:all     # Run all tests
npm run create-admin # Create admin user via CLI
```

## Project Structure

```
src/
  app/
    (marketing)/          # Public pages: homepage, pricing, how-it-works, use-cases, terms, privacy
    (auth)/               # Auth pages: login, signup, forgot-password
    (dashboard)/          # Protected pages: dashboard, events/[eventId]/*, settings
    api/                  # API routes (~25 endpoints)
      auth/               # send-code, verify-code, login-password, logout, change-password
      events/             # CRUD, send-invites, responses, guests, comments, signups, QR
      checkout/           # Per-event Stripe checkout (silver/gold/platinum/diamond)
      subscriptions/      # Subscription-based Stripe checkout (pro/business)
      webhooks/           # Stripe, Twilio, Resend delivery tracking
      cron/               # send-reminders, cleanup-drafts
    e/[slug]/             # Public event invitation pages
  components/
    ui/                   # Reusable primitives: Button, Card, Input, etc.
    auth/                 # Login/signup forms
    marketing/            # Hero, Features, Testimonials, CTA sections
    dashboard/            # Event management, stats, actions
    events/wizard/        # Multi-step event creation wizard
    public-event/         # Public invitation page components
    pricing/              # Pricing cards, comparison, FAQ
    features/             # FeatureGate (tier-based access control), UpgradePrompt
    responses/            # RSVP tracking components
    guests/               # Guest list, CSV import
  lib/
    auth/                 # Session management, client-auth helpers, auth-service
    db/                   # PostgreSQL client (client.ts), schema (schema.sql)
    email-templates.ts    # HTML email builder
    sms-templates.ts      # SMS message builder
    stripe.ts             # Stripe checkout session creation
    subscription.ts       # getUserTier, getTierLimits
    constants.ts          # BETA_MODE, FEATURE_FLAGS, SUBSCRIPTION_TIERS, TIERS
    password.ts           # bcrypt hash/verify, strength checker
    phone-validation.ts   # Phone formatting/validation
    rate-limit.ts         # Rate limiting utility
    sanitize.ts           # Input sanitization
    validations.ts        # Zod schemas for API validation
  types/
    database.ts           # TypeScript interfaces for all DB tables
  middleware.ts           # Auth middleware (route protection)
```

## Key Architectural Patterns

### Authentication
- **Regular users**: Email/SMS OTP (no passwords). Code sent via `/api/auth/send-code`, verified via `/api/auth/verify-code`.
- **Admin users**: Password-based login via `/api/auth/login-password`. Stored in separate `admin_users` table.
- **Sessions**: `sealsend_session` (httpOnly cookie) + `sealsend_user` (non-httpOnly for client reads). 7-day expiry.
- **Client auth**: Use `getClientUser()` from `@/lib/auth/client-auth` to read user info client-side.
- **Server auth**: Use `getCurrentUser()` from `@/lib/auth/session` or `getApiUser()` from `@/lib/auth/api-auth`.

### Database
- Raw SQL queries via `query()` and `queryOne()` from `@/lib/db/client`.
- Schema defined in `src/lib/db/schema.sql` (canonical) and `supabase/migrations/` (incremental).
- Key tables: `events`, `guests`, `rsvp_responses`, `rsvp_fields`, `send_logs`, `admin_users`, `user_sessions`, `user_subscriptions`, `auth_codes`.

### Tier System
Two parallel pricing models:
1. **Per-event tiers** (one-time payment): `free` -> `silver` ($8.99) -> `gold` ($17.99) -> `platinum` ($34.99) -> `diamond` ($49.99). Stored in `events.tier`.
2. **User subscriptions** (recurring): `free` -> `pro` (Silver, $8.99/mo) -> `business` (Gold, $17.99/mo). Stored in `user_subscriptions.tier`.

Legacy tier names `standard`/`premium` are mapped to `silver`/`gold` for backwards compatibility.

### Feature Flags
In `src/lib/constants.ts`:
- `BETA_MODE`: When true, all features free (currently `false`)
- `FEATURE_FLAGS.subscriptions`: Subscription billing enabled (`true`)
- `FEATURE_FLAGS.analytics`: Advanced analytics enabled (`true`)
- `FEATURE_FLAGS.teams/templates/aiAssistant`: Not yet implemented (`false`)

### Feature Gating
`FeatureGate` component (`src/components/features/FeatureGate.tsx`) wraps features behind subscription tiers. Modes: `overlay`, `banner`, `hide`. All gates bypass when `BETA_MODE` is true.

### Stripe Integration
- Per-event checkout: `/api/checkout` -> `createCheckoutSession()` in `lib/stripe.ts`
- Subscription checkout: `/api/subscriptions/checkout` -> Stripe subscription session
- Webhooks: `/api/webhooks/stripe` handles `checkout.session.completed`, `subscription.updated/deleted`, `invoice.payment_failed`

## Environment Variables

Required (see `.env.example` for full list):
- `DATABASE_URL` - PostgreSQL connection string
- `RESEND_API_KEY`, `FROM_EMAIL` - Email sending
- `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_MESSAGING_SERVICE_SID` - SMS
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `CRON_SECRET` - Cron job authentication (Bearer token)
- `NEXT_PUBLIC_SITE_URL` - Base URL (e.g., https://sealsend.app)

## Development Conventions

### Code Style
- TypeScript strict mode
- Tailwind CSS for styling (no CSS modules)
- Lucide React for icons
- `cn()` utility from `@/lib/utils` for conditional class merging
- Zod for API request validation
- No ORMs - raw SQL with parameterized queries only

### API Routes
- Always validate with Zod schemas
- Use `getApiUser()` for authentication
- Return JSON responses with appropriate status codes
- Rate limit sensitive endpoints with `rateLimit()` from `@/lib/rate-limit`

### Components
- Client components: `"use client"` directive at top
- Server components: default (no directive needed)
- UI primitives in `src/components/ui/` extend HTML element attributes via `forwardRef`
- `useSearchParams()` must be wrapped in `<Suspense>` boundary

### Database Migrations
- Files in `supabase/migrations/` ordered by timestamp prefix
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- CHECK constraints on tier columns: events allows `free/silver/gold/platinum/diamond/standard/premium`

### Git Conventions
- Branch: `claude/finish-app-HDak6` for current development
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`)
- Build must pass (`npm run build`) before pushing

## Deployment

- **Hosting**: Docker on Coolify (VPS)
- **Build**: `Dockerfile` + `docker-compose.yaml` for local dev
- **Database**: Self-hosted PostgreSQL (migrated from Supabase)
- **Cron**: External service calls `/api/cron/*` endpoints with `Authorization: Bearer {CRON_SECRET}`

## Known Limitations

- Teams/collaboration features: defined in schema but not implemented in UI
- Template gallery: feature flag disabled, not built
- AI design assistant: feature flag disabled, not built
- Social login (Google OAuth): not implemented
- Use-case page images (`public/use-cases/*.jpg`) don't exist yet
- `console.log` statements remain in cron/webhook handlers (intentional for debugging)
