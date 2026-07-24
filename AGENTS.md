# AGENTS.md

See `CLAUDE.md` for the full architecture overview, project structure, and standard commands (`npm run dev`, `npm run build`, `npm run lint`, etc.).

## Cursor Cloud specific instructions

The product is a single Next.js app (port 3000) backed by PostgreSQL. There is no separate backend — all API routes live under `src/app/api/*`. Email (Mailgun), SMS (Twilio), and Stripe are NOT configured in this environment; only the DB-backed core flows work locally.

### Startup caveats (do this each session)
- PostgreSQL is installed and its data (the `sealsend` database, schema, and a seeded admin) persists in the VM snapshot, but it does NOT auto-start. Start it before running the app: `sudo pg_ctlcluster 16 main start` (idempotent; ignore "already running").
- Local config lives in `.env.local` (untracked, persisted in the snapshot): `DATABASE_URL=postgresql://sealsend:sealsend@localhost:5432/sealsend` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Without `NEXT_PUBLIC_SITE_URL` the app defaults to the production URL.
- Then `npm run dev` (Turbopack, ready in ~1s).

### Database
- The schema is `src/lib/db/schema.sql`. `runMigrations()` in `src/lib/db/migrate.ts` is defined but NOT called anywhere automatically. If you change the schema, apply it manually: extensions need superuser (`sudo -u postgres psql -d sealsend -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto";'`) then `PGPASSWORD=sealsend psql -h localhost -U sealsend -d sealsend -f src/lib/db/schema.sql`.

### Auth for local testing (no email/SMS)
- Admin password login is the reliable path. Seeded admin: `host@sealsend.local` / `HelloWorld123!` (log in via `/login` → "Password" method). `admin_users.password` is NOT NULL, and `npm run create-admin` only inserts an email, so that script fails against this schema — instead seed an admin by inserting an email + a bcryptjs hash (SALT_ROUNDS=14, see `src/lib/password.ts`).
- Email/SMS OTP: `/api/auth/send-code` stores the 6-digit code in the `auth_codes` table BEFORE sending, but returns HTTP 500 because Mailgun/Twilio are unconfigured (so the login UI won't advance). To complete OTP login programmatically, read the code from `auth_codes` and POST it to `/api/auth/verify-code`.

### Known pre-existing app issue (not an environment problem)
- The responses/analytics code orders by `rsvp_responses.submitted_at`, a column that does not exist in `schema.sql`, so `GET /api/events/[eventId]/responses` and the analytics page return 500. RSVP submission and the public invitation flow themselves work fine.

### Verified working
- `npm run lint` → 0 errors (~44 warnings, expected). `npm run dev` serves on `:3000`. End-to-end: admin login → create + publish event via the wizard → public `/e/[slug]` guest RSVP submission (persists to `rsvp_responses`).
