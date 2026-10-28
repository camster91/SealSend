# Porting SealSend from Postgres to Cloudflare D1

Goal: run SealSend on Cloudflare's free plan only (Workers, D1, R2, Images, Cron Triggers). D1 (SQLite) becomes the only database. Production keeps running today's `main` on the VPS with Postgres until the cutover at the end.

## Decisions

- **One dialect.** All SQL is SQLite. Local dev, tests and scripts use a SQLite file through `node:sqlite` (Node 22.13+); the Worker uses the D1 binding `DB`. Postgres support is removed, not kept in parallel.
- **Queries keep `$1` placeholders.** The clients rewrite them to `?1`, which SQLite binds the same way (a placeholder can repeat).
- **Rows keep their JS types.** SQLite returns 0/1, strings and JSON text. `src/lib/db/sqlite-dialect.ts` decodes by column name back to booleans, `Date`s and parsed JSON, so most call sites don't change. No column name is used with two different types (a test checks this). Aliased columns (`MAX(created_at) AS last_seen`) are **not** decoded; handle those at the call site.
- **No interactive transactions.** D1 runs a batch of statements atomically but can't read in the middle of a transaction. Flows that used `BEGIN … SELECT … FOR UPDATE … COMMIT` are rewritten as one conditional statement, or as a `batch` whose statements carry their own guards.

## Storage rules (`src/lib/db/schema.d1.sql`)

| Postgres | D1 | Notes |
| --- | --- | --- |
| `UUID` + `gen_random_uuid()` | `TEXT` + SQL v4 UUID default | |
| `TIMESTAMPTZ` + `NOW()` | `TIMESTAMP_TEXT`, ISO-8601 UTC (`2026-10-28T14:00:00.000Z`) | Same format as `Date.toISOString()`, so text order is time order. `SQL_NOW` is the SQL for "now". |
| `BOOLEAN` | `BOOLEAN` storing 0/1 | Bound `true`/`false` become 1/0. |
| `JSONB`, `TEXT[]` | `JSON_TEXT` | Bound arrays/objects become JSON text. |
| `DATE` | `DATE_TEXT` (`YYYY-MM-DD`) | Not decoded: stays a string. |
| `BIGINT`, `BIGSERIAL` | `INTEGER`, `INTEGER PRIMARY KEY AUTOINCREMENT` | pg returned bigint as a string; now it's a number. |
| `~ 'regex'` checks | `GLOB` + `length()` | SQLite/D1 have no regex. |
| PL/pgSQL triggers | SQLite triggers | `events_default_organization` now runs **after** insert, so `INSERT … RETURNING organization_id` returns NULL. |

`scripts/db/generate-d1-schema.mjs` regenerates the schema from `schema.sql` + `apply-security-indexes.sql` (through PGlite) while those files exist. After the port, `schema.d1.sql` is edited by hand.

## Query rewrite cheat sheet

| Postgres | SQLite |
| --- | --- |
| `NOW()`, `now()` | `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (`SQL_NOW`), or bind `new Date()` |
| `NOW() - INTERVAL '15 minutes'` | `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')` |
| `$1::uuid`, `::text`, `::int`, `::jsonb` | drop the cast (`CAST(x AS INTEGER)` when a number is really needed) |
| `= ANY($1)` with a JS array | `IN (SELECT value FROM json_each($1))` |
| `col->>'key'`, `jsonb_build_object` | `json_extract(col, '$.key')`, `json_object` |
| `DISTINCT ON (a) … ORDER BY a, b` | `ROW_NUMBER() OVER (PARTITION BY a ORDER BY b)` in a subquery |
| `COUNT(*) FILTER (WHERE …)` | works as is (SQLite 3.30+) |
| `generate_series` | recursive CTE |
| `to_char(ts, …)` | `strftime(…)` |
| `ILIKE` | `LIKE` (case-insensitive for ASCII) |
| `SELECT … FOR UPDATE` then `UPDATE` | single `UPDATE … WHERE <guard> RETURNING …`; zero rows means you lost the race |
| `pg_advisory_xact_lock` | a claim row with a unique key (`INSERT … ON CONFLICT DO NOTHING RETURNING`) |
| `BEGIN … COMMIT` | `batch([...])` |
| `sealsend_personal_organization($1)` | TypeScript helper doing the same three statements in a batch |

D1 limits to remember: 100 bound parameters per statement (chunk multi-row inserts such as guest import), 100 KB per SQL statement, 30 s per query.

## Phases

1. **Foundation (this PR).** `schema.d1.sql` + generator, `sqlite-dialect.ts`, `client.sqlite.ts` (Node) and `client.d1.ts` (Worker), and `tests/sqlite-dialect.test.ts`. The app still runs on Postgres; nothing is swapped yet.
2. **Swap + simple queries.** Rename the new clients over `client.ts` / `client.cloudflare.ts`, replace `HYPERDRIVE` with a D1 binding in `cloudflare.config.ts`, drop `runWithDbScope`, then port the read and write queries in the ~88 files without transactions. Update the readiness tests that match Postgres SQL text, plus the PGlite-based QA scripts. Move the Docker image to Node 22.13+ or retire it.
3. **The 30 transactional flows**, one at a time, each with a test. Billing and webhooks get a short write-up for review first:
   `api/webhooks/stripe`, `api/webhooks/mailgun`, `api/webhooks/twilio`, `api/rsvp/[slug]`, `api/signups/[slug]`, `api/events/[eventId]/check-in`, `api/events/[eventId]/clone`, `api/events/[eventId]/members`, `api/events/[eventId]/responses/[responseId]`, `api/events/[eventId]/rsvp-fields`, `api/events/[eventId]/announcements/[announcementId]/retry`, `api/events`, `api/organizations`, `api/organizations/[organizationId]/members`, `api/organizations/[organizationId]/members/[userId]`, `api/team-invites/[token]/accept`, `api/workspace-invites/[token]/accept`, `api/beta/outcome`, `api/beta/participation`, `api/cron/delete-accounts`, `api/cron/send-announcements`, `guest/update/[token]`, `lib/messages/dispatch-announcement`, `lib/monitoring/server-errors`, `lib/rate-limit`, `lib/rsvp-store`, `lib/social/access`, `lib/social/actions`, `lib/upload-store`, `lib/webhooks`.
4. **Rehearsal.** Create the D1 database, apply `schema.d1.sql`, deploy to `workers.dev`, and run the checks from `docs/cloudflare-migration.md`.
5. **Cutover (needs VPS access).** Copy production data from Postgres into D1 (timestamps to ISO text, booleans to 0/1, JSON to text, arrays to JSON), compare row counts, then follow the DNS steps in `docs/cloudflare-migration.md`. `schema.sql` and `apply-security-indexes.sql` are removed after this.

## Free plan fit

The Worker is about 1.1 MB gzipped (the limit is 3 MB). D1 free: 5 GB storage, 5 million rows read and 100,000 rows written per day. Workers free: 10 ms CPU per request, which heavy server-rendered pages may exceed; watch the logs during the rehearsal.
