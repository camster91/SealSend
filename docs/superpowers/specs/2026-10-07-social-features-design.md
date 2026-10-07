# Verified-guest social features

Approved by Cameron on 2026-10-07, including implementation, GitHub work and shipment.

## Scope and decisions

Build in order: who's coming and reactions; polls; shared photos; countdown and excitement. Mobile version planning follows. Hosts enable each feature per event. Existing events start with social features disabled. Access requires a personal, unguessable invitation link or the database-backed guest session for that event. The public event link alone grants no social access. Host/manager administration uses existing edit_event permission.

Guest names appear only after that guest opts in, and only for their latest attending RSVP. Do not display contacts, dietary/access notes, plus-one names or private replies. A guest may hide their name again. Reactions are one per guest, changeable and removable; no anonymous counters or automated emails. Polls are host-created single-choice questions with 2–6 distinct options, one changeable vote per guest, aggregate results and host closure. No voter identities in guest responses.

Photo approval is on by default; hosts can turn immediate publication on. Images are JPEG/PNG/WebP, at most 8 MB and 25 million input pixels, resized and re-encoded to WebP with metadata removed. Counts: 10 photos per guest and 200 per event, bounded by the owner's existing storage allowance. Photos require event authorization on every request; the existing public uploads endpoint must refuse private-album paths. Guests see approved photos and their own pending uploads; hosts approve or remove photos. Uploaders confirm permission to share and may remove their own photos. No video, face recognition, AI processing, push messages or public gallery.

Countdown uses the saved event instant, handles ended events and honours reduced motion. Excitement uses the same bounded per-guest reaction model. Use design tokens, 44-pixel buttons, labelled controls, keyboard focus and polite status feedback. Support 375, 768 and 1440 pixel widths.

## Persistence and release

Use additive social tables with cascading event/guest deletion, parameterized SQL and per-event locks around limits. Provide identical fresh-schema and idempotent upgrade SQL. Social schema bootstrap only creates these new tables and runs in a transaction before first use; it never alters existing records. This permits the existing Coolify webhook release to serve the feature without a destructive migration. Record bootstrap and rollback behaviour explicitly. Rollback to the previous image leaves additive tables intact.

Store private files inside the existing persistent uploads volume; use the existing serialized owner quota. Exclude album references from orphan cleanup, include social metadata in account export, and keep account/event deletion compatible. Responses and photo bytes are private/no-store. API checks feature toggles and verified identity on each read/write. CSRF and quotas remain enforced. Never log guest tokens, image bytes, captions or contact data.

## Done when

- Unauthorized, cross-event and disabled-feature requests fail closed.
- Name visibility is opt-in and respects latest RSVP.
- Repeated/concurrent votes and reactions cannot inflate counts.
- Pending photos and public upload URLs cannot expose album content.
- Photo deletion removes accounting and bytes; orphan cleanup preserves referenced albums.
- Unit, database, responsive browser, accessibility, typecheck, lint and build checks pass.
- Exact merged revision and production verification are recorded separately from assumptions.
