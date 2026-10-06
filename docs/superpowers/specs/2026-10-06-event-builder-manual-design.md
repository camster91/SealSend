# Event builder, project 1: start screen and manual builder

Date: 2026-10-06
Status: approved in conversation by Cameron (sections 1-4); this document awaits his review.

## Why

The current "Create New Event" wizard (`src/components/events/wizard/`) overwhelms new hosts. Step 1 alone has about 20 fields in 7 sections (AI draft panel, basic info, invitation copy, a "guest operations brief", date and time, location, settings, gift registries), written in jargon ("explicit publish blocker for host review"). Free email-only sign-ups opened on 2026-10-06, so the first screen a new host sees matters.

Goal: creating an event should feel simple, quick and a little fun, like a 2026 app: one job per screen, a live preview, nothing lost.

## Scope and roadmap

This spec covers **project 1** only. The overall plan is three projects, each with its own design, spec and build:

1. **Start screen + manual builder** (this spec). Everything else plugs into it.
2. **AI chat builder**: conversational questions, quick-reply chips, guessed next options, filling the same draft. Uses the OpenAI API (the existing `src/lib/ai/provider.ts` path). Needs `OPENAI_API_KEY` and `AI_MODEL` in production, which are unset today.
3. **AI cover image generation** via OpenAI's image model, beside manual upload. Needs per-account limits, because sign-ups are open.

Out of scope here: any AI calls. The existing `PromptToEventGenerator` panel and its "AI-assisted event draft" are removed from the manual flow; the AI routes and libraries stay for project 2.

## What the host sees

### Start screen: "What are you planning?"

Route: `/events/new`. It offers three ways in:

- **Chat with AI**: "Tell me about your event and I'll build it." Hidden until project 2 ships (and only shown when AI is configured).
- **Build it yourself**: opens the manual builder.
- **Start from a template**: a row of visual template cards from `src/lib/event-templates.ts`. Choosing one opens the manual builder with that template's styling. `?template=<id>` deep links keep working.

If the host already has an unfinished draft (see "One-event limit"), the start screen shows **Continue your draft** or **Start over**.

### Manual builder: four screens, one job each

A progress bar ("Step 2 of 4") sits at the top. Visited screens can be clicked to jump back; in edit mode, every screen is unlocked.

1. **Basics: "When and where?"**
   - Name, When (start, optional end, timezone) and Where (venue name, address).
   - "More options" (collapsed): description, hosted by, dress code, RSVP deadline, capacity (max attendees), max guests per RSVP, allow plus-ones, gift registries.
   - The server draft is created as soon as the name is filled in and the field loses focus, or Next is pressed.
2. **Look: "Make it yours"**
   - Template and style: primary and background colour, font.
   - Cover image or video, uploaded via the existing `/api/upload`, with crop and focus controls. In project 3, "Generate with AI" is added here.
   - "More" (collapsed): countdown, button style, logo, background image, music.
3. **Guests: "Who's coming?"**
   - Add one at a time, or paste a list (existing `parseGuestCsv`).
   - Guests are saved through the existing `/api/events/{id}/guests/bulk`.
   - A clear **Add guests later** button skips the screen.
4. **Review & publish: "Ready to send?"**
   - Invite headline and message, pre-written from the basics and editable.
   - "Questions to ask guests" as on/off switches over the existing RSVP fields (dietary needs, message to host, plus-ones, and so on), with an edit link for each label.
   - A checklist of the only must-haves: name, when, where.
   - Buttons: **Publish** and **Save as draft**.

### Shared by every screen

- **Live invite preview**: beside the form on desktop (≥ 1024 px), and a **Preview** button that opens a slide-up sheet on smaller screens. It reuses the public event page components, so it matches what guests see.
- **Save status**: "Saving…", then "Saved", or "Not saved, retrying…" (see Errors).
- **Switch link**: "Switch to chat", shown once project 2 ships. Both builders edit the same draft.
- **After publishing**: a short "Your invite is live" moment with **Copy link** and **Add guests**, plus a seal-press animation (reduced-motion aware).

## How it works

### Saving

