# SealSend: design and marketing brief

Version 1, 2026-10-04. Repo: camster91/SealSend (public, Next.js 16 + Tailwind 4). Live: sealsend.app (controlled beta, `BETA_MODE = true`).

## 1. Positioning

- **One-liner:** Send the invitation, know who's coming, and check guests in at the door, all from one link.
- **Category shelf:** digital invitations + RSVP (Evite, Paperless Post, Greenvelope, Partiful), with an organizer layer (workspaces, brand kit, client approvals) that those tools don't have.
- **Why SealSend wins:**
  - Flat price per event. An Event Pass covers up to 250 guests, with no per-guest pricing.
  - Guests don't need an app or an account. They tap a link and reply.
  - Covers the whole job: invite, RSVP, updates by email/SMS, and QR check-in at the door.
  - Organizer tools for people who run events often: workspaces with roles, brand kit, client review links and approvals, webhooks.
- **Audience, in order of value:**
  1. Independent event planners and small studios. They pay for workspaces, brand kit and client approvals.
  2. Recurring organizers: community groups, clubs, associations, nonprofits. They run monthly events and want the guest list to carry over.
  3. One-off hosts: weddings, milestone birthdays, reunions. They buy an Event Pass.
- **Anti-persona:** ticketed public events that sell admission (Eventbrite territory). Corporate conferences that need badge printing.
- **Objections to answer:**
  - Do my guests need an app? (No.)
  - Can I import my list? (Yes: CSV or paste.)
  - What does SMS cost? (An Event Pass includes 500 SMS segments, and top-ups are available.)
  - Is my guest data safe and can I delete it? (Export and deletion exist.)
  - What happens after the beta?

## 2. Voice

Warm, calm and exact, like a good host. Plain verbs, sentence case, no exclamation points. Talk about guests, replies and the door, never "workflows" or "pipelines". The current hero ("approved guest workflow") is jargon, so replace it.

## 3. Visual direction (Brand Lock)

The concept is "fine stationery that works like software". The wax seal is the one memorable element. Everything else is quiet.

| Token | Hex | Role |
|---|---|---|
| Ink | `#1B2A4A` | Text, primary buttons, headings |
| Wax | `#B4233C` | The seal, and only for key moments (primary CTA hover, "sealed"/confirmed states, one accent per view) |
| Cotton | `#F4F5F8` | Page background (cool paper, not cream) |
| White | `#FFFFFF` | Cards and surfaces on top of Cotton |
| Sage | `#6E8B74` | "Going"/success fills and icons (3.7:1 on white, so not for small text; use Sage-dark `#4A6450` for success text) |
| Foil | `#C9A45C` | Rare hairline accent (pricing "recommended" rule, dividers); never for text on light backgrounds |

- **Type:**
  - Display is **Libre Caslon Display** (Google Fonts), for headlines only. It echoes engraved invitations. Set it large, with tight tracking (-0.01em) and a line-height of about 1.05.
  - UI and body are **Hanken Grotesk** (400/500/600).
  - Drop Space Grotesk and Inter. Use `next/font/google`.
- **Shape:**
  - Radii are 10px for controls and 16px for cards. Use hairline 1px borders in `#1B2A4A1A` rather than drop shadows.
  - Use one soft shadow, and only on the floating hero phone or invitation.
- **Don'ts (these read as generic templates):**
  - The blurred gradient blobs, `text-gradient` headline accents and violet/indigo gradients the current site uses.
  - All-caps eyebrows above every section, or "01/02/03" numbering on anything that isn't a real sequence.
  - Fade-up animations on every section.
- **Motion:** allow one orchestrated moment. On hero load, the wax seal "presses" in (scale 1.08 to 1 with a slight rotate, 400ms). Respect `prefers-reduced-motion`.
- **Accessibility:** contrast is AA. Ink on Cotton and white on Ink both pass easily. Wax on white is about 6.3:1, which passes. Also:
  - Visible `:focus-visible` rings (2px Ink, offset 2px).
  - Tap targets of 44px or more.
  - A skip link.
  - One H1 per page.

