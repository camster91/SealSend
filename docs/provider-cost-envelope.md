# SealSend provider cost envelope

Status: **Approved for controlled cost estimates and alert thresholds**

Reviewed: 2026-08-28

Scope: North American controlled beta and the planned USD 124.99 annual subscription. This approval does not activate billing or authorize unrestricted communications.

## Current first-party price evidence

- [Mailgun pricing](https://www.mailgun.com/pricing/) lists Basic at USD 15/month with 10,000 emails and Foundation at USD 35/month with 50,000 emails. Foundation overage starts at USD 1.30 per 1,000 messages.
- [Twilio Canada SMS pricing](https://www.twilio.com/en-us/sms/pricing/ca) lists USD 0.0083 per outbound long-code SMS segment, carrier fees up to USD 0.0087 per segment, a USD 0.001 failed-message processing fee, and USD 1.15/month for a long-code number.
- [Twilio United States SMS pricing](https://www.twilio.com/en-us/sms/pricing/us) lists USD 0.0083 per outbound long-code SMS segment and carrier fees up to USD 0.005 per segment. Registration or other compliance charges can apply and are not included here.
- [Stripe Canada payment pricing](https://stripe.com/en-ca/pricing/local-payment-methods) lists 2.9% plus CAD 0.30 for a successful domestic-card transaction. [Stripe Billing pricing](https://stripe.com/en-ca/billing/pricing) adds 0.7% of recurring Billing volume. International-card, currency-conversion, dispute, tax, and optional product fees remain separate.

Prices can change. Recheck the provider invoice and pricing page before approving production values.

## Conservative preview rates

Recommended application estimates:

```text
EMAIL_ESTIMATED_COST_MICROS=2000
SMS_ESTIMATED_COST_MICROS=20000
```

- USD 0.002 per email is a conservative variable allowance above the cited Foundation overage rate; the fixed Mailgun subscription is tracked separately.
- USD 0.020 per SMS segment covers the current Canadian long-code platform price plus the highest listed carrier fee and a small rounding buffer. SealSend now counts GSM-7 extension characters, concatenated messages, and Unicode segments before approval.
- These are estimates, not invoice reconciliation. Twilio states that final message pricing can arrive after delivery.

## Controlled-beta envelope

For one 100-guest event, a planning case of three email deliveries per guest and two billed SMS segments per guest produces:

| Cost | Calculation | Envelope |
|---|---:|---:|
| Email variable estimate | 300 × USD 0.002 | USD 0.60 |
| Mailgun fixed plan | Basic starting price | USD 15/month |
| SMS variable estimate | 200 × USD 0.020 | USD 4.00 |
| Twilio long-code number | Current listed price | USD 1.15/month |

Recommended approval thresholds:

1. Require a second operator review when one event’s projected provider charge exceeds USD 10.
2. Pause new external sends and reconcile provider usage when the account’s monthly email/SMS total exceeds USD 50.
3. Keep unrestricted SMS disabled until registration, consent, STOP handling, signed callbacks, and actual invoice costs are verified.
4. Keep the Stripe pricing decision pending until the charge currency and settlement currency are explicit. A Canadian domestic subscription has a published starting cost of 3.6% plus CAD 0.30 before currency conversion, tax, disputes, or optional products.

## Approval record

Owner: Cameron Ashley

Decision timestamp: 2026-08-28T20:34:03.394Z

Approved preview rates: USD 0.002 per email; USD 0.020 per SMS segment

Approved per-event threshold: Second operator review above USD 10 projected provider cost

Approved monthly threshold: Pause new external sends and reconcile above USD 50 total email/SMS provider cost

Boundary: No billing activation, provider credential change, unrestricted communication, merge, or deployment is authorized by this approval.