- **Create:**
  - `POST /api/events` with `{ title, status: 'draft', event_timezone, organization_id?, customization? }` as soon as there is a name.
  - The builder then holds the `eventId` and puts it in the URL: `/events/{id}/build`, where `/events/new` redirects after the draft is created. A refresh or back-navigation therefore resumes the same draft.
- **Autosave:** each change is debounced (about 800 ms) and sent as `PATCH /api/events/{id}` with only the changed fields. RSVP field toggles use the existing `PUT /api/events/{id}/rsvp-fields`.
- **Publish:** `POST /api/events/{id}/publish`. That route already checks readiness and toggles status.
- **Removed:**
  - the browser-only localStorage draft (`sealsend_event_wizard_draft*`);
  - the end-of-wizard three-request save.

### One-event limit

- Free and beta accounts may have one non-archived event, and drafts count.
- `/events/new` (a server component) checks the host's non-archived events with the same query `POST /api/events` uses for the limit, before showing the three ways in.
- If one exists, the screen offers:
  - **Continue your draft**: go to `/events/{id}/build`.
  - **Start over**: confirm, then delete the draft with the existing `DELETE /api/events/{id}`, then continue.
- A published event that still counts against the limit shows the existing limit message, written in plain words.

### Publish rules

Changes to `src/lib/publication-readiness.ts`.

- **Blocking:**
  - `title`
  - a valid `event_date`
  - `location_name`
  - an `event_end_date`, if set, after the start
  - an `rsvp_deadline`, if set, before the start
- **No longer blocking:**
  - `max_attendees`
  - `event_brief.audience`
  - accessibility review
  - communication preference
  - `invitation_headline`
  - `invitation_body`
- **Headline and message defaults:** if left blank, publish fills them from the basics. The headline becomes "You're invited: {title}"; the message is a short sentence built from host, date, time and place. Both are generated server-side in the publish route, so the API stays honest.
- The `event_brief` JSONB column and its schema stay, as optional data. The brief fields are not shown in the manual builder; the AI builder in project 2 may fill them in.
- `docs/launch-operations.md` and the beta acceptance tooling that relied on brief fields must be checked and noted. Beta acceptance metrics treat a missing brief as `missing`, not as a failure.

### Data and validation

- **One shared Zod schema** (`src/lib/event-builder/schema.ts`) describes the builder's data. Each screen validates its own slice, with errors shown inline. The server keeps `eventCreateSchema` and `eventUpdateSchema` as the source of truth; the builder schema is derived from them, or kept in sync with them by test.
- **State:** a single `useReducer` (or React Hook Form instance) at the shell, not per-step forms synced back by effects.
- **Dates:** keep using `zonedLocalDateTimeToInstant` / `instantToZonedLocalDateTime` (`src/lib/datetime.ts`).

### Code shape

New folder `src/components/events/builder/`:

| File | Job |
|---|---|
| `BuilderShell.tsx` | progress bar, screen switching and transitions, preview pane/sheet, save status, Back/Next bar |
| `useEventDraft.ts` | draft create, debounced PATCH, retry/backoff, save status |
| `StartScreen.tsx` | three ways in, continue/start-over |
| `screens/BasicsScreen.tsx`, `LookScreen.tsx`, `GuestsScreen.tsx`, `ReviewScreen.tsx` | one screen each |
| `InvitePreview.tsx` | live preview built from public-event components |

Routes:
- `/events/new` (start screen)
- `/events/{id}/build` (builder, create flow)
- `/events/{id}/edit`, which becomes the builder in edit mode

The old `src/components/events/wizard/*` and `PromptToEventGenerator.tsx` are deleted at the end of the series.

**Reuse, don't rebuild:**
- `src/components/ui` primitives (Button, Input, Textarea, Select, Toggle, Card, Modal, `useToast`, `useConfirm`)
- the existing upload, guests bulk and RSVP field routes
- `parseGuestCsv`
- event templates
- the `wizardSubmitStatus` and `aiFieldTypeToRsvpFieldType` helpers (`src/lib/wizard-submit.ts`)

## Look and feel

