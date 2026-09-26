# Workspace webhooks

SealSend can POST a signed JSON message to your URL when something happens on one of your workspace's events. Use it to push RSVPs into a CRM or spreadsheet with Zapier or Make ("Webhooks by Zapier → Catch Hook", "Make → Custom webhook"), or to your own server.

Webhooks are an organizer-plan feature (Solo, Studio, Agency). During the controlled beta (`BETA_MODE`) every workspace can use them. Workspace owners and admins manage them in **Settings → Integrations**.

## Events

| Type | Sent when | `data` includes |
|---|---|---|
| `rsvp.submitted` | A guest submits an RSVP on the event page | `response`: `id`, `respondent_name`, `respondent_email`, `status` (`attending`, `maybe`, `not_attending`), `headcount`, `guest_id`, `plus_ones[].name` |
| `guest.checked_in` | A guest is checked in at the door | `guest`: `id`, `name`, `rsvp_status`, `checked_in_at` |
| `event.published` | An event is published | nothing beyond `event` |
| `client.approved` | A client approves the invitation from their review link | `approval`: `share_id`, `approver_name` |
| `webhook.test` | You press **Send test** | `message` |

Every `data` object also includes `event` (`id`, `title`, `slug`, `event_date`), except for `webhook.test`.

## Request format

```http
POST /your/endpoint HTTP/1.1
Content-Type: application/json
User-Agent: SealSend-Webhooks/1.0
SealSend-Event: rsvp.submitted
SealSend-Delivery: 8f0c0d7e-2b43-4c1f-9d7e-3f1b0a6c9e21
SealSend-Signature: t=1790000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd

{
  "id": "8f0c0d7e-2b43-4c1f-9d7e-3f1b0a6c9e21",
  "type": "rsvp.submitted",
  "created_at": "2026-09-26T01:47:16.581Z",
  "organization_id": "…",
  "data": {
    "event": { "id": "…", "title": "Spring Gala", "slug": "spring-gala", "event_date": "2026-04-01T18:00:00+00:00" },
    "response": { "id": "…", "respondent_name": "Ana Lee", "respondent_email": "ana@example.com", "status": "attending", "headcount": 2, "guest_id": null, "plus_ones": [] }
  }
}
```

- `id` (also in `SealSend-Delivery`) is unique per delivery and stays the same across retries, so use it to ignore duplicates.
- Respond with any `2xx` status within 10 seconds. Redirects are not followed and count as failures.

## Retries

A failed delivery is retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours, then marked failed (6 attempts, about 15 hours in total). **Settings → Integrations** shows the last 20 deliveries and how many attempts in a row have failed. Delivery records are kept for 30 days.

## Verifying the signature

`SealSend-Signature` is `t=<unix seconds>,v1=<hex HMAC-SHA256>`. The HMAC is computed with your endpoint's signing secret (`whsec_…`, shown once when you add the endpoint) over `<t>.<raw request body>`. Reject the request if the signature doesn't match or `t` is more than 5 minutes old.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySealSendSignature(secret, rawBody, header, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=", 2)));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(expected, given);
}
```

Use the raw body exactly as received; parsing and re-serialising the JSON changes it.

## Endpoint rules

- `https://` on the standard port, with a publicly reachable host. Private, loopback and link-local addresses are refused both when you save the URL and again at delivery time.
- Up to 5 endpoints per workspace.

## Operations

- `/api/cron/deliver-webhooks` (`Authorization: Bearer $CRON_SECRET`) sends due deliveries. Call it every minute from the scheduler.
- `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` allows `http://` and private addresses for local testing only. Never set it in production.
