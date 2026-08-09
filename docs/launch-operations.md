# SealSend launch operations

## Support

- Intake: `support@sealsend.app`.
- Target initial response: two business days; security, active-event access, and billing incidents are triaged first.
- Never ask a customer to email passwords, one-time codes, session cookies, payment-card data, or guest-list exports.
- Record the request category, received time, account email, owner, resolution, and completion time in the approved private support system.

## Refunds and cancellations

- Annual subscriptions: honour the published 14-day money-back guarantee. Confirm Stripe subscription state, refund identifier, amount, and entitlement end date.
- Per-event purchases: refundable before invitations are sent. After sending begins, apply the published non-refundable rule unless a duplicate charge or service failure requires correction.
- Never promise a refund until the Stripe object, charge state, and policy eligibility are verified.
- Cancellation must stop future renewals without deleting event data. Account deletion is a separate workflow.

## Account deletion and exports

1. Ask the signed-in host to download the JSON export in Settings.
2. The host schedules deletion in Settings by typing `DELETE`; their authenticated session verifies the request.
3. A seven-day cooling-off period allows cancellation. Active paid subscriptions block scheduling or execution.
4. The authenticated deletion job removes owned events and related guest data, subscriptions, sessions, the account, and its upload directory.
5. If self-service is inaccessible, verify account control through the approved support process and complete the request within 30 days, subject to the published exceptions.

## Abuse and security

- Suspend outbound communications first when spam, phishing, credential compromise, or unlawful content is credibly reported.
- Preserve the minimum evidence needed for investigation; do not copy guest content into general-purpose tickets.
- Rotate exposed credentials, invalidate sessions, and document affected systems and dates.
- Escalate suspected personal-data exposure immediately and obtain qualified legal guidance for notification duties.

## Retention and storage

- Draft cleanup and orphan-upload cleanup default to report-only mode.
- Do not enable destructive cleanup until the customer-facing retention notice and internal approval name the retention period.
- Current proposed draft retention is 90 days since last update, with a hard minimum of 30 days in code.
- Orphan uploads become eligible after seven days. Account deletion removes that account's upload directory immediately when the request executes.

## Five-host beta acceptance

Recruit one host from each segment: private celebration, wedding, community/non-profit, corporate/team, and repeat planner. Each host must complete account access, event creation, customization, publishing, guest import, a controlled invitation, RSVP, announcement/reminder review, calendar addition, check-in, export, and feedback. Record only consented operational observations—no guest content. A paid launch decision requires provider delivery evidence, funnel completion, unresolved severity, support effort, and willingness-to-pay results.

## Market and locale scope

- The controlled beta is English-language and USD-priced. Do not advertise localized-language support until a complete translated workflow and assistive-technology review pass.
- International phone numbers are stored in E.164 format. Hosts should include a country calling code when it differs from the configured default country.
- Event times are stored as UTC instants with the host-selected IANA timezone. Test every supported client around daylight-saving transitions before expanding locale coverage.
- Checkout must identify USD and display applicable taxes before payment. Regional tax registration and remittance require qualified accounting advice before targeting a new jurisdiction.