- **Palette and type:**
  - SealSend tokens from `src/app/globals.css`: ink `#1b2a4a`, wax `#b4233c` (one accent per screen), cotton `#f4f5f8`; 10 px control and 16 px card radii.
  - Hanken Grotesk for UI text; Libre Caslon Display only for each screen's big question.
  - The builder must not use raw `gray-*`, `indigo` or `brand-600` leftovers.
- **Layout:** one big heading and short helper line per screen, roomy inputs, optional items folded under "More options".
- **Copy:** plain grade-8 English. The banned words in UI copy are "publish blocker", "operations brief", "explicit decisions" and "communication plan".
- **Motion:**
  - About 250 ms slide between screens (Framer Motion `AnimatePresence`, `useReducedMotion`).
  - Instant preview updates.
  - Seal-press on publish.
  - Everything off when reduced motion is set.
- **Phones:**
  - Full-width screens, a sticky bottom Back/Next bar, the preview as a slide-up sheet.
  - Targets ≥ 44 px and no horizontal scroll at 375 / 768 / 1440 px.
- **Fun:** Next buttons name the next screen ("Next: the look"), template cards are visual, and there's a publish celebration.
- **Accessibility:**
  - Real labels on every field.
  - Progress announced through `aria-live`, and focus moved to each screen's heading.
  - Inline errors tied to fields with `aria-describedby`.
  - Every icon-only button has an `aria-label` (enforced by `tests/icon-button-labels.test.ts`).

## Errors

- **Save fails (offline or 5xx):** the status shows "Not saved, retrying…", with retries after 1 s, 2 s and 4 s, then a **Try again** button. In-memory edits are never discarded. A `beforeunload` warning is shown only while a save is pending or has failed.
- **Validation:**
  - Inline, in plain words, for example "The end time needs to be after the start."
  - Next is never blocked by optional fields. Publish is blocked only by the must-haves, and the checklist links to each one.
- **Server limits:** the event limit, the daily email cap and rate limits (429) appear as friendly messages, never as raw codes.
- **Upload fails:** "That file didn't upload, try a smaller image (max N MB)." N comes from the upload route's limit. The rest of the event is untouched.

## Testing

- **Unit tests:**
  - the builder schema, and its consistency with `eventCreateSchema`/`eventUpdateSchema`;
  - the new publication-readiness rules (only name, when and where block, plus the date sanity checks);
  - the default headline and message;
  - the continue-or-start-over decision;
  - the debounce, retry and save-status reducer.
- **Playwright, signed-in, at 375 / 768 / 1440 px:**
  - create a draft;
  - autosave survives a reload;
  - Back and jump navigation;
  - add guests, toggle questions, publish;
  - the publish celebration;
  - edit a published event and confirm it stays published;
  - no horizontal overflow;
  - axe finds no serious or critical issues.
  - These run in CI's browser smoke tests (they need a test database, as `live-full` does).
- **Existing tests:** update `tests/readiness.test.mjs` (378-443, 484-494, 1403-1411), `tests/e2e/live-templates.spec.ts` (the localStorage draft key goes away; assert the template styling on the server draft instead) and `tests/publication-readiness.test.ts` to the new files and rules, keeping each safety intent:
  - the readiness check is still used before publishing;
  - timezone-safe date conversion;
  - the crop and focus copy.

## Rollout

- A PR series against `main`, each PR green in CI:
  1. publish-rule changes and defaults;
  2. builder shell and autosave;
  3. the four screens;
  4. start screen, routes and edit mode;
  5. delete the old wizard and update tests.
- No feature flag. The new routes replace the old wizard once PR 4 lands.
- No migration: the database schema is unchanged. Browser-only drafts from the old wizard are dropped.

## Open items (not blocking this spec)

- Project 2 needs `OPENAI_API_KEY` and `AI_MODEL` in Coolify, plus usage limits and a cost check.
- Project 3 needs an image model choice, per-account image limits and storage of generated images (the existing uploads volume).
- The paused legal and CASL work (unsubscribe link, mailing address, host identification, terms and privacy fixes) is separate and still to do.
