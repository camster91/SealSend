# Running SealSend on Cloudflare Workers

SealSend can build as a Cloudflare Worker (vinext) next to the Docker image. Both builds come from the same code. Production is still the Docker image on the VPS until the cutover below is done.

## How it works

| Piece | Docker / VPS | Cloudflare Worker |
| --- | --- | --- |
| Build | `npm run build` | `npm run build:vinext` |
| Uploads | `uploads/` folder | R2 bucket `sealsend-uploads` (binding `UPLOADS`) |
| Image resizing | sharp | Cloudflare Images (binding `IMAGES`) |
| Database | `pg` pool on `DATABASE_URL` | `pg` through Hyperdrive (binding `HYPERDRIVE`), one pool per request |
| Webhook delivery safety check | DNS lookup that refuses private addresses | DNS-over-HTTPS check, no redirects |
| Cron jobs | VPS crontab (`ops/sealsend-maintenance.cron`) | Cron Triggers (`cloudflare.config.ts` + `worker/index.ts`) |
| Mailgun / Twilio | `fetch` clients (same code on both) | same |
| Client IP for rate limits | `TRUST_PROXY_HEADERS` | `TRUST_CF_CONNECTING_IP` (set in `cloudflare.config.ts`) |

The Worker build needs Node 22 or newer (the Docker image still uses Node 20).

Modules that differ by platform live in pairs: `name.ts` (Node) and `name.cloudflare.ts` (Worker). `vite.config.ts` swaps them in only for the Worker build. `tests/readiness.test.mjs` checks each pair exports the same names. Keep them in step when you change one.

## Decisions made

1. **Database: Neon** (managed Postgres 16). Hyperdrive connects to it and pools connections, so the app keeps using `pg`.
2. **The domain.** Cut over `sealsend.app` only after a `workers.dev` rehearsal passes.

## Neon setup

1. Create a Neon project on Postgres 16, in the region closest to your users (for example AWS US East). Turn off any "scale to zero" setting if offered, or accept a slower first query after idle time.
2. Create a dedicated role for the app. Do not use the owner role.
3. Copy the **direct** (non-pooled) connection string, the one without `-pooler` in the host name, with `sslmode=require`. Hyperdrive does its own pooling, and Neon's pooler can break session settings.
4. Create the Hyperdrive config from that string (see One-time setup below) and keep the string out of the repo.

## Move the data from the VPS to Neon

Rehearse this first with a copy, then repeat for the real cutover.

```bash
# On the VPS (the existing backup script already writes custom-format dumps)
pg_dump --format=custom --no-owner --no-privileges --dbname="$VPS_DATABASE_URL" --file=sealsend.dump

# Restore into Neon. --no-owner avoids role errors; extensions listed in schema.sql must be allowed on Neon.
pg_restore --no-owner --no-privileges --dbname="$NEON_DIRECT_URL" sealsend.dump

# Then apply the idempotent upgrade file so Neon matches production
psql -v ON_ERROR_STOP=1 "$NEON_DIRECT_URL" -f apply-security-indexes.sql
```

Checks before cutover: row counts of `admin_users`, `events`, `guests`, `rsvp_responses` and `upload_assets` match the VPS; sign in works against the rehearsal Worker; `/api/health` returns `ok`.

Cutover order, to avoid losing writes: put the VPS app in maintenance (or stop it), take the final dump, restore, point the Worker at Neon, switch DNS, then remove the VPS cron lines. Keep the VPS database untouched for a week as the rollback copy. Writes made on Neon after cutover would need to be copied back if you roll back.

## One-time setup

Sign in with `cf auth`, then:

```bash
cf r2 buckets create --name sealsend-uploads
cf hyperdrive create --help          # create a config from the Neon direct connection string; note the ID
export HYPERDRIVE_ID=<id from above>
```

Set every secret listed in `cloudflare.config.ts` (`SECRET_NAMES`) with `cf workers secrets update <NAME>`.
Use `cf workers secrets bulk` for many at once. The list matches `.env.example`; copy the values from Coolify.
A declared secret that is not set is only a warning locally; check what your deploy does before the cutover.

Not exposed yet (code defaults apply): `REMINDER_*`, `STALE_DRAFT_*`, `EMAIL_DAILY_LIMIT_PER_ACCOUNT`, `*_ESTIMATED_COST_MICROS`, `DEFAULT_COUNTRY`, `ALERT_DELIVERY_*`, `STRIPE_ORGANIZER_*_PRICE_ID`. Add a name to `SECRET_NAMES` (or `PLAIN_VALUES`) to expose it.

`NEXT_PUBLIC_*` values are compiled into the browser code at build time. Export them in the shell that runs the build.

## Rehearse locally (no Cloudflare account needed)

```bash
npx tsx scripts/test/start-social-qa.ts     # seeded throwaway database on 127.0.0.1:55432
export HYPERDRIVE_LOCAL_CONNECTION_STRING=postgresql://postgres:postgres@127.0.0.1:55432/postgres
SEALSEND_TARGET=cloudflare npx vite build   # npm run build:vinext does the same
SEALSEND_TARGET=cloudflare npx vite preview --port 4173
```

Put test values in a `.dev.vars` file (it is git-ignored). The sign-in cookie `sealsend_session=social-local-host-session` works against the seeded database.

Checked this way in the Workers runtime: public and database-backed pages, upload then resize to WebP then R2 then download, path-traversal attempts, Stripe webhook signature (valid, forged, stale), the Mailgun request.
Not checked: real Hyperdrive, real R2 and Images, Cron Triggers, Twilio against the live API.

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
- Each request opens its own database connections; check Hyperdrive connection usage after launch.