## 4. Marketing site: architecture

The site lives in the existing `src/app/(marketing)` route group. Keep it there; it is already linked to the app (`/signup`, `/login`, `/dashboard`).

```
/                      Home (rebuild)
/how-it-works          (restyle)
/pricing               (restyle; keep plan data from src/lib/billing.ts / constants: do not change prices)
/use-cases             hub (restyle, add images)
/use-cases/{slug}      community-events, nonprofit-events, clubs-associations, professional-gatherings, event-planners (existing)
                       + optional new: weddings, birthday-parties (add to use-case-content.ts + sitemap)
/support /privacy /terms (restyle only)
```

- **Header:** logo, then How it works, Use cases, Pricing, then Log in, with the primary CTA rightmost.
- **Footer columns:** Product, Use cases, Company, Legal.

## 5. Home page copy

**Hero**
- H1: **Send the invitation. Know who's coming.**
- Sub: SealSend handles the invitation, RSVPs, guest updates and check-in at the door. Your guests just tap a link, with no app or account to set up.
- Primary CTA: `BETA_MODE` ? "Join the free beta" : "Plan your first event free". Both go to `/signup`.
- Secondary: "See how it works", which goes to `/how-it-works`.
- Under the CTA: "Free for one event up to 50 guests. No card needed." Use the beta variant line when `BETA_MODE` is on: "Free during the beta: one event, up to 100 guests."
- Visual: `hero-stationery.webp`, full-bleed right, with the text over the empty left third on desktop. On mobile, stack the image below the text and crop to the phone and envelope.

**Alternative headlines** (A/B later):
- "Invitations people open. RSVPs you can count on."
- "Beautiful invitations. A guest list that keeps itself."

**Fact strip.** These are factual, not fake social proof:
- "Up to 250 guests per Event Pass"
- "Email and SMS updates"
- "QR check-in from any phone"
- "Guests never need an account"

**How it works.** This is a real sequence, so numbers are fine:
1. Describe your event. Paste the details or start from a template, and SealSend drafts the invitation.
2. Send it your way. By email, by text, or as a link you share anywhere.
3. Watch replies arrive, then check guests in. Live counts, dietary notes and plus-ones, and a QR scan at the door.

**Feature rows.** Alternate image left and right. Each row gets an icon from `/brand/icons`:
- **An invitation worth opening.** Pick a design, add your photo and colours, and preview exactly what guests will see. Image: `design-invitation.webp`. Icon: `invitation.svg`.
- **Every reply in one place.** See who's coming, who hasn't answered, plus-ones and dietary needs, updated the moment a guest replies. Image: `track-rsvps.webp`. Icon: `rsvp.svg`.
- **Change of plans? Tell everyone at once.** Send an update by email or text to everyone, or only to guests who said yes. Image: `guest-updates.webp`. Icon: `message.svg`.
- **A calm front door.** Scan guests in from any phone and see arrivals live. Image: `door-checkin.webp`. Icon: `checkin.svg`.

**Use cases.** A grid of 4 image cards linking to `/use-cases/*`:
- Weddings (`weddings.webp`): "Every RSVP, meal choice and plus-one in one list."
- Birthday parties (`birthdays.webp`): "Know how many kids are coming before you buy the cake."
- Community events (`community.webp`): "Run the monthly potluck without the spreadsheet."
- Event planners (`planners.webp`): "Client approvals, your branding, and a workspace for your team."

If the weddings and birthday pages aren't added, point those two cards to `/signup` with the event type, or drop them.

**For planners and organizers.** Use icons `team.svg` and `repeat.svg`.
- H2: "Built for people who host often."
- Points:
  - Workspaces with owner, admin, planner and check-in roles.
  - Your logo, colours and sender name on every event.
  - Client review links with live RSVP totals and recorded approvals.
  - Repeat an event and keep the guest list.
  - Signed webhooks for Zapier, Make or your CRM.
