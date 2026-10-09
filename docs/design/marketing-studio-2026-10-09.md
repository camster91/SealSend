# SealSend marketing studio

## Goal and brainstorm

Make the existing marketing site more delightful for people while retaining clear beta limits, accessible navigation and working product journeys.

Three directions considered: a warm invitation studio with paper-cut illustrations; scenes of happy gatherings; a friendly seal sidekick. The working direction combines the invitation studio with gathering art and a restrained mascot. This refresh supersedes the old marketing-only cool-paper/full-bleed wedding hero direction in `docs/brand/BRIEF.md`; the product's semantic colour tokens, original logo and display/body fonts remain established.

## Plan and todo

- [x] Capture and inspect the current homepage; identify the overly wedding-specific first impression.
- [x] Create and inspect three original Higgsfield illustrations: invitation studio, good company and seal sidekick.
- [x] Integrate locally optimized WebP assets with intrinsic sizes, responsive image sizes and lazy loading outside the hero.
- [x] Build a warm split hero, an interactive sample invitation, colourful numbered workflow cards, a gathering section and friendly shared call to action.
- [x] Carry the warm surface through the shared marketing shell, footer and use-case headers; keep legal and support content readable.
- [x] Keep sample RSVP state local and explicitly label it as an example; never send or save a sample response.
- [x] Correct beta guest-limit prominence, remove unavailable SMS from wedding copy and replace internal launch-gate copy with customer-facing beta language.
- [x] Verify types, lint, 593 unit/readiness tests, five release-automation tests and production build; production dependency audit reports zero vulnerabilities.
- [x] Verify all 15 marketing routes at 375, 768 and 1440 pixels, loaded images, canonical URLs and no horizontal overflow in five browser profiles.
- [x] Verify sample theme changes, keyboard controls, reply/reset, marketing-to-auth links and every internal marketing link/CTA destination.
- [x] Run authenticated RSVP, builder, teams, announcements, uploads, check-in, privacy, offline and template suites against disposable local data.
- [x] Inspect fresh desktop/mobile rendered screenshots and fix visual flaws.
- [x] Record candidate QA, release preparation and external validation limits; final deployment proof is tracked in issue #239.

## Assets and provenance

Generated using the explicitly requested Higgsfield plugin, model `gpt_image_2_5`. First image cost preflight: 0.25 credits. Prompts ask for original tactile paper-cut art, cream/lilac/yellow/coral/sage palette, no text, no logos, no app screenshots. The first image is the style reference for the next two; no private inputs were uploaded.

| Local asset | Generation job | Use |
| --- | --- | --- |
| invitation-studio.webp | 987f1493-42c7-4931-b386-ff406d1b4973 | Homepage hero |
| good-company.webp | f87bded9-a2eb-45ed-bac2-96a6bc0b71a4 | Gathering section |
| seal-sidekick.webp | 571b2874-6594-455a-823a-ae6cfdaba2a7 | Shared call to action |

All three source images were visually inspected before conversion. The demonstration card is semantic HTML, not a screenshot of the product, and is explicitly described as illustrative. Its state clears when switching gathering or resetting; it performs no fetch, tracking or persistence.

## QA boundaries

Local synthetic journeys prove implemented behavior, not real provider delivery, physical-device camera behavior or participant acceptance. External gates in GitHub issue #236 remain separate. Preserve controlled beta and existing production safety settings. Screenshots and execution logs are kept outside tracked source under the current task's `outputs/sealsend-marketing` folder.

## Verified marketing results

The full public suite passes 135 checks, with 45 credential-dependent live checks explicitly skipped in that public run. Five additional link-integrity checks pass, bringing public evidence to 140 checks across desktop Chromium, mobile Chromium, Firefox, WebKit and mobile WebKit. Accessibility checks cover 17 public/auth routes at all three widths in every browser profile, with no serious or critical axe findings. These are automated checks, not a claim of exhaustive WCAG compliance.

Manual desktop/phone inspection confirms readable hierarchy, prominent beta limits and primary actions, appropriately labelled interactive examples, and consistent support, pricing and install surfaces. Optimized custom artwork totals about 160 KB before Next.js responsive image delivery. The install page's duplicate main landmark/skip-link ID was removed; signup retains beta context; unavailable wedding SMS and internal approval-process language were removed from customer copy.

The feature audit found two concrete recovery defects: the one-time client review URL disappeared after a failed refresh, and invitation acceptance stayed busy after a network failure. The implemented fixes retain the review URL across transient failures, provide retry controls, clear private panel state on permanent access denial, and make both workspace/event invitation failures retryable. Disposable browser assertions cover those exact failure cases. Canonical delivery and release evidence belongs in GitHub issue #239; external release gates remain in #236.

The expanded host lifecycle also caught a real repeat-event failure: passing a JavaScript registry array directly to PostgreSQL corrupted the JSONB value or rejected nonempty links. Repetition now serializes that field as JSON. The editor normalizes older malformed/string-valued records without crashing and keeps valid links available for its existing URL validation. Unit regressions and the authenticated lifecycle verify a nonempty registry survives repetition and the new draft editor opens.

The complete native PostgreSQL/HTTPS run passes eight authenticated Playwright checks (full lifecycle/navigation, builder at three widths, every launch template, account export and deletion cancellation, and fake-AI draft/resume/review) plus all synthetic browser helpers. Helpers cover client CRUD/assignment/private approval/history CSV/revocation/expiry, workspace and event invite acceptance/denial/replay/network retry, brand create/update/validation/removal/application, owner/planner/outsider permissions, calendars, future announcement approval/queue/cancellation, and signed local webhook retry/delivery. Existing RSVP concurrency/edit/capacity, announcements, QR/camera permissions, social moderation/uploads/private-file deletion, sharing and offline recovery checks also pass. No server TypeError or browser runtime error remains in the successful run. Fake AI and loopback webhook delivery are local fixtures; production flags remain controlled.

Release preparation captured and fully read a fresh database archive, saved uploads/configuration and retained the currently healthy `625a59b` rollback image. Deployment, immutable revision checks and final public verification are recorded in issue #239 after required Build CI succeeds; this source document does not claim a deployment before it happens.

Linux mobile WebKit exposed a screenshot capture limit: the full homepage at device pixel ratio 3 exceeded 32767 physical pixels. Visual captures now use CSS-pixel scaling while retaining full-page coverage and responsive overflow assertions; no tests or browser profiles are skipped.

The initial marketing release (15610a6) passed protected PR/default-branch CI and deployed healthy with unchanged runtime/uploads/resources. Direct production QA then exposed an intermittent early keyboard activation: SSR navbar buttons were focusable before React hydration attached handlers. The controls now remain disabled until hydration. A regression deliberately holds Next client scripts, proves both menu controls disabled, then releases scripts and proves keyboard activation. Thirty focused checks pass (both navigation and delayed hydration repeated three times across five profiles); the follow-up build, lint and types pass. Final protected CI/deployment and production results remain tracked in #239.
