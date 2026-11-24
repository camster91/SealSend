# Running SealSend on Cloudflare Workers

SealSend can build as a Cloudflare Worker (vinext) next to the Docker image. Both builds come from the same code. Production is still the Docker image on the VPS until the cutover below is done.

## How it works

| Piece | Docker / VPS | Cloudflare Worker |
| --- | --- | --- |
| Build | `npm run build` | `npm run build:vinext` |
| Uploads | `uploads/` folder | R2 bucket `sealsend-uploads` (binding `UPLOADS`) |
| Image resizing | sharp | Cloudflare Images (binding `IMAGES`) |
| Database | PostgreSQL (`main` today) | D1 (binding `DB`); local dev and tests use a SQLite file (`SQLITE_PATH`). See `docs/d1-port.md` |
| Webhook delivery safety check | DNS lookup that refuses private addresses | DNS-over-HTTPS check, no redirects |
| Cron jobs | VPS crontab (`ops/sealsend-maintenance.cron`) | Cron Triggers (`cloudflare.config.ts` + `worker/index.ts`) |
| Mailgun / Twilio | `fetch` clients (same code on both) | same |
| Client IP for rate limits | `TRUST_PROXY_HEADERS` | `TRUST_CF_CONNECTING_IP` (set in `cloudflare.config.ts`) |

The Worker build needs Node 22 or newer (the Docker image still uses Node 20).

Modules that differ by platform live in pairs: `name.ts` (Node) and `name.cloudflare.ts` (Worker). `vite.config.ts` swaps them in only for the Worker build. `tests/readiness.test.mjs` checks each pair exports the same names. Keep them in step when you change one.

## What must be decided first

1. **Where the database lives.** Decided: Cloudflare D1, so everything runs on Cloudflare's free plan. Production data is copied from Postgres at cutover (`docs/d1-port.md`, phase 5).
2. **The domain.** Cut over `sealsend.app` only after a `workers.dev` rehearsal passes.

## One-time setup

Sign in with `cf auth`, then:

```bash
cf r2 buckets create --name sealsend-uploads
cf d1 create --name sealsend-db      # note the database id
export D1_DATABASE_ID=<id from above>
cf d1 query "$D1_DATABASE_ID" --sql "$(cat src/lib/db/schema.sql)"   # idempotent; re-run after schema changes
```

Set every secret listed in `cloudflare.config.ts` (`SECRET_NAMES`) with `cf workers secrets update <NAME>`.
Use `cf workers secrets bulk` for many at once. The list matches `.env.example`; copy the values from Coolify.
A declared secret that is not set is only a warning locally; check what your deploy does before the cutover.

Not exposed yet (code defaults apply): `REMINDER_*`, `STALE_DRAFT_*`, `EMAIL_DAILY_LIMIT_PER_ACCOUNT`, `*_ESTIMATED_COST_MICROS`, `DEFAULT_COUNTRY`, `ALERT_DELIVERY_*`, `STRIPE_ORGANIZER_*_PRICE_ID`. Add a name to `SECRET_NAMES` (or `PLAIN_VALUES`) to expose it.

`NEXT_PUBLIC_*` values are compiled into the browser code at build time. Export them in the shell that runs the build.

## Rehearse locally (no Cloudflare account needed)

```bash
SEALSEND_TARGET=cloudflare npx vite build   # npm run build:vinext does the same
SEALSEND_TARGET=cloudflare npx vite preview --port 4173
```

Put test values in a `.dev.vars` file (it is git-ignored). `vite preview` serves the `DB` binding from Cloudflare's local D1 state (Miniflare), not `SQLITE_PATH`: apply `src/lib/db/schema.sql` to it before testing database pages (for example with `cf d1 query --local`). The Node QA harness (`npx tsx scripts/test/start-social-qa.ts`) seeds a throwaway SQLite file for `next dev` instead.

Checked this way in the Workers runtime: public and database-backed pages, upload then resize to WebP then R2 then download, path-traversal attempts, Stripe webhook signature (valid, forged, stale), the Mailgun request.
Not checked: real D1, real R2 and Images, Cron Triggers, Twilio against the live API.

## Move existing uploads

Keys keep the same layout as the old folder, so `/uploads/<userId>/<file>` URLs in the database keep working.
Copy with any S3 tool using R2 credentials from `cf r2 temporary-credentials`:

```bash
rclone sync ./uploads r2:sealsend-uploads --progress
```

Private album photos live under `<userId>/social-private/` and are never served by `/uploads/*`.

## Deploy and cut over

1. `npm run deploy:vinext` to a `workers.dev` URL. Click through sign-in, create an event, upload a cover, RSVP, check-in, and wait for the next webhook cron tick.
2. Stripe, Mailgun and Twilio webhook URLs use `https://sealsend.app/...`, so they do not change if the domain moves.
3. Point `sealsend.app` at the Worker (custom domain on the Worker).
4. Remove the `webhooks`, `delete-accounts` and `cleanup-uploads` lines from the VPS crontab. Leave the backup and health lines. Do not run both schedulers.
5. Keep the VPS container stopped, not deleted, for a week.

Rollback: point DNS back to the VPS and re-enable the crontab lines. Uploads made while on Cloudflare are in R2 only, so copy them back with `rclone` first if the rollback is after real uploads.

## Cron jobs

Only the jobs that are enabled on the VPS are scheduled. Reminders, announcements, host lifecycle and draft cleanup stay off until their provider and retention gates pass. To enable one, add its route to `CRON_ROUTES` in `worker/index.ts` and a matching `triggers.scheduled(...)` in `cloudflare.config.ts` (a test keeps them in sync).

## Known limits

- Cloudflare Images bills per unique transformation. Uploads and album photos each use one.
- `next/image` runs without an optimizer, so images are served as they are stored.
- D1 free plan: 5 GB storage, 5 million rows read and 100,000 rows written per day. Watch usage after launch.
