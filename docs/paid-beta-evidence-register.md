# SealSend paid-beta evidence register

Use this register for release decisions. Store no passwords, tokens, payment-card data, message bodies, guest-list exports, or unnecessary personal information. Participant labels must be pseudonymous (for example `host-01`). Link only to access-controlled provider records.

## Evidence-backed score baseline

`npm run quality:score` evaluates `config/quality-scorecard.json` together with the mandatory launch-gate manifest. The 2026-08-28 baseline is product capability **82/100**, competitive position **69/100**, and paid-launch readiness **7/18 (38.9%)**. Synthetic QA and automated checks can strengthen product evidence, but cannot substitute for consented organizer outcomes, provider delivery, physical-device testing, qualified review, or willingness-to-pay evidence. Do not raise a category unless its linked evidence exists; every partial category must keep its missing proof explicit.

## Provider lifecycle evidence

| Provider | Scenario | Required evidence | Status | Verified by | Date |
|---|---|---|---|---|---|
| Stripe test | Annual checkout succeeds | Checkout ID, signed webhook ID, active `pro_annual` entitlement | Pending | | |
| Stripe test | Checkout is cancelled | No subscription or entitlement created | Pending | | |
| Stripe test | Delayed payment succeeds | Async-success webhook grants one entitlement | Pending | | |
| Stripe test | Webhook is replayed | Duplicate receipt acknowledged; state unchanged | Pending | | |
| Stripe test | Renewal invoice is paid | Entitlement remains active; period end advances | Pending | | |
| Stripe test | Renewal payment fails | Subscription becomes `past_due`; entitlement is withheld | Pending | | |
| Stripe test | Payment recovers | Paid invoice restores active status | Pending | | |
| Stripe test | Subscription is cancelled | Subscription becomes cancelled/free without deleting event data | Pending | | |
| Stripe test | Eligible refund | Refund ID, amount, policy decision, entitlement decision | Pending | | |
| Mailgun | Accepted and delivered | Signed callback IDs and matching delivery state | Pending | | |
| Mailgun | Temporary and permanent failure | Retry/failure state and bounce handling | Pending | | |
| Mailgun | Complaint/unsubscribe | Recipient is opted out and future send is blocked | Pending | | |
| Mailgun | Duplicate callback | One receipt; no duplicate state transition | Pending | | |
| Twilio | Sent and delivered | Signed callback IDs and matching delivery state | Pending | | |
| Twilio | Failed and undelivered | Failure/bounce state and invalid-number marking | Pending | | |
| Twilio | Duplicate callback | One receipt; terminal state does not regress | Pending | | |
| Twilio | Transient processing failure | HTTP 500 followed by successful provider retry | Pending | | |
| Twilio | Incoming STOP | Signed event creates organizer-scoped hashed SMS suppression; future send is blocked | Pending | | |
| Twilio | Incoming START | Signed event removes the matching local suppression after provider unblock | Pending | | |
| Twilio | Incoming HELP | Signed event is replay-safe and leaves suppression state unchanged | Pending | | |
| OpenAI | Valid structured generation | Schema-valid editable draft, latency, token/cost record | Pending | | |
| OpenAI | Invalid output/timeout | Deterministic fallback with no external action | Pending | | |
| Monitoring | Synthetic error | Alert received with sanitized route metadata only | Pending | | |

The current provider-cost proposal is `docs/provider-cost-envelope.md`: USD 0.002 per email, USD 0.020 per billed SMS segment, a second review above USD 10 projected per event, and a monthly pause/reconciliation threshold above USD 50. These values remain **pending owner approval** and must be rechecked against actual provider billing before the `provider_cost_approval` gate can pass.

## Five-host acceptance

Each participant must consent to beta observation. Recruit within the chosen recurring-community wedge: one club or association, one volunteer group or local non-profit, one creative community, one alumni or small professional community, and one repeat planner.

Enrollment is invitation-controlled. The `recurring-community-v1` thresholds were approved by Cameron Ashley at `2026-08-28T20:06:43.844Z`, before any host consent was recorded; production enrollment remains closed until the approved candidate is deployed and a host is explicitly invited. For each approved host, an operator runs `npm run create-beta-invite -- <segment>` with the protected production `DATABASE_URL`, records the returned pseudonymous participant label and cohort version, and transmits the one-time invitation code directly to that host. Codes are stored only as SHA-256 hashes, expire after seven days, assign the cohort version and segment on the server, and cannot be reused, self-selected, or accepted after revocation. Database constraints allow only one open invitation and one active host per required segment in the named cohort. `npm run list-beta-invites` shows at most 100 recent current-cohort pseudonymous labels, segments, four-character previews, expiry dates, and derived statuses without querying or printing token hashes. If a code was misdirected or is no longer authorized, run `npm run revoke-beta-invite -- <host-xxxxxxxxxxxx>` before acceptance; the command is idempotent for an already-revoked invitation and refuses an accepted one. Do not commit or paste a raw code into this register, tickets, screenshots, or chat logs.

