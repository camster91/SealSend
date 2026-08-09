# SealSend paid-beta evidence register

Use this register for release decisions. Store no passwords, tokens, payment-card data, message bodies, guest-list exports, or unnecessary personal information. Participant labels must be pseudonymous (for example `host-01`). Link only to access-controlled provider records.

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
| OpenAI | Valid structured generation | Schema-valid editable draft, latency, token/cost record | Pending | | |
| OpenAI | Invalid output/timeout | Deterministic fallback with no external action | Pending | | |
| Monitoring | Synthetic error | Alert received with sanitized route metadata only | Pending | | |

## Five-host acceptance

Each participant must consent to beta observation. Use one participant for each segment: private celebration, wedding, community/non-profit, corporate/team, and repeat planner.

| Host label | Segment | Account | Event and design | Guest import | Controlled invite | RSVP | Announcement review | Calendar | Check-in | Export | Feedback | Critical defects |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| host-01 | Private celebration | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | 0 |
| host-02 | Wedding | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | 0 |
| host-03 | Community/non-profit | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | 0 |
| host-04 | Corporate/team | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | 0 |
| host-05 | Repeat planner | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | 0 |

## Launch measures

Record the measurement window and denominator for every rate.

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

## Go/no-go record

- Decision date:
- Decision owner:
- Evidence window:
- Result: Pending
- Accepted known issues:
- Rollback release:
- Follow-up date:
