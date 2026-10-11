# SealSend mobile app roadmap

Cameron authorized building iOS and Android apps with current-offering/pain-point research on 11 October 2026. The first shared native host candidate is implemented locally on `feat/native-mobile-apps`; store release and customer validation remain open. The earlier planning-only roadmap is preserved at [2026-10-07 planning archive](mobile/archive/2026-10-07-planning-roadmap.md).

Use [research and decisions](mobile/RESEARCH.md), [verification/release gates](mobile/READINESS.md), and [workspace commands](../apps/mobile/README.md) as the current source. Continue the digital visual direction; do not imply paper delivery.

| Milestone | Current state | Acceptance still needed |
| --- | --- | --- |
| Native foundation | Expo SDK57, Router, secure sessions, strictly allowlisted gateway implemented; source checks and native bundles verified | Compiled native launches, real-device accessibility/permissions, reviewed backend activation |
| Host first value | Create/edit/publish/share/archive and persistent retry deduplication implemented; synthetic HTTP workflows verified | Mixed-device rendered end-to-end journey and human pilot |
| Arrivals | Search, personal QR, source-aware check-in/undo, retry side-effect suppression implemented | Real camera, denied permissions, slow/offline/stale-data scenarios on iOS/Android |
| Native convenience | Share sheet, optional calendar composer and confirmed-arrival haptics implemented | OS composer cancellation, clock/timezone, rotation and font-scaling tests |
| Privacy/control | Secure storage, offline local sign-out, deletion initiation/cancellation implemented | Store disclosures, account export increment, scheduled deletion execution proof, paid-account cancellation |
| Private beta | Research/QA/runbook prepared | Enough disk or authorized cloud build; signed artifacts, backend release, support/review setup and authorized pilot |
| Public stores | Not released | Beta evidence, signing/metadata/legal/privacy and explicit submission approval; store acceptance and monitoring |
| Broader parity | Prioritized backlog | Shared-team events, native guest RSVP/inbox, richer design, social/photo moderation, polls, reminders, exports and paid features; each requires its own acceptance criteria |

Native architecture reuses server ownership/role/quota rules and TypeScript models rather than duplicating authorization. Guest RSVP stays account-free on the web. Broad offline caching and notification permissions are deferred until privacy, conflict resolution and consent are designed. Billing is not added to this candidate; current store-payment rules must be evaluated before introducing native paid features.

Next action: choose the native build path, produce installable artifacts, and test on real platforms. A successful JS export is not a binary, and source tests are not device or customer evidence. Production changes, tester invitations, signing/account changes and store submissions require the corresponding approval. Preserve the additive mutation table during rollback.