- CTA: "See plans for organizers", which goes to `/pricing`.

**Pricing teaser.** Three plans, read from the existing billing constants: Free $0, Event Pass $12 per event, Pro $124.99/yr (recommended). Add the line "One flat price per event, never per guest." When `BETA_MODE` is on, keep the existing "paid checkout disabled during beta" messaging.

**FAQ** (also add FAQPage JSON-LD):
- Do my guests need to download anything? No. They open a link and reply in seconds.
- Can I import my guest list? Yes. Upload a CSV or paste names, emails and phone numbers.
- How do text messages work? Every Event Pass includes 500 SMS segments, and you can buy top-ups. Email is always included.
- Can I export or delete my data? Yes. You can export your guest list any time and delete your account and events from settings.
- What happens after the beta? Your beta event stays free. Paid plans open when the beta ends, and you'll get notice first.

**Final CTA**
- H2: "Your next event, sealed and sent."
- CTA: same as the hero.
- Sub: "Free for your first event."

## 6. SEO

- **Home title:** "SealSend: Online Invitations with RSVP Tracking & Check-in" (≤60 characters).
- **Meta description:** "Send beautiful online invitations, track every RSVP, message guests by email or text, and check them in at the door. Free for your first event."
- **Primary keywords:** online invitations with RSVP, RSVP tracking, digital invitations, event check-in app. Use-case pages target "wedding RSVP website", "community event RSVP" and "event planner client approval".
- **JSON-LD:** `SoftwareApplication` with `offers`: Free 0, Event Pass 12, Pro 124.99, all in USD. Add `FAQPage` on home and pricing, and `BreadcrumbList` on use-case pages.
- **OG:** use `og.jpg` (1200×630) for every page. Replace or remove `src/app/opengraph-image.tsx` so the static image wins.
- **Sitemap:** add any new use-case slugs. Give every image descriptive alt text. Use `next/image` with `sizes`, and set priority on the hero only.

## 7. App UI polish (scope)

Apply the same tokens across the app, then do these passes:
1. Fonts and tokens: rework `globals.css` `@theme`, mapping the primary scale to Ink and the accent to Wax, and adding success = Sage.
2. Dashboard home: one clear primary action, "Create event". Give the empty state the seal illustration (logo) and one sentence.
3. Event page: the RSVP summary as large readable counts (Going / Maybe / No reply).
4. Buttons and inputs: consistent sizes, 44px targets, visible focus.
5. Mobile tab bar: check that the labels and active state are clear.
6. Auth pages: calm, centred, with the logo.

Keep the existing components and patterns. No new UI library. Don't change data, auth or payment logic.

## 8. Asset list (`/workspace/brand-assets/sealsend/`)

All of these were made with Higgsfield. `web/` holds the optimized copies to commit to the repo under `public/brand/`.

| File | Use |
|---|---|
| `web/logo-a-seal-s.svg` | **Recommended logo.** Wax seal with an S monogram. Used for the favicon and header mark (needs Cameron's approval) |
| `web/logo-b-envelope-check.svg`, `web/logo-c-seal-plane.svg` | Alternative logo candidates (not committed) |
| `web/icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png` | App and PWA icons from logo A |
| `web/hero-stationery.webp` | Home hero (2000w) |
| `web/design-invitation.webp`, `track-rsvps.webp`, `guest-updates.webp`, `door-checkin.webp` | Feature rows |
| `web/weddings.webp`, `birthdays.webp`, `community.webp`, `planners.webp` | Use-case cards and use-case page heroes |
| `web/invitation.svg`, `rsvp.svg`, `message.svg`, `checkin.svg`, `team.svg`, `repeat.svg` | Feature icon set (Ink + Wax) |
| `web/og.jpg` | Open Graph and Twitter card, 1200×630 |

Masters: `hero/`, `features/`, `use-cases/`, `og/` (2K PNG) and `logo/`, `icons/` (Recraft SVG).