The release candidate records a versioned consent timestamp, an operator-assigned pseudonymous participant label and segment, withdrawal timestamp, and privacy-limited workflow milestones. Only milestones after the current consent timestamp count. Withdrawal excludes the participant from active aggregate evidence and rejoining requires a new operator invitation. The application does not put guest names, contact details, message bodies, or RSVP content into this beta progress record. These signals support the matrix; they do not replace host feedback, critical-defect review, or owner acceptance.

Run `npm run report-beta-participants` with the protected production `DATABASE_URL` to produce one JSON line per current-scope participant. Each line contains only the pseudonymous label, operator-assigned segment, consent version/timestamps, active/withdrawn state, privacy-limited milestone booleans, completion counts, feedback count, structured outcome, and severity-review counts. The command joins internally on account IDs but never returns them, and it does not select guest data, contact details, feedback messages, invitation tokens, token hashes, or reviewer names. Copy only the required results into the matrix below. `criticalDefects: null` means **not reviewed**; only a completed, named human severity review may replace it with a count, including zero.

After a named human has triaged the host's current consent window, record the unresolved counts with `npm run record-beta-defect-review -- <host-label> "<reviewer name>" <severity-1-count> <severity-2-count> CONFIRM-HUMAN-SEVERITY-TRIAGE`. The command stores no free-text defect, guest, or response content and does not print the reviewer name. Re-run it after triage changes; it updates the same consent-window review. Keep detailed defect reproduction and resolution evidence in the access-controlled engineering system under its pseudonymous host label.

After a named operator has reconciled the support effort delivered during the host's current consent window, record the total with `npm run record-beta-support-review -- <host-label> "<reviewer name>" <support-minutes> CONFIRM-OPERATOR-SUPPORT-REVIEW`. This operator-recorded value is separate from the host's self-reported survey answer. The command stores no support notes, message content, guest data, or reviewer name in its output; rerunning it updates the same consent-window review.

| Host label | Segment | Account | Event and design | Guest import | Controlled invite | RSVP | Announcement review | Calendar | Check-in | Export | Feedback | Critical defects |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| host-01 | Club/association | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| host-02 | Volunteer/local non-profit | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| host-03 | Creative community | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| host-04 | Alumni/small professional community | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| host-05 | Repeat planner | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Launch measures

Record the measurement window and denominator for every rate.

The secret-gated operations report computes active-cohort event-publish, guest-import, controlled-invite, RSVP, announcement-review, calendar, check-in, export, feedback, workflow-completion, and repeat-planner repeat-use rates. Every rate retains its numerator and denominator; a zero denominator is reported as `null`, never as 0% or a pass. It also reports represented segments, median hours from consent to first publish, average feedback rating, operator support-review coverage, and the median operator-recorded support time only after every active host has a review, without returning participant identifiers.

| Measure | Result | Acceptance threshold | Decision |
|---|---:|---:|---|
| Account-to-first-event activation | | Defined before beta | Pending |
| Event publish completion | | Defined before beta | Pending |
| Checkout completion | | Defined before paid test | Pending |
| Invitation accepted by provider | | 100% for approved beta recipients | Pending |
| Delivered email/SMS | | Provider-appropriate target defined before beta | Pending |
| Unresolved severity 1 or 2 defects | | 0 | Pending |
| Median support time per host | | Defined before beta | Pending |
| Backup restore rehearsal | | Pass | Pending |
| Willingness to pay | | Recorded for all five hosts | Pending |

The outcome survey records each active host's **stated intent** against the displayed price proposition. It is **not paid conversion**, checkout, or revenue evidence. The survey support-minutes field is **self-reported** by the host and must not be described as operator-observed support time. The separate named operator review is the source for operator-recorded support effort. Missing responses or reviews remain missing; they are never converted to zero or a passing result.

## Real-device accessibility evidence

Automated emulation is supporting evidence only. Record the physical device, operating-system version, browser or assistive technology, tester, date, and result. Do not record participant account credentials.

The permanent Playwright matrix covers Chromium/Pixel, Firefox, desktop WebKit, and iPhone WebKit emulation. These checks catch engine-specific regressions but do not satisfy the physical-device or assistive-technology gates below.

| Device and OS | Browser/AT | Viewports/workflows | Keyboard, focus and announcements | Result | Tester | Date |
|---|---|---|---|---|---|---|
| iPhone (supported iOS) | Safari + VoiceOver | Marketing, signup, login, wizard, public RSVP | Pending | Pending | | |
| iPad (supported iPadOS) | Safari + VoiceOver | Dashboard, wizard, guest management | Pending | Pending | | |
| macOS | Safari + VoiceOver | Complete host and guest critical path | Pending | Pending | | |
| Windows | Edge + NVDA | Complete host and guest critical path | Pending | Pending | | |
| Android | Chrome + TalkBack | Marketing, signup, login, public RSVP, check-in | Pending | Pending | | |

