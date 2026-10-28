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

## Transactions without locks

`guard(conditionSql, params, code)` (in `sqlite-dialect.ts`) is a batch statement that aborts the whole batch, rolling back the statements before it, unless the condition is true when it runs. D1 runs one batch at a time, so a guard sees current data and replaces "lock, check, write". Catch the error and read the code with `abortCode(error)`. Pattern for every former transaction:

1. Read and validate first.
2. Generate ids in JS (`crypto.randomUUID()`) when later statements need them.
3. Send all writes in one `batch`, with guards before the writes they protect.
4. Map a guard's code to the response the old code gave for that case. Run side effects (webhooks, activation events, emails) only after the batch succeeds.

Job claiming (`FOR UPDATE SKIP LOCKED`) becomes one `UPDATE … WHERE id IN (SELECT … LIMIT n) AND <still due> RETURNING …`; a single statement is atomic.

## Billing and provider webhooks (for review)

These four files handle money, account deletion and delivery state, so their design is written down before they change.

**Stripe (`api/webhooks/stripe`).** The receipt logic stays as it is (insert the receipt, run the handler, delete the receipt if the handler fails so Stripe retries). Most handlers are already single statements. Two use transactions:
- `syncOrganizationSubscription`: one batch of (1) the same upsert, including its `WHERE` (only replace a stored subscription that has the same id or is cancelled), and (2) `UPDATE organizations SET plan = … WHERE id = $org AND is_personal = 0 AND EXISTS (SELECT 1 FROM organization_subscriptions WHERE organization_id = $org AND stripe_subscription_id = $sub)`. After step 1 the stored id equals this subscription exactly when the upsert wrote it, so the plan changes in the same cases as before.
- `handleOrganizerInvoice`: one batch of (1) the same status update, and (2) an `UPDATE organizations SET plan = CASE (SELECT plan FROM organization_subscriptions WHERE …) WHEN 'solo' THEN … END` whose values come from `organizationPlanForSubscription()` for each plan. No read in between, so no race.

**Mailgun (`api/webhooks/mailgun`).** SQLite has no `UPDATE` inside `WITH`. New flow: (1) insert the receipt on its own (duplicate → same 200 response); (2) read the matching deliveries and send logs with their event owners; (3) one batch: the two status updates (same `CASE` rules, `trim(x, '<>')` instead of `TRIM(BOTH '<>' FROM x)`) plus the suppression upserts for bounces and complaints; (4) if the batch fails, delete the receipt and rethrow so Mailgun retries. Gap: a delivery row created between steps 2 and 3 still gets its status, but won't get a suppression from this event (rows are written at send time, long before the webhook, so this shouldn't happen in practice).

**Twilio (`api/webhooks/twilio`).** Status callbacks use the same receipt → batch → delete-on-failure flow. The send-log metadata merge becomes `metadata = json_patch(COALESCE(metadata, '{}'), $1)` in the same `UPDATE`, which removes a read-modify-write race. The "no send log" warning uses `RETURNING id`. Opt-outs go through `processTwilioOptOutEvent()` in `lib/twilio-inbound-opt-out.ts`, which builds its own batch.

**Account deletion (`api/cron/delete-accounts`).** One batch **per account** instead of one transaction for all 25:
- Guards first: the request is still pending and due, and there's no active, past-due or trialing paid subscription (code `blocked`, counted as today). Two overlapping runs can't both delete: the second one's guard fails.
- The workspace handover is computed by reads first (sole-owned team workspaces, successor = longest-serving admin, else planner). The batch then guards that each of those workspaces still has no other owner and that the successor is still a member, promotes the successors, and creates personal workspaces for the other hosts whose events sat in orphaned workspaces. It moves those events, deletes the orphaned workspaces, hands the leaver's team events to the earliest remaining owner (successors are owners by then), then runs the same deletes as today. If ownership changed in the meantime, that account is skipped and retried on the next run.
- Behaviour change: an error on one account no longer undoes the accounts already deleted in the same run. The run stops, logs and returns 500 as before.
- Upload cleanup is unchanged.

## Phases

1. **Foundation (done).** The D1 schema and its generator, `sqlite-dialect.ts`, the two SQLite clients and `tests/sqlite-dialect.test.ts`.
2. **Swap + simple queries.** The new clients are now `client.ts` (Node, `node:sqlite`) and `client.cloudflare.ts` (D1); `schema.sql` is the SQLite schema and the Postgres files moved to `src/lib/db/legacy-postgres/`; `cloudflare.config.ts` binds D1 as `DB` (`D1_DATABASE_ID`) instead of Hyperdrive. Then port the queries in the files without transactions, update the readiness tests that match Postgres SQL text, and the PGlite-based QA scripts and CLIs. Move the Docker image to Node 22.13+ or retire it. `node scripts/db/check-sql.mjs` prepares every literal query against the schema and flags Postgres-only syntax.
3. **The 30 transactional flows** (they land with phase 2, since typecheck needs both). Billing and webhooks follow the design above:
   `api/webhooks/stripe`, `api/webhooks/mailgun`, `api/webhooks/twilio`, `api/rsvp/[slug]`, `api/signups/[slug]`, `api/events/[eventId]/check-in`, `api/events/[eventId]/clone`, `api/events/[eventId]/members`, `api/events/[eventId]/responses/[responseId]`, `api/events/[eventId]/rsvp-fields`, `api/events/[eventId]/announcements/[announcementId]/retry`, `api/events`, `api/organizations`, `api/organizations/[organizationId]/members`, `api/organizations/[organizationId]/members/[userId]`, `api/team-invites/[token]/accept`, `api/workspace-invites/[token]/accept`, `api/beta/outcome`, `api/beta/participation`, `api/cron/delete-accounts`, `api/cron/send-announcements`, `guest/update/[token]`, `lib/messages/dispatch-announcement`, `lib/monitoring/server-errors`, `lib/rate-limit`, `lib/rsvp-store`, `lib/social/access`, `lib/social/actions`, `lib/upload-store`, `lib/webhooks`.
4. **Rehearsal.** Create the D1 database, apply `schema.sql`, deploy to `workers.dev`, and run the checks from `docs/cloudflare-migration.md`.
5. **Cutover (needs VPS access).** Copy production data from Postgres into D1 (timestamps to ISO text, booleans to 0/1, JSON to text, arrays to JSON), compare row counts, then follow the DNS steps in `docs/cloudflare-migration.md`. `src/lib/db/legacy-postgres/` is removed after this.

## Free plan fit

The Worker is about 1.1 MB gzipped (the limit is 3 MB). D1 free: 5 GB storage, 5 million rows read and 100,000 rows written per day. Workers free: 10 ms CPU per request, which heavy server-rendered pages may exceed; watch the logs during the rehearsal.
