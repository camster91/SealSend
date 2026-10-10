# First-party growth measurement

Collection starts after the additive `scripts/release/marketing-measurement.sql` migration and application release. Fresh local databases receive the same table through schema.sql. No historical pageviews or acquisition channels are reconstructed.

## Definitions

Eligible pageviews are anonymous GET document requests with browser navigation/document Fetch Metadata headers to the explicit public marketing allowlist. They are requests, not unique people or guaranteed successful page renders. Signed-in sessions, known bots, RSC/prefetch requests, and DNT/GPC privacy opt-outs are excluded. Bot filtering is best effort. Client navigation without a document request is not counted as another landing view. Native and public QA normally send DNT: 1.

Daily counters contain only UTC day, public path, approved broad channel and count. Retention is 180 days; the next eligible write prunes older counters. No visitor ID, IP, arbitrary campaign value, full referrer, cookie or browser storage is retained by this measurement. Existing essential session and abuse-prevention records are separate.

Source labels are direct, organic_search, social, email, referral or unknown. Supported UTM mediums and known referrer domains map to broad labels. Unknown campaign values stay unknown. An explicit source query accepts only these labels. Attribution survives client navigation within the marketing layout and follows the signup link. A fresh document reload can reset it to direct; copied links can influence it. These are approximate attribution signals, not independently verified origins.

New email signup verification may add the broad channel to account_created. Existing login flows and historical signups remain unknown. DNT/GPC suppress source attribution without suppressing essential account/product milestones. Signup code requests alone do not count as accounts. Guests are excluded from the owner signup cohort.

## Reporting

GET /api/operations/growth requires the existing OPERATIONS_SECRET bearer authorization. Unauthenticated requests return 404; all responses are private/no-store. Keep the secret out of browser code, logs and reports. The aggregate response contains no identities, event titles or guest links.

The window covers the current UTC day and preceding 29 days, through the report time for account events. Pageviews are daily totals and cannot be divided into signup counts to claim a person-linked visitor conversion rate. Signup cohorts deduplicate current host accounts; deleted or null-user telemetry is excluded. Publication and first-RSVP milestones must occur after signup and no later than the report time. Multiple events belonging to one host do not inflate host counts.

Seven-day mature cohorts include accounts at least seven days old. Progress is counted through the report time, not restricted to the first seven days. Numerator and denominator are explicit; an empty denominator gives null, not zero percent. Recorded telemetry may include historical QA. It is not evidence of paying customers or genuine demand. Missing telemetry means unobserved progress.

## Release and operation

Before migration, preserve a named database/config/uploads backup and rollback image. Apply the additive SQL without changing provider, payment or messaging settings. Revert the application to its preserved image if needed; leave the anonymous table intact. Collection fails open so a database error does not break page navigation. The report fails closed with a generic 503 when unavailable.

Check types, lint, unit tests, isolated PostgreSQL/HTTPS fixtures and browser signup attribution before pushing. Verify exact protected CI and deployed commit, unauthenticated report denial, public page health and aggregate-only report output after release. Keep runtime release evidence in the GitHub task rather than inventing customer outcomes in this document.

Review genuine acquisition and activation evidence weekly, with a clear distinction between traffic requests, accounts, host activation and pilot/customer validation. Search Console access and real-host feedback remain separate acquisition work.