Supporting engine evidence: Firefox, desktop WebKit, and mobile WebKit each passed 9/9 live public accessibility/regression checks (27/27 total). The first desktop WebKit run exposed a reduced-motion hero contrast defect at 768px; the corrected release passed that case and the entire matrix in production. This engine evidence does not replace physical hardware or screen-reader testing.

Acceptance requires no critical or serious WCAG 2.2 AA defect in a launch-critical workflow, no keyboard trap, visible focus, correctly announced errors/status changes, and usable 200% zoom/reflow.

## Professional review tracking

Internal implementation review does not replace qualified legal or accounting advice. Store engagement letters and advice outside the repository; record only the outcome and approved policy version here.

| Review | Reviewer/firm | Jurisdiction/scope | Required evidence | Status | Approval date |
|---|---|---|---|---|---|
| Privacy and Terms | | Canada and intended customer markets | Written approval or tracked amendments | Pending | |
| Data retention/deletion | | Personal and guest data | Approved periods, exceptions, processor duties | Pending | |
| Refund/cancellation policy | | Annual and per-event purchases | Approved eligibility and entitlement treatment | Pending | |
| Sales tax | | Canada plus intended markets | Registration, collection and remittance decision | Pending | |
| Email/SMS compliance | | CASL/TCPA and intended markets | Consent, identification, unsubscribe and records decision | Pending | |
| Accessibility risk | | Intended markets | Remediation/statement decision | Pending | |

The repository-controlled retention-period decision is documented in `docs/retention-policy-decision.md`. Cameron Ashley approved the 90-day stale-draft and 7-day orphan-upload periods on 2026-08-28. Destructive cleanup remains disabled, and this owner decision does not replace the qualified privacy/deletion review tracked above.

## Load and recovery evidence

Run `npm run test:load` against the intended public origin. Defaults are bounded to 200 read-only requests at concurrency 10, require zero failures, and require p95 latency no greater than 1500 ms. Record the command environment, result JSON, server health, and log review.

Run `ops/rehearse-release.sh <verified-backup.dump> <immutable-image>` on the VPS. It creates an isolated PostgreSQL container, restores the backup, starts the supplied image on an isolated Docker network, verifies health and the unauthenticated API boundary, and removes all rehearsal containers/network on exit. It never connects to the production database.

| Gate | Artifact | Result | Verified by | Date |
|---|---|---|---|---|
| Bounded public load | 200 requests, concurrency 10, 0 failures, p95 286 ms, max 629 ms; production remained healthy | Pass | Codex QA | 2026-08-08 |
| RSVP capacity concurrency | 10 simultaneous attempts for 3 seats: 3 accepted, 7 capacity-rejected, persisted 3 responses/3 attendees; fixture removed | Pass | Codex QA | 2026-08-08 |
| Current-image recovery | `20260827T194856Z/sealsend-predeploy.dump` + `sealsend:20260827T213741Z`; 34 tables, health 200, unauthenticated events 401 | Pass | Codex QA | 2026-08-27 |
| Rollback-image recovery | `20260827T194856Z/sealsend-predeploy.dump` + `sealsend:20260827T195857Z`; 34 tables, health 200, unauthenticated events 401 | Pass | Codex QA | 2026-08-27 |
| Retention fail-closed rehearsal | Commit `817b721`; fresh PostgreSQL 16 schema and production image shape; 4 stale candidates, 1 exact warning older than 14 days, 3 blocked, exactly 1 deleted; 6 lifecycle candidates; temporary containers, network, image, and checkout removed; production health remained 200 | Pass | Codex QA | 2026-08-28 |
| Current-candidate authenticated browser | Commit `aa3d03c` (application tree identical to parent `edbbcef`); isolated PostgreSQL 16, internal HTTPS for `sealsend.app`, and Chromium; authenticated host/guest lifecycle plus public navigation 2/2 passed, including signed announcement review; temporary containers, network, candidate image, and checkout removed; production health remained 200 | Pass | Codex QA | 2026-08-28 |
| Live rollback procedure | Approved maintenance window and observed cutover/restore | Pending | | |

## Go/no-go record

The authoritative machine-readable gate status is `config/launch-evidence.json`. Run `npm run launch:decision`; it exits non-zero and reports `NO_GO` until every required gate has evidence. Human gates cannot pass without both a named approver and an ISO approval date. A successful result authorizes staged activation planning only; it does not itself enable payments, communications, destructive cleanup, or public launch.

- Decision date:
- Decision owner:
- Evidence window:
- Result: Pending
- Accepted known issues:
- Rollback release:
- Follow-up date:
