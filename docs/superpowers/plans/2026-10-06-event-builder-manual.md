# Event builder (project 1) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-step "Create New Event" wizard with a start screen and a four-screen manual builder. The builder saves a server draft early, autosaves, shows a live preview, and only needs name, when and where to publish.

**Architecture:** Pure logic lives in `src/lib/event-builder/` and is unit-tested with `node --test`: the data model, the patch diff, the save-status reducer and the start-screen decision. React lives in `src/components/events/builder/`: a shell, one file per screen, and a preview that reuses the public-event components. The server keeps its existing routes. Only the publish rules change, and default invitation copy is filled in at publish time.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 tokens from `src/app/globals.css`, Framer Motion (already a dependency), Zod, `node --import tsx --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-event-builder-manual-design.md`. Read it before starting. This plan argues from it.

## Global constraints

- Plain grade-8 English in UI copy. Never use these phrases in UI text: "publish blocker", "operations brief", "explicit decisions", "communication plan".
- Tokens only: ink `#1b2a4a`, wax `#b4233c` (at most one accent per screen), cotton `#f4f5f8`. Radii are 10 px (controls) and 16 px (cards). No raw `gray-*`, `indigo`, `#6366f1` or `brand-600` in new builder files.
- Fonts: Hanken Grotesk (`font-sans`) for UI, Libre Caslon Display (`font-display`) only for each screen's main question.
- Screen transitions take about 250 ms and must respect `useReducedMotion()`. Preview updates instantly.
- Tap targets are at least 44 px. No horizontal scroll at 375, 768 or 1440 px.
- Every icon-only button needs an `aria-label` (`tests/icon-button-labels.test.ts`).
- Dates go through `zonedLocalDateTimeToInstant` / `instantToZonedLocalDateTime` (`src/lib/datetime.ts`). Never use `new Date(local).toISOString()`.
- Autosave debounce is 800 ms. Save retries happen after 1 s, 2 s and 4 s, then a **Try again** button appears.
- Upload limits are shown to hosts as "max 10 MB for images, 50 MB for video" (from `src/app/api/upload/route.ts`).
- Routes: `/events/new` is the start screen, `/events/[eventId]/build` is the builder in create flow, and `/events/[eventId]/edit` is the builder in edit mode.
- No database migration. `event_brief` stays as an optional column.
- One PR per phase below, each green in CI (required check `Build`). Merge to `main` auto-deploys.
- Windows checkouts fail 2 known CRLF schema-regex tests in `tests/readiness.test.mjs`. Ignore those two only.

## Review focus

These are inputs the spec implies but no happy-path test covers. Each line names the task that adds the pinning test.

1. **Out-of-order saves.** A slow PATCH for older content must never overwrite newer content. Saves are serialized, and the latest snapshot wins. Pinned in Task 4: `"a save started while another is in flight sends the latest snapshot after it, not before"`.
2. **Double draft creation.** A name blur followed quickly by Next must create exactly one event, never two or a limit error. Pinned in Task 4: `"createDraft is single-flight"`.
3. **Editing a published event and clearing a must-have.** The server rejects a PATCH that makes a published event not ready (400). Autosave must not loop. The field shows "A published event needs a place." and the save is held until it's filled. Pinned in Task 4: `"a 400 with blockers stops retrying and surfaces field errors"`, and in Task 6.
4. **Timezone and DST.** A local "2026-11-01 01:30" in America/Toronto must round-trip through the patch diff unchanged. Pinned in Task 3: `"date fields round-trip through toPatch/fromEvent in the event timezone"`.
5. **A leftover draft or published event at the one-event limit.** The start screen must offer Continue / Start over, or explain the limit. It must never send the host into a builder that fails on first save. Pinned in Task 10: `"decideStart"` cases.

---

## Phase 1 (PR 1): Publish rules and default invite copy

### Task 1: Only name, when and where block publishing

**Files:**
- Modify: `src/lib/publication-readiness.ts`
- Modify: `tests/publication-readiness.test.ts`

**Interfaces:**
- Produces: `getPublicationReadiness(candidate: PublicationCandidate): { ready: boolean; blockers: PublicationBlocker[] }`. The signature is unchanged. `PublicationBlocker["field"]` narrows to `"title" | "event_date" | "event_end_date" | "location_name" | "rsvp_deadline"`.

- [ ] **Step 1: Rewrite the tests for the new rules.** Replace the first test's expected list with `["title", "event_date", "location_name"]`, using the same all-blank input. Add:
  - `"capacity, brief and invitation copy no longer block publishing"`: title "Dinner", a valid `event_date`, `location_name` "Hall", `max_attendees` null, `event_brief` null, headline and body null. Expect `ready === true`.
  - Keep the existing end-after-start and deadline-before-start cases.
- [ ] **Step 2: Run them and check they fail.** `node --import tsx --test tests/publication-readiness.test.ts` should FAIL. The blocker list still contains `max_attendees` and the brief fields.
- [ ] **Step 3: Remove the capacity, `event_brief.*`, headline and body checks** from `getPublicationReadiness`. Keep the messages for the remaining checks, but use plain words: "Add a name for your event.", "Pick a start date and time.", "Set an end time after the start.", "Add where it's happening.", "Set the RSVP deadline before the event starts."
- [ ] **Step 4: Run them and check they pass.** Same command, expect PASS. Then run `npm test`. `tests/readiness.test.mjs` may assert old messages; update only those assertions to the new strings.
- [ ] **Step 5: Commit** with message `feat(publish): only name, when and where block publishing`.

### Task 2: Fill blank invite copy at publish time

**Files:**
- Create: `src/lib/invitation-defaults.ts`
- Create: `tests/invitation-defaults.test.ts`
- Modify: `src/app/api/events/[eventId]/publish/route.ts`
- Modify: `src/app/api/events/[eventId]/route.ts` (the PATCH path where `targetStatus === 'published'`)
- Modify: `src/app/api/events/route.ts` (POST when `status === 'published'`)
- Modify: `package.json` (add the test file to `"test"`)

**Interfaces:**
- Produces: `defaultInvitationCopy(event: { title: string; host_name?: string | null; event_date?: string | Date | null; event_timezone?: string | null; location_name?: string | null }): { headline: string; body: string }`
- Produces: `withDefaultInvitationCopy<T extends { invitation_headline?: string | null; invitation_body?: string | null }>(event: T & Parameters<typeof defaultInvitationCopy>[0]): T`. This fills only blank fields.

- [ ] **Step 1: Write the tests.**
  - `"headline is You're invited: {title}"`: `{ title: "Volunteer dinner" }` gives headline `"You're invited: Volunteer dinner"`.
  - `"body names host, date and place when known"`: host "Riverside Volunteers", `event_date` "2026-09-20T22:00:00Z", timezone "America/Toronto", location "Community Hall". The body contains "Riverside Volunteers", "September 20", "6:00 PM" and "Community Hall".
  - `"body still reads well with only a title"`: the body is non-empty and contains no "undefined" or "null".
  - `"withDefaultInvitationCopy never overwrites host text"`: an existing headline "Come!" stays "Come!", and a blank body gets filled.
- [ ] **Step 2: Run them and check they fail.** `node --import tsx --test tests/invitation-defaults.test.ts` should FAIL with the module not found.
- [ ] **Step 3: Implement `defaultInvitationCopy` and `withDefaultInvitationCopy`.** Format the date with `Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })`. Use this body template: `"{host or 'We'} would love for you to join us{ on <date>}{ at <place>}. Please let us know if you can make it."`
- [ ] **Step 4: Apply the defaults wherever an event becomes published.**
  - **Publish route:** before the readiness check, compute `withDefaultInvitationCopy(event)`. If either field was blank, include `invitation_headline` and `invitation_body` in the `UPDATE events SET status = $1, invitation_headline = $3, invitation_body = $4 WHERE id = $2`.
  - **PATCH and POST:** when the target status is `published`, merge the defaults into the values written.
  - Add a readiness-style source assertion to `tests/invitation-defaults.test.ts`: each of the three route files contains `withDefaultInvitationCopy(`.
- [ ] **Step 5: Run checks.** `npm test` should pass (except the 2 known CRLF tests), and `npm run typecheck` should pass.
- [ ] **Step 6: Commit** with message `feat(publish): write default invite headline and message when blank`, then open **PR 1**.

---

## Phase 2 (PR 2): Builder core

### Task 3: Builder data model and patch diff

**Files:**
- Create: `src/lib/event-builder/schema.ts`
- Create: `src/lib/event-builder/mapping.ts`
- Create: `tests/event-builder-schema.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `BuilderData`. It has the same fields as today's `WizardFormData` (`src/components/events/wizard/WizardContainer.tsx:49-73`) minus `guests`, `reminder_sequence` and `ai_generation_id`. Date fields are zoned-local strings (`"YYYY-MM-DDTHH:mm"`).
- Produces: `builderDataSchema: z.ZodType<BuilderData>`, and `BUILDER_SCREENS = ["basics", "look", "guests", "review"] as const` with `type BuilderScreen = typeof BUILDER_SCREENS[number]`.
- Produces: `fromEvent(event: Event, rsvpFields: RSVPField[]): BuilderData`. This moves the mapping now inline in `src/app/(dashboard)/events/[eventId]/edit/page.tsx:54-100` and keeps the same defaults, except `primaryColor` defaults to `#1b2a4a` instead of `#6366f1`.
- Produces: `toPatch(prev: BuilderData, next: BuilderData): Partial<EventUpdatePayload> | null`. It returns only changed top-level fields, converts dates with `zonedLocalDateTimeToInstant(value, next.event_timezone)` (`""` becomes `null`), and returns `null` when nothing changed. `rsvp_fields` is excluded because it saves through its own route.
- Produces: `emptyBuilderData(timezone: string, customization?: Partial<EventCustomization>): BuilderData`.

- [ ] **Step 1: Write the tests.**
  - `"schema accepts what eventUpdateSchema accepts"`: for a fully filled `BuilderData`, `eventUpdateSchema.safeParse(toPatch(emptyBuilderData("UTC"), filled))` succeeds.
  - `"toPatch sends only changed fields"`: changing `title` only gives `{ title }`.
  - `"toPatch returns null when nothing changed"`.
  - `"date fields round-trip through toPatch/fromEvent in the event timezone"`: `event_date` "2026-11-01T01:30" in "America/Toronto" goes through patch, then `fromEvent` (with the instant written back), and comes out as "2026-11-01T01:30".
  - `"clearing a date sends null"`.
- [ ] **Step 2: Run them and check they fail.** `node --import tsx --test tests/event-builder-schema.test.ts` should FAIL with the module not found.
- [ ] **Step 3: Implement `schema.ts` and `mapping.ts`.** Point the edit page at `fromEvent` (a behaviour-preserving refactor).
- [ ] **Step 4: Run checks.** The new tests pass, and `npm run typecheck` passes.
- [ ] **Step 5: Commit** with message `feat(builder): data model, event mapping and patch diff`.

### Task 4: Draft saving: single-flight create, serialized autosave, retries

