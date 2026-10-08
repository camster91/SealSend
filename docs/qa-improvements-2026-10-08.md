# October 8 QA improvements

The real Community Night journey exposed a mismatch between the shipped default
questions and canonical RSVP fields: a decline saved as attending, and a party of
two counted as one. Reserved default and legacy questions now map to canonical
attendance, headcount, name and email. Arbitrary custom choices retain their
meaning. Existing responses are not rewritten; ambiguous historical answers need
separate inspection before any correction.

New responses close at the RSVP deadline inside the serialized transaction.
Respondents with existing valid editing credentials may still update their reply.
The form shows this distinction, one name input, saved attendance and party size,
and how browser-based editing works. Reduced-motion invitations remain visible.

Authorized hosts can manually check in public-link respondents alongside invited
guests. Public replies remain RSVP identities: this does not create guest access
credentials. A party is checked in together; displayed totals count entries.
Check-in persists with actor and timestamp, is event-scoped and audited, and adds
source/headcount to the existing webhook DTO. Failed saves retain their error and
do not claim success. See `webhooks.md` for source semantics.

Host dates use the event timezone. Overview copy distinguishes invited and public
replies. Question-summary details collapse, canonical email answers count correctly,
response loading offers retry, and check-in searches explain an empty result.
Builder looks have palette/font previews and category filters. Mobile pricing puts
its beta action sooner and the marketing links describe the beta destination.
Disabled toggle labels retain readable contrast.

## Migration and recovery

Before deploying the new check-in API, apply only the two additive statements at
the end of `apply-security-indexes.sql` (nullable `checked_in_at` and
`checked_in_by`), in a transaction with a short lock timeout and a verified backup.
The old image tolerates these extra columns. Do not rerun unrelated migrations.

The reviewed operations repairs preserve the backup schedule and retention policy,
target the verified PostgreSQL container with identity guards, and permit route-sync
to write to its actual output directory while retaining its sandbox protections.
Installing a cron script and testing its backup do not prove a future scheduled run.

## Validation and remaining evidence

Unit checks exercise canonical/legacy fields, deadlines, authorization, event
isolation, public check-in persistence, actor identity and summary accuracy.
Native PostgreSQL browser QA publishes an actual template, declines, edits to a
two-person party, checks host totals/timezone and public check-in after reload,
then verifies cutoff UI/API and existing edits. It checks default/legacy form
accessibility at 375, 768 and 1440 pixels, alongside the existing sharing, camera,
social, builder and template regressions. Required CI must pass before merge.

Production dependencies audit clean. Development tooling includes the unpatched
braces advisory GHSA-vfj7-8cjw-p6xm through ESLint's glob dependencies. An unsafe
framework downgrade is not a repair. Track the upstream patch separately.

Physical-phone QR decoding, assistive-technology devices, actual provider delivery,
payment settlement and real customer acceptance require separate evidence.
Preserve payment/SMS/cleanup launch gates; do not infer 100% readiness from host QA.
