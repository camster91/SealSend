# Social and mobile implementation tracker

Owner approval: Cameron, 2026-10-07. This plan builds on the approved manual builder, AI chat and AI covers. Earlier task checkboxes are historical; release evidence below determines completion.

1. Fix AI-cover pending-save and Cancel focus review findings; test before generation spends quota.
2. Add event-scoped verified guest identity, opt-in guest names, reactions and single-choice polls. Prove name privacy, latest RSVP and single-vote behaviour with a PostgreSQL-compatible engine.
3. Add private compressed photo storage, approval, host controls and guest removal. Validate byte/pixel/storage/count limits and token-bound reads. Keep private URLs out of public uploads.
4. Add guest and host responsive screens, countdown, account export, privacy copy and cleanup references.
5. Complete mobile roadmap, installation page, manifest and non-sensitive offline fallback. No guest content in browser caches.
6. Run unit, lint, typecheck, build, audit and representative browser checks. Review diff, create PR, monitor exact-revision CI and merge only on successful required checks.
7. Verify the webhook deployment, additive schema readiness and public smoke tests. Record confirmed production evidence separately from untested provider/device/native-app steps.

## Release safety

The social bootstrap acquires a transaction advisory lock and runs only additive CREATE TABLE/INDEX IF NOT EXISTS statements. Existing data is not rewritten. Fresh schema and upgrade SQL contain the same definitions. Rollback uses the prior application image; additive tables can remain. Do not delete tables or restore older database contents to roll back code. The existing persistent /app/uploads volume also holds social-private files; retain it across rebuilds.

Payment/SMS gates and real-host/device review remain evidence-dependent. Approval to ship does not manufacture provider delivery or native store approval. Native iOS/Android implementation was requested as planning, not an already-built signed application.
