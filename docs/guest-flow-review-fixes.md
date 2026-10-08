# Guest-flow review fixes

This local change addresses the October 8, 2026 review of `df84c964`.

- Invitation sharing constructs a public `/e/<slug>` URL. It never shares the invitation's guest token or other query parameters.
- Personal invitations authorize RSVP reads and updates with their event-bound guest token. A verified guest session can also edit its own event response. A guest UUID or email address alone cannot grant editing rights.
- Public respondents get an event-scoped, HttpOnly, Secure, SameSite=Strict edit cookie before submission. Only its SHA-256 hash is stored in the database. The response can be restored and edited in the same browser; clearing the cookie loses this access. Existing public responses do not acquire an edit credential retroactively.
- RSVP writes are serialized per event and use one transaction for the response, replacement plus-ones, and invited-guest status. Edits exclude the previous response from capacity calculations and do not consume another response slot. Retries with the same credential reuse the existing response.
- Camera access is permitted for the same origin on the check-in page only. The video element exists before scanner startup, preventing the stream from stopping before React renders it.
- The browser content policy permits HTTPS images and media, matching the builder's accepted URLs, plus existing same-origin uploads. Scripts, connections, frames and objects retain their existing restrictions. External artwork is loaded by the browser; this change adds no server-side URL fetching.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

`npm run test:social:browser` now defaults to a disposable, loopback-only native PostgreSQL cluster because the RSVP regressions exercise concurrent transactions. PostgreSQL `initdb` and `pg_ctl` must be on PATH. The harness starts its own new cluster on port 55432, seeds fabricated data, and removes the cluster after the run. It does not connect to an existing database. `npm run test:social:db` retains the lightweight PGlite fixture for manual development.

Run `SEALSEND_QA_BUILDER=true npm run test:social:browser` to also run the authenticated builder and template suites. `SEALSEND_BROWSER_EXECUTABLE` can select an installed Chromium-compatible browser when the bundled Playwright browser is unavailable. The default CI workflow makes PostgreSQL tools available and runs these regressions with native PostgreSQL.

Regression checks cover native and clipboard sharing, invited and public RSVP reloads/edits, concurrent retries, capacity and response limits, transaction rollback, forged/cross-event access, private cookie attributes, host totals, social guest names, external artwork in builder/public views, responsive RSVP accessibility, fake-device QR check-in, stream cleanup, and camera-denial recovery.

## Release and rollback

Apply the additive RSVP migration in `apply-security-indexes.sql` before deploying this application version. It adds nullable `rsvp_responses.edit_token_hash` and a unique index for non-null hashes. The migration is idempotent; existing responses remain unchanged. The previous application version can run with the added column and index, so application rollback does not require dropping them.

Back up the production database and use the existing approved migration/release procedure when release authorization is given. No production migration, data cleanup, push, PR, merge or deployment is included in this local work.

Previously stored duplicate RSVPs remain historical data. Inspect and approve any production deduplication separately; do not infer guest intent from matching email addresses. A real phone's camera and QR decoder still need device validation before claiming physical-device readiness. CI for this candidate and production behavior remain unverified until the candidate is pushed and released with authorization.
