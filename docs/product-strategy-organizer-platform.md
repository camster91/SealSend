# SealSend product strategy: one-off hosts and the organizer platform

Status: **Direction accepted by the owner on 2026-09-25.** D4 (organizer prices) and D6 (licence) were accepted on 2026-09-26.

Progress: Phase 0 (Event Pass, SMS allowance and top-ups, honest plan claims), Phase 1 (workspaces, brand kit, team workspaces) and Phase 2 (clients, client review links and approvals, per-client event history and CSV export) are built. Phase 3 needs infrastructure (reverse proxy, DNS, Mailgun domains, US 10DLC). Phase 4 has started with signed workspace webhooks (`docs/webhooks.md`), which also cover Zapier and Make through their generic webhook triggers; a public API is next.

Drafted: 2026-09-25

Owner decisions are marked **DECISION** and collected in [Open decisions](#decisions).

## 1. The two products

SealSend should serve two audiences from one codebase.

| | A. One-off hosts | B. Event organizers (the platform) |
|---|---|---|
| Who | Someone running a birthday, shower, reunion, club night | Wedding/event planners, venues, agencies, community organizers who run events *for clients* |
| Job | "Get my invite out and know who's coming" | "Run my events business under my brand" |
| Frequency | A few events a year | Many concurrent events, every week |
| Brand on guest pages | SealSend | The organizer's, with SealSend invisible |
| Pricing goal | Free or a small fee that covers hosting and provider costs | Recurring subscription; SealSend's main revenue |
| Role in the business | Acquisition channel and proof of quality | The business |

One-off hosts matter because every guest page they send is marketing, and some hosts are future organizers. The platform is what makes SealSend a business.

## 2. Where the product is today

**The repo is aimed at neither audience in full.** The approved controlled beta (`docs/launch-operations.md`) targets a *recurring-community* wedge: a club or association, a volunteer group or non-profit, a creative community, an alumni or small professional community, and one repeat planner. That is closer to A than to B.

### Already built, reusable for both

- Event creation wizard with AI drafting and fallback, curated templates, design upload, and per-event `customization` (colours/fonts)
- Guests: CSV import with duplicate handling, tags, plus-ones, magic links, QR codes
- RSVP with custom fields, comments, sign-up board, calendar export, CSV exports, response summaries and analytics
- Email/SMS invitations, reminders and announcements, with audience preview, cost estimates, suppression lists and signed provider callbacks
- **Event-level** co-host roles (`event_members`, `event_member_invites`, `event_audit_log`) and a check-in-only role
- Stripe per-event checkout and an annual subscription (`pro_annual`, USD 124.99/year), currently hidden by `BETA_MODE`
- Account export/deletion, retention jobs, backups, monitoring, rate limiting, CSP

### Advertised but not built

`src/lib/constants.ts` lists **"Custom domain"** and **"Remove branding"** as paid features (`customDomain`, `removeBranding`).
- **Custom domain:** no code implements it. It must be built or removed from the pricing copy before paid launch.
- **Remove branding:** partly exists. The "Powered by Seal and Send" badge on the public event page (`src/app/e/[slug]/page.tsx`) only renders for `tier === "free"` events. The `removeBranding` entitlement key itself is never checked, and there is no organizer-level white-labelling.

### Missing for the organizer platform

| Capability | Status |
|---|---|
| Organization/workspace that owns events, with org-level staff roles | None. Events belong to a single `user_id`; sharing is per event. |
| Clients (the people an organizer runs events for) | None |
| Brand kit (logo, colours, fonts, sender name) applied across all events | None; branding is per event |
| White-label guest pages (no SealSend mark) | Per event only: paid event tiers hide the free-tier badge. No organizer-level setting, SMS always end with "Sent via Seal and Send" (`src/lib/sms-templates.ts`), and emails send from SealSend's own address. |
| Custom domain (`events.planner.com`) with automatic TLS | None |
| Branded email sending domain (DKIM/SPF on the organizer's domain) | None; all mail sends from SealSend's Mailgun domain |
| SMS under the organizer's identity (US A2P 10DLC brand/campaign) | None |
| Client portal: share, review, approve, see RSVPs | None |
| Multi-event dashboard across clients | None; the dashboard lists one user's events |
| Business operations: proposals, contracts, invoices, client payments, vendors, tasks, timelines | None |
| Organizer-to-client payments (Stripe Connect) | None; Stripe only charges SealSend's own customers |

### Pricing is inconsistent today

Three models coexist in `src/lib/constants.ts`:
- per-event tiers: free, then Silver/Gold/Platinum/Diamond at USD 8.99–49.99
- monthly subscriptions `pro` and `business` at USD 8.99/17.99
- `pro_annual` at USD 124.99/year

The public pricing plans show the per-event tiers plus `pro_annual`. This should collapse to the model in section 3.

## 3. Proposed pricing

### A. One-off hosts: free first, pay only for what costs money

From `docs/provider-cost-envelope.md`, a 100-guest event with three emails and two SMS segments per guest costs about **USD 0.60 in email and USD 4.00 in SMS**, before fixed plan fees and Stripe's cut (about 2.9% + CAD 0.30). Email is nearly free; SMS is the real variable cost.

Proposal:

| Plan | Price | Limits | Branding |
|---|---|---|---|
| Free | USD 0 | 1 active event, up to 50 guests, email only | "Powered by" badge |
| Event Pass | about USD 9–15 per event, one-time | Up to 250 guests, email + SMS with a bundled SMS allowance (e.g. 500 segments), all event features | No badge (as paid tiers work today) |
| SMS top-up | at cost plus margin (e.g. USD 5 per 200 segments) | Only if the bundle runs out | — |

Why: it keeps the free tier generous enough to spread, covers SMS (the only real cost), and replaces four near-identical per-event tiers with one. **DECISION D2.**

### B. Organizers: monthly subscription, SMS passed through

| Plan | Indicative price | For | Includes |
|---|---|---|---|
| Solo | USD 29/mo | Independent planner | 2 seats, brand kit, white-label pages, unlimited events, client records, client share links |
| Studio | USD 79/mo | Small team or venue | 5 seats with org roles, custom domain, branded sending domain, client portal with approvals |
| Agency | USD 199/mo | Multi-brand agency | Multiple brands, API/webhooks, priority support, higher limits |

- SMS is billed at cost plus margin on every plan, so heavy senders don't erode margin.
- Later: a small platform fee (e.g. 1%) on client payments processed through Stripe Connect.
- The existing `pro_annual` (USD 124.99/year) becomes either the annual Solo price or is retired. **DECISION D3.**

These prices were accepted as starting points (D4), not researched market rates. Note for D3: USD 124.99/year is 64% below twelve months of Solo (USD 348), so revisit the annual Solo price (for example USD 290, two months free) before selling it. Confirm them with 5–10 organizer interviews and a competitor check before publishing.

## 4. Organizer platform: phased roadmap

Each phase is shippable on its own and gives organizers something they'd pay for.

### Phase 0: launch the one-off product properly
- Simplify pricing to section 3A and remove the unbuilt "Custom domain" / "Remove branding" claims from the one-off plans.
- Finish the existing controlled-beta gates in `DEPLOYMENT_READINESS.md` (provider delivery, Stripe lifecycle, five-host evidence).
- Resolve issue #152 ("Start free" CTA destination).

### Phase 1: workspaces and brand kit (the platform's foundation)
- `organizations`, `organization_members` (roles: owner, admin, planner, check-in; implemented in Phase 1a), `brands`.
- Every event gets an `organization_id`. Existing users get a personal org during migration, so nothing breaks for one-off hosts.
- Brand kit: logo, colours, fonts, email sender name and reply-to, footer text. It's applied to every event page, invitation email and SMS signature, and per-event `customization` can still override it.
- White-label switch on paid organizer plans removes all SealSend marks from guest pages and emails. Today only the free-tier badge on event pages is conditional; wire it to the `removeBranding` entitlement and extend it to emails.
- Org-level dashboard: all events across the team, filterable by status and date.
- Authorization: extend `requireEventPermission` so org roles grant event access. That keeps one permission path, which the current code does well.

### Phase 2: clients
- `clients` (name, contacts, notes), with `events.client_id`.
- Client share link: a read-only, branded view of the event page draft, the guest list and live RSVP numbers. Magic-link access; no client account needed.
- Approvals: the client approves the invitation design and copy before sending, recorded in `event_audit_log`.
- Per-client event history and exports.

### Phase 3: custom domains and branded sending
- Custom domain per brand (e.g. `rsvp.plannerco.com`):
  - CNAME to SealSend, then automatic TLS through the reverse proxy's on-demand certificates (Coolify runs Traefik/Caddy).
  - Host-based routing in `src/proxy.ts`.
  - The CSP and cookies must be reviewed per host.
- Branded email: a verified Mailgun sending domain per brand (DNS records shown in the app, verification polled). Fall back to SealSend's domain until it's verified.
- SMS: US A2P 10DLC requires registering each sending business, so offer a shared SealSend number by default and per-org registration on higher plans. **This carries compliance cost and lead time; research it before promising.**

### Phase 4: run the business
Integrate before building. Organizers already use HoneyBook, Dubsado, Aisle Planner and Planning Pod for CRM, contracts and invoicing. SealSend wins on the guest experience, so:
- First: webhooks, a public API and Zapier/Make so SealSend feeds their existing tools.
- Then, if interviews demand it: proposals and invoices via Stripe Invoicing, client payments via Stripe Connect (with a platform fee), and task timelines and vendor contacts per event.
- **DECISION D5:** how far into "run their whole business" to go versus integrating.

### Phase 5: ecosystem
- Template marketplace (organizers sell or share designs), directory of organizers, and multi-brand agencies.

## 5. Data model sketch (Phase 1–2)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'personal',        -- personal | solo | studio | agency
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,     -- auto-created for one-off hosts
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','planner','check_in')),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  theme JSONB NOT NULL DEFAULT '{}',             -- colours, fonts
  sender_name TEXT,
  reply_to_email TEXT,
  white_label BOOLEAN NOT NULL DEFAULT FALSE,     -- entitlement-checked
  custom_domain TEXT UNIQUE,                      -- Phase 3
  custom_domain_verified_at TIMESTAMPTZ,
  sending_domain TEXT,                            -- Phase 3
  sending_domain_verified_at TIMESTAMPTZ
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE events ADD COLUMN brand_id UUID REFERENCES brands(id);
ALTER TABLE events ADD COLUMN client_id UUID REFERENCES clients(id);
```

Migration: create a personal organization for every existing user, then backfill `events.organization_id`. Keep `events.user_id` as the creator. Privacy: an organizer is the data controller for their clients' guest lists, so the DPA, export and deletion flows (`account/export`, `account/deletion`) must work at the organization level.

## 6. Risks

- **Scope.** "Run their whole business" competes with mature CRMs. Lead with the guest experience plus integrations; build business tooling only when there's demand for it.
- **Open-source licence (resolved: AGPL-3.0-only).** Under MIT, anyone could host a white-label competitor from this code. AGPL keeps self-hosting free but requires anyone running a modified copy as a service to publish their source. **DECISION D6.**
- **Messaging compliance and deliverability.** Multi-tenant SMS needs per-business registration in the US and clear consent records. Custom sending domains need DNS support and bounce monitoring per brand.
- **Support load.** Organizers running live client events expect fast support. The current target is two business days.
- **Beta evidence.** The approved beta cohort is recurring-community hosts. Switching the wedge to planners means a new consented cohort under a new approved policy (see `docs/launch-operations.md`).

## 7. How we'll know it works

- One-off: free-to-paid conversion on Event Pass, SMS cost per event under the bundled allowance, and guest-page-to-signup rate (viral loop).
- Organizer: paying orgs, events per org per month, seats per org, and 3-month retention.
- Leading indicator: organizers who create a second client event within 30 days.

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Next beta cohort audience | **Accepted:** finish the current recurring-community cohort for evidence, then recruit an organizer cohort for Phases 1–2 |
| D2 | One-off pricing | **Accepted:** Free + one Event Pass + SMS top-ups |
| D3 | `pro_annual` (USD 124.99/year) | **Accepted:** becomes the annual price of the organizer Solo plan |
| D4 | Organizer plan prices and seat counts | **Accepted (low end of the ranges):** Solo USD 29/mo with 2 seats, Studio USD 79/mo with 5 seats, Agency USD 199/mo with 25 seats (`ORGANIZER_PLANS` in `src/lib/constants.ts`). Still validate with organizer interviews before selling. |
| D5 | Build business tooling or integrate first | **Accepted:** integrate first (API, webhooks, Zapier), then Stripe Invoicing/Connect if demanded |
| D6 | Licence now that the repo is public | **Accepted: AGPL-3.0-only** for the whole repo from 2026-09-26. Earlier MIT releases stay MIT. |
| D7 | Custom domains and branded email tier | **Accepted:** Studio and above |