**Files:**
- Create: `src/lib/event-builder/save-machine.ts` (pure reducer and scheduler logic)
- Create: `src/components/events/builder/useEventDraft.ts` (React hook that wires the machine to `fetch`)
- Create: `tests/event-builder-save.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `toPatch` and `BuilderData` from Task 3.
- Produces: `type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "retrying"; attempt: 1 | 2 | 3 } | { kind: "failed"; message: string } | { kind: "blocked"; fieldErrors: Partial<Record<keyof BuilderData, string>> }`
- Produces: `createSaveQueue(deps: { send: (patch: object) => Promise<Response>; now: () => number; sleep: (ms: number) => Promise<void> }): { enqueue(prev: BuilderData, next: BuilderData): void; flush(): Promise<void>; onStatus(cb: (s: SaveStatus) => void): () => void }`
- Produces: `createSingleFlight<T>(fn: () => Promise<T>): () => Promise<T>`
- Produces: `useEventDraft(opts: { eventId?: string; initial: BuilderData; organizationId?: string; templateCustomization?: Partial<EventCustomization> }): { data: BuilderData; update(patch: Partial<BuilderData>): void; eventId?: string; status: SaveStatus; ensureDraft(): Promise<string>; retry(): void }`. `ensureDraft` POSTs `/api/events` with `{ title, status: "draft", event_timezone, organization_id, customization }` once, then `router.replace(\`/events/${id}/build\`)`.

- [ ] **Step 1: Write the tests** against `createSaveQueue` and `createSingleFlight`, using a fake `send`, `sleep` and `now`.
  - `"a save started while another is in flight sends the latest snapshot after it, not before"`: enqueue A, and while A's send is pending enqueue B, then C. The sends are A, then one send whose body equals `toPatch(A, C)`.
  - `"createDraft is single-flight"`: calling the wrapped function 3 times concurrently runs `fn` once and resolves all three with the same id.
  - `"5xx retries after 1s, 2s, 4s then fails"`: the `sleep` calls are `[1000, 2000, 4000]`, and the final status kind is `"failed"`.
  - `"a 400 with blockers stops retrying and surfaces field errors"`: `send` returns 400 `{ blockers: [{ field: "location_name", message: "Add where it's happening." }] }`. The status is `{ kind: "blocked", fieldErrors: { location_name: "Add where it's happening." } }`, and there are no retries.
  - `"429 shows the server message without retrying"`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the save queue.**
  - Hold one in-flight promise and one pending snapshot.
  - When a send settles, diff the last saved data against the pending snapshot and send that.
  - The 800 ms debounce lives in the hook, not the queue.
- [ ] **Step 4: Implement `useEventDraft`.**
  - Debounce `enqueue` by 800 ms.
  - Add a `beforeunload` warning only while the status is `saving`, `retrying` or `failed`.
  - `ensureDraft` uses `createSingleFlight`.
- [ ] **Step 5: Run checks.** Tests pass, and so does typecheck.
- [ ] **Step 6: Commit** with message `feat(builder): serialized autosave with retries and single-flight draft create`.

### Task 5: Builder shell and live preview

**Files:**
- Create: `src/components/events/builder/BuilderShell.tsx`
- Create: `src/components/events/builder/InvitePreview.tsx`
- Create: `src/components/events/builder/SaveIndicator.tsx`
- Create: `tests/event-builder-shell.test.mjs` (source assertions, the same style as `readiness.test.mjs`)
- Modify: `package.json`

**Interfaces:**
- Consumes: `useEventDraft`, `BUILDER_SCREENS` and `BuilderScreen`.
- Produces: `BuilderShell(props: { mode: "create" | "edit"; eventId?: string; initial: BuilderData; organizationId?: string; templateCustomization?: Partial<EventCustomization>; screens: Record<BuilderScreen, (ctx: ScreenContext) => ReactNode> })`
- Produces: `ScreenContext = { data: BuilderData; update(p: Partial<BuilderData>): void; eventId?: string; ensureDraft(): Promise<string>; fieldErrors: Partial<Record<keyof BuilderData, string>>; goTo(s: BuilderScreen): void; mode: "create" | "edit" }`
- Produces: `InvitePreview({ data }: { data: BuilderData })`. It renders `EventHero` and `EventDetails` from `src/components/public-event` with a synthesized `Event`. Add a `builderDataToPreviewEvent(data): Event` helper to `mapping.ts`.

- [ ] **Step 1: Write the source-assertion tests.**
  - `BuilderShell.tsx` contains `useReducedMotion`, `aria-live`, `AnimatePresence`, and `Step ${` for the "Step 2 of 4" copy.
  - It contains none of `gray-`, `indigo`, `#6366f1` or `brand-600`.
  - `InvitePreview.tsx` imports `EventHero` and `EventDetails`.
  - `SaveIndicator.tsx` contains "Saving…", "Saved" and "Not saved, retrying…".
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the shell.**
  - A progress bar with clickable visited steps; all steps are unlocked in edit mode.
  - A sticky bottom Back/Next bar on screens under 1024 px.
  - The preview sits in a right column at ≥ 1024 px, or a slide-up `Modal` sheet triggered by "Preview".
  - Focus moves to the screen `h1` on change.
  - Next is labelled "Next: {next screen name}".
- [ ] **Step 4: Run checks.** Tests, typecheck, and `npx eslint --max-warnings=0` on the new files all pass.
- [ ] **Step 5: Commit** with message `feat(builder): shell, live preview and save indicator`, then open **PR 2**. Nothing routes to the builder yet.

---

## Phase 3 (PR 3): The four screens

Each screen is a component `(ctx: ScreenContext) => ReactNode` in `src/components/events/builder/screens/`. It uses `src/components/ui` primitives. The `h1` is in `font-display`. Optional items sit under a "More options" disclosure.

### Task 6: Basics screen

**Files:**
- Create: `src/components/events/builder/screens/BasicsScreen.tsx`
- Create: `src/lib/event-builder/basics-validation.ts`
- Create: `tests/event-builder-basics.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateBasics(d: BuilderData, opts: { published: boolean }): Partial<Record<keyof BuilderData, string>>`

- [ ] **Step 1: Write the tests.**
  - `"end before start"` gives `event_end_date: "The end time needs to be after the start."`
  - `"deadline after start"` gives `rsvp_deadline: "The RSVP deadline needs to be before the event."`
  - `"a published event cannot lose its place"`: with `published: true` and an empty location, the result is `location_name: "A published event needs a place."`
  - `"drafts may leave everything blank"`: with `published: false` and empty data, the result is `{}`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement `validateBasics` and `BasicsScreen`.**
  - Heading: "When and where?"
  - Fields: Name, When (start, end, timezone select), Where (venue name, address).
  - "More options" holds: description, hosted by, dress code, RSVP deadline, capacity, max guests per RSVP, allow plus-ones, gift registries.
  - Name `onBlur` calls `ctx.ensureDraft()` in create mode.
  - Show errors under each field with `aria-describedby`.
  - For published events, don't send a field that `validateBasics` flags. Hold it in local state until it's valid (Review focus 3).
- [ ] **Step 4: Run checks.** Tests and typecheck pass.
- [ ] **Step 5: Commit** with message `feat(builder): basics screen`.

### Task 7: Look screen

**Files:**
- Create: `src/components/events/builder/screens/LookScreen.tsx`
- Modify: `tests/event-builder-shell.test.mjs`

- [ ] **Step 1: Add source assertions.**
  - `LookScreen.tsx` contains "Make it yours", "Artwork crop and focus", "keeps the uploaded original" (copy carried over from `StepDesignUpload.tsx`, which `readiness.test.mjs:1403-1411` protects) and "max 10 MB for images, 50 MB for video".
  - It uses `/api/upload`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the screen.**
  - Template cards from `EVENT_TEMPLATES` apply the template's `customization`.
  - Colour pickers (primary, background) and a font select.
  - Cover upload: port the upload and crop logic from `StepDesignUpload.tsx` (image / video / URL modes), then delete nothing yet.
  - "More": countdown, button style, logo, background image, music.
- [ ] **Step 4: Run checks.** Tests, typecheck and lint pass.
- [ ] **Step 5: Commit** with message `feat(builder): look screen`.

### Task 8: Guests screen

**Files:**
- Create: `src/components/events/builder/screens/GuestsScreen.tsx`
- Modify: `tests/event-builder-shell.test.mjs`

- [ ] **Step 1: Add source assertions.** `GuestsScreen.tsx` contains "Who's coming?", "Add guests later" and `parseGuestCsv`, and posts to `/guests/bulk`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the screen.**
  - Add a single guest or paste a list.
  - Call `ctx.ensureDraft()`, then POST `/api/events/{id}/guests/bulk` per add.
  - Show the saved guest list from `GET /api/events/{id}/guests`.
  - "Add guests later" calls `goTo("review")`.
  - Show the 100-guest beta limit error as plain words.
- [ ] **Step 4: Run checks.** Tests, typecheck and lint pass.
- [ ] **Step 5: Commit** with message `feat(builder): guests screen`.

### Task 9: Review & publish screen, plus celebration

**Files:**
- Create: `src/components/events/builder/screens/ReviewScreen.tsx`
- Create: `src/components/events/builder/PublishedCelebration.tsx`
- Modify: `tests/event-builder-shell.test.mjs`

- [ ] **Step 1: Add source assertions.**
  - `ReviewScreen.tsx` contains "Ready to send?", "Questions to ask guests", `getPublicationReadiness`, "Publish" and "Save as draft", and calls `/publish`.
  - `PublishedCelebration.tsx` contains "Your invite is live", "Copy link" and "Add guests", and uses `useReducedMotion`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the screen.**
  - Headline and message are editable. Placeholders show the `defaultInvitationCopy` result so hosts see what will be used.
  - RSVP fields show as switches (`is_enabled`) with an editable label, saved via `PUT /api/events/{id}/rsvp-fields`.
  - A must-haves checklist from `getPublicationReadiness(data)`; each item links with `goTo("basics")`.
  - **Publish** calls `flush()`, then `POST /api/events/{id}/publish`, then shows the celebration with a seal-press. On a 400 with blockers, show them in the checklist.
  - **Save as draft** calls `flush()`, then goes to `/events/{id}`.
  - In edit mode on a published event, the button reads "Save changes", and no publish toggle is needed.
- [ ] **Step 4: Run checks.** Tests, typecheck and lint pass.
- [ ] **Step 5: Commit** with message `feat(builder): review & publish screen and celebration`, then open **PR 3**.

---

## Phase 4 (PR 4): Start screen, routes and edit mode

### Task 10: Start screen and routes

**Files:**
- Create: `src/lib/event-builder/start-decision.ts`
- Create: `tests/event-builder-start.test.ts`
- Create: `src/components/events/builder/StartScreen.tsx`
- Create: `src/app/(dashboard)/events/[eventId]/build/page.tsx`
- Modify: `src/app/(dashboard)/events/new/page.tsx`
- Modify: `src/app/(dashboard)/events/[eventId]/edit/page.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `decideStart(openEvents: Array<{ id: string; status: "draft" | "published"; title: string }>, canCreate: boolean): { kind: "fresh" } | { kind: "continue-draft"; eventId: string; title: string } | { kind: "at-limit"; eventId: string; title: string }`. Here `canCreate` is `canCreateEvent(await getUserTier(user.id), openEvents.length)` from `src/lib/entitlements.ts`, the exact rule `POST /api/events` enforces.

- [ ] **Step 1: Write the tests** (Review focus 5).
  - `[]` with `canCreate` true gives `fresh`.
  - One draft with `canCreate` false gives `continue-draft` for that draft.
  - One published event with `canCreate` false gives `at-limit`.
  - Events present but `canCreate` true gives `fresh`.
  - Draft plus published with `canCreate` false gives `continue-draft`, pointing at the draft.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement `decideStart`** as a pure function. The page loads open events with the same SQL as `src/app/api/events/route.ts:82`: the user's events with `status <> 'archived'`, also selecting `id`, `status` and `title`.
- [ ] **Step 4: Build `/events/new`.** It's a server component that keeps the `?template` and `?workspace` handling. It renders `StartScreen` with:
  - **"What are you planning?"** heading;
  - a **Build it yourself** card, which creates nothing yet and opens the Basics screen in a client-only builder until `ensureDraft`;
  - a template row;
  - for `continue-draft`: **Continue your draft** / **Start over**. Start over uses `useConfirm`, then `DELETE /api/events/{id}`, then the fresh view;
  - for `at-limit`: "Free accounts can have one active event. Open {title} or archive it to start another." with a link.

  No Chat card yet (project 2).
- [ ] **Step 5: Build `/events/[eventId]/build` and update `/edit`.**
  - `/events/[eventId]/build` loads the event (with `getEventAccess`/`roleCan(..., 'edit_event')` as the edit page does) and renders `BuilderShell mode="create"` with `fromEvent(...)`.
  - `/events/[eventId]/edit` renders `BuilderShell mode="edit"`.
- [ ] **Step 6: Run checks.** Tests, typecheck and `npm run build` pass. Manually run `npm run dev`: sign in, create, reload mid-flow, and confirm the draft resumes.
- [ ] **Step 7: Commit** with message `feat(builder): start screen, build route, edit uses builder`, then open **PR 4**.

---

## Phase 5 (PR 5): Remove the old wizard; update tests

### Task 11: Delete the wizard and repoint the safety tests

**Files:**
- Delete: `src/components/events/wizard/` (all files) and `src/components/events/PromptToEventGenerator.tsx`. Keep the AI routes and `src/lib/ai`.
- Modify: `tests/readiness.test.mjs` (the `378-443`, `484-494` and `1403-1411` blocks)
- Modify: `tests/e2e/live-templates.spec.ts`
- Create: `tests/e2e/live-builder.spec.ts`

- [ ] **Step 1: Repoint the readiness assertions to the new files, keeping each one's intent.**
  - `ReviewScreen.tsx` uses `getPublicationReadiness`.
  - `mapping.ts` uses `zonedLocalDateTimeToInstant(` and does not contain `new Date(` together with `toISOString()` on local values.
  - `LookScreen.tsx` contains "Artwork crop and focus" and "keeps the uploaded original".
  - `new/page.tsx` contains `getEventTemplate`.
  - Delete the assertions about brief `register(...)` calls, `id="title-counter"` and `PromptToEventGenerator`. They pinned deleted UI.
- [ ] **Step 2: Update `live-templates.spec.ts`.** For each template, open `/events/new?template=<id>`, choose **Build it yourself**, type a name, wait for "Saved", then `GET /api/events/{id}` and expect `customization` to match `template.customization`. Archive or delete the event after each template.
- [ ] **Step 3: Write `live-builder.spec.ts`.**
  - Skip unless `SEALSEND_TEMPLATE_EMAIL` and `SEALSEND_TEMPLATE_PASSWORD` are set; sign in the same way as `live-templates.spec.ts`.
  - At widths 375, 768 and 1440, go through: start screen, basics (name, date, place), reload (the draft resumes), look, guests ("Add guests later"), review, then Publish and "Your invite is live".
  - Then: edit, change the title, see "Saved", reload, and confirm the status is still published.
  - Check no horizontal overflow and that axe finds no serious or critical issues.
  - Delete the event at the end.
- [ ] **Step 4: Run checks.**
  - `npm test`: all pass except the 2 known CRLF tests.
  - `npm run typecheck`, `npm run lint` and `npm run build` pass.
  - `npx playwright test tests/e2e/event-create.spec.ts tests/e2e/visual.spec.ts`: PASS.
  - Run `live-builder` against a local `npm run dev` with QA credentials and report the result in the PR.
- [ ] **Step 5: Commit** with message `chore(builder): remove old wizard, repoint safety tests, add live builder QA`, then open **PR 5**.

---

## After PR 5

- Run `live-builder.spec.ts` against production with the QA account, then delete the QA event.
- Update `DEPLOYMENT_READINESS.md`'s current-production note with the new publish rules (name, when and where) and the builder.
