# Event builder, project 3: AI cover images

Date: 2026-10-07
Status: approved in conversation by Cameron. This document awaits his review.
Builds on: project 1 (manual builder, Look screen) and project 2 (AI chat, OpenAI connector and quota pattern).

## Why

Many hosts have no picture for their invite. A "Generate with AI" option on the Look screen gives them a good-looking cover in about 30 seconds without leaving SealSend.

## Scope

In scope:
- the Look screen "Generate with AI" panel;
- `POST /api/ai/cover`;
- a 3-per-day allowance;
- saving generated images as normal uploads.

Out of scope:
- image editing or variations;
- generating from the chat builder;
- logos, backgrounds and music.

## Model and configuration

- OpenAI Images API (`POST https://api.openai.com/v1/images/generations`) with `model = AI_IMAGE_MODEL`. Cameron sets this to `gpt-image-2.5-sunburst`. It reuses `OPENAI_API_KEY`.
- `isAiCoverConfigured()` is true only when `OPENAI_API_KEY` and `AI_IMAGE_MODEL` are set, or when `AI_PROVIDER=fake` (test-only). Otherwise the button is hidden and the route returns 503.
- Size is landscape `1536x1024`, one image per request (`n: 1`). Ask for base64 output (`b64_json`). If the model only returns a URL, fetch it server-side, with a 10 MB cap.
- Allowance: `AI_COVER_DAILY_LIMIT = 3` per signed-in user per rolling 24 h, via `consumeQuota("ai-cover:"+userId, 1, { max: 3, windowSeconds: 86400 })`. The quota is taken before calling OpenAI, and a failed generation still counts (the same rule as chat).
- Timeout: 90 s (`AbortController`).

## What the host sees (Look screen, cover section)

- A **Generate with AI** button sits next to the upload control, shown only when `aiCoverEnabled` (a server prop, threaded like `aiChatEnabled`). Below it, a small note reads "{n} left today". The count comes from a `GET /api/ai/cover/allowance` returning `{ remaining }`; on error, hide the count.
- Pressing it opens a panel with:
  - style chips (pick one, default Elegant): **Elegant**, **Playful**, **Watercolor**, **Photo-style**, **Minimal**;
  - an optional textarea, labelled "Anything else? (e.g. autumn leaves, navy and gold)", max 300 chars;
  - a **Generate** button.
- While working, the panel shows "Making your cover… about 30 seconds" with a reduced-motion-aware spinner. Generate is disabled.
- On success it shows the image with **Use this** and **Try again** (the button reads "Try again ({n} left)").
- **Use this** sets `design_url` to the returned `/uploads/...` URL and `design_type` to `"image"`, then closes the panel. The existing crop and focus controls apply. The update goes through `ctx.update`, so it autosaves.
- Errors keep the rest of the screen as it was:
  - `AI_COVER_LIMIT` (429): "You've used today's 3 AI covers. Upload your own, or try again tomorrow."
  - `AI_FAILED` (502) or a timeout: "We couldn't make a cover right now. Try again, or upload your own."
  - `AI_REFUSED` (422), meaning OpenAI's safety filter blocked the prompt: "That description can't be used for a cover. Try different words."
  - Storage quota full (413): the existing upload copy, "Your upload space is full."

All copy is plain grade-8 English, with SealSend tokens, 44 px targets, real labels and `aria-live="polite"` for status changes.

## How it works

### `POST /api/ai/cover`

The route runs these steps in order:
1. `requireApiHost()`.
2. Body `{ eventId: uuid, style: "elegant" | "playful" | "watercolor" | "photo" | "minimal", note?: string ≤ 300 }`. Validate `eventId` as a UUID before any DB access (otherwise 400).
3. `requireEventPermission(eventId, "edit_event")`.
4. If not configured, 503.
5. Zod check of the body (400).
6. Load the event's `title` and `description`, which are trimmed and capped at 200 and 300 characters respectively.
7. Quota (429).
8. Build the prompt.
9. Call the provider with the timeout.
10. Decode, then save through the shared upload store.
11. Return `{ url, remaining }`.

### Prompt (`buildCoverPrompt({ title, description, style, note })`, pure)

- Template: "A cover image for an event invitation: {title}. {description}. Style: {style description}. {note}". Each style maps to a fixed phrase, for example watercolor → "soft watercolor illustration".
- These lines are always appended:
  - "No text, letters, numbers, words or logos anywhere in the image."
  - "No recognisable real people or celebrities."
  - "Suitable for all ages."
- Host text (title, description, note) is quoted as data. The prompt never includes guest data, addresses or the host's email.

### Saving (`src/lib/upload-store.ts`, extracted from `src/app/api/upload/route.ts`)

- `saveImageForUser(userId, buffer, { mediaType: "image", originalName })` does:
  - magic-byte check;
  - the existing `sharp` compression;
  - the per-user advisory lock;
  - the storage-quota check (413);
  - the file write under `uploads/{userId}/`;
  - the `upload_assets` insert.

  It returns `{ url }` or `{ error: "quota" }`.
- `/api/upload` is refactored to call it, with no change in behaviour (its tests stay green). Generated images therefore count toward the same storage quota and are cleaned up the same way.

### Provider (`src/lib/ai/image-provider.ts`)

- `getCoverImageProvider()` returns `{ generate({ prompt, signal }): Promise<{ bytes: Buffer } | { refused: true }> }`.
  - The OpenAI implementation maps a safety rejection (HTTP 400 with a moderation or `content_policy` code) to `{ refused: true }`. Other errors throw, and the route maps those to `AI_FAILED`.
  - The fake implementation returns a small valid PNG generated with `sharp`.
- No prompt or error text is logged.

### Privacy

The Privacy page's OpenAI line now reads "AI drafting, chat or cover images (event title, description, chosen style and your note)".

## Testing

- **Unit tests:**
  - `buildCoverPrompt` always includes the no-text, no-people and all-ages lines, and includes the style phrase and the quoted note;
  - the request schema (rejects a bad style, a note over 300 chars, a non-UUID event id).
- **Route logic as a pure `runCoverTurn(deps, input)`, tested with fakes:**
  - happy path returns a URL;
  - the 4th request gets 429 without calling the provider;
  - a refused prompt gets 422;
  - a timeout gets 502;
  - a full storage quota gets 413;
  - provider errors never echo the prompt.
- **`upload-store` regression:** existing upload behaviour, and the quota-exceeded path.
- **Source assertions:** the Look screen shows the button only behind `aiCoverEnabled`, uses the exact copy and has `aria-live`.
- **Before go-live:** one real Sunburst generation run on the server (like the chat check). Record the latency and the image size.

## Rollout

- One PR: upload-store extraction, provider, prompt, route, allowance endpoint, UI and privacy wording.
- Cameron sets `AI_IMAGE_MODEL=gpt-image-2.5-sunburst` with `/root/set-sealsend-env.sh AI_IMAGE_MODEL`. Until then the button stays hidden.
