# SealSend retention-policy decision

Status: **Proposed — owner approval pending**

Reviewed: 2026-08-28

Scope: The controlled beta and staged paid launch. This decision is limited to SealSend's existing stale-draft and orphan-upload cleanup periods. It is not qualified legal advice, does not approve the complete Privacy Policy, and does not enable destructive cleanup.

## Decision requested

Approve the following repository defaults:

1. An event that remains a draft is eligible for deletion 90 days after its last update.
2. An uploaded asset that is not referenced by any event design is eligible for deletion 7 days after upload.
3. Both cleanup jobs remain report-only until the public retention notice names these periods and a 14-day stale-draft warning is available to the account owner.
4. Production activation of either destructive job requires a separate configuration approval after candidate counts are reviewed.

## Why these periods are proposed

The Office of the Privacy Commissioner of Canada says organizations should keep personal information only as long as needed for its identified purpose, establish minimum and maximum retention periods, and use effective deletion or anonymization when information is no longer required. The California Consumer Privacy Act similarly requires a disclosed retention period or criteria and says retention must not exceed what is reasonably necessary for the disclosed purpose. Neither source prescribes a universal 90-day draft period or 7-day orphan period; those values are SealSend product decisions that require owner and qualified legal review.

Authoritative references:

- [Office of the Privacy Commissioner of Canada — Limiting Use, Disclosure, and Retention](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_use/)
- [California Privacy Protection Agency — CCPA statute, section 1798.100](https://cppa.ca.gov/regulations/pdf/ccpa_statute.pdf)

## Repository evidence

| Data | Current behavior | Proposed approved period | Activation state |
|---|---|---:|---|
| Stale draft event and its event-scoped guest data | `cleanup-drafts` selects only `draft` events by `updated_at`; the configured default is 90 days and code refuses a value below 30 days | 90 days since last update | `ENABLE_STALE_DRAFT_CLEANUP=false` |
| Orphan upload asset | `cleanup-uploads` selects assets older than 7 days only when no event references the asset path | 7 days since upload | `ENABLE_ORPHAN_UPLOAD_CLEANUP=false` |
| Active, published, and archived events | Not targeted by either cleanup job | Retained while the account exists or until the owner deletes the event/account | No automatic event-retention deletion |
| Account deletion | Authenticated request has a 7-day cancellation window; due requests are blocked by an active paid subscription and then cascade-delete account/event data and queue upload-directory deletion | Execute after 7-day cancellation period; support workflow completes verified requests within 30 days | Separate authenticated workflow |
| Database backups | Operations script removes backup archives older than 30 days | 30-day rolling maximum | Separate operations control |

## Gaps that must remain visible

- The public Privacy Policy currently describes account deletion but does not name the 90-day stale-draft or 7-day orphan-upload periods.
- No 14-day stale-draft deletion warning currently exists.
- The revised policy and any statutory applicability still require qualified legal review under the separate privacy/legal gate.
- Mailgun, Twilio, Stripe, hosting, and other processor retention must be confirmed from the configured accounts and contracts; repository code cannot prove provider deletion.
- Destructive cleanup has not been enabled or exercised against production data.

## Approval record

Owner: Pending

Decision timestamp: Pending

Approved stale-draft period: Pending

Approved orphan-upload period: Pending

Approved activation prerequisites: Pending

Boundary: Approval of this document would pass only the owner retention-period decision. It would not enable cleanup, approve the full Privacy Policy, satisfy qualified legal review, or authorize production deployment.

## Exact approval statement

> I approve the SealSend retention decision dated 2026-08-28: stale draft events become eligible after 90 days without an update, orphan uploads become eligible after 7 days, both jobs remain report-only until the public notice names these periods and a 14-day stale-draft warning is available, and production activation requires a separate approval after candidate counts are reviewed. Record Cameron Ashley and the current ISO timestamp. This does not approve the full Privacy Policy, enable cleanup, or authorize deployment.
