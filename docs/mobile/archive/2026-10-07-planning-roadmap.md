# SealSend mobile app roadmap

Approved planning scope: Cameron, 2026-10-07. The current deliverable is an installable web app plus an implementation-ready native roadmap. No native build, developer enrolment or store submission is claimed.

## Recommendation

Ship the shared responsive web experience first. Build native iOS and Android clients when camera/photo sharing, event reminders and check-in are validated with hosts. Prefer React Native with Expo for a shared mobile UI, reusing the server API and TypeScript/Zod contracts. Keep the Next.js website and server as the canonical backend. Do not submit a thin website wrapper: Apple's minimum-functionality review expects app-like utility beyond a repackaged website.

## Milestones and acceptance criteria

| Milestone | Deliverable | Done when | Dependencies |
| --- | --- | --- | --- |
| M0: web installation | Manifest, installation guide, standalone launch, generic offline reconnect page | Install on physical iPhone/Android, reopen signed in, expired sessions reach sign-in; no API/event/photo data in caches | HTTPS and device QA |
| M1: native foundation | Separate mobile workspace, shared API contracts, navigation, secure sessions, guest-link deep links | Signed development builds launch on both OSs; revoked/expired sessions fail closed; cross-event links cannot grant access | Apple/Google developer accounts, app identifiers, Mac/Xcode signing, Android signing keys |
| M2: guest experience | RSVP, reactions, polls, photo picker/upload and moderated album | Personal invitation opens correct event; permission denied/cancelled flows work; slow/failed uploads preserve existing state; image reads remain authenticated | M1; stable social APIs; permission strings |
| M3: host experience | Event list, guest search, check-in, photo approval and poll management | Least-privilege staff cannot edit, export or moderate; stale/duplicate check-in operations are handled; host errors are recoverable | M1; role APIs; usability sessions |
| M4: useful native features | Native photo picker/share sheet, calendar integration and optional reminders | Explicit permission/consent; no contact upload by default; reminder previews disclose what is sent; disabled features generate no external sends | M2/M3; push-provider decision and notification-consent design |
| M5: beta distribution | TestFlight internal/external groups and Play internal/closed testing | Representative hosts complete end-to-end flows; crashes and serious accessibility findings fixed; screenshots and feedback recorded | Signed builds, test accounts, review metadata and external tester consent |
| M6: public stores | Reviewable iOS/Android releases, privacy disclosures, support and release notes | Review accepted; phased rollout monitored; rollback/hotfix procedure rehearsed | M5; legal/privacy review; current billing/store-policy decision |

## Native architecture tasks

1. Create a mobile workspace with reusable screens and tokens; keep event permissions and business rules server-side. Deliver Figma layouts for guest invitation, RSVP, album, host event list and check-in before UI implementation.
2. Define mobile authentication deliberately: short-lived server sessions and secure credential storage, with rotation/revocation. Never ship a host OpenAI, Mailgun, Stripe or database key. The current cookie-authenticated APIs require an approved mobile-origin/auth design; do not bypass CSRF checks globally.
3. Add platform app/universal links and Android verified app links. Exchange invitation tokens for scoped guest access; do not place tokens in analytics, crash logs or notifications. Preserve web fallback for people without the app.
4. Add system photo picking and streaming uploads with server limits, cancellation, retries and explicit sharing permission. Handle HEIC conversion if supported later; current web upload types are JPEG/PNG/WebP only.
5. Design offline check-in separately with conflict detection and a retention policy. The initial web/native guest experience does not store attendee lists or albums offline.
6. Add optional notifications only after provider configuration and consent are verified. Notification denial must not block RSVP. Do not silently email or text from the app.
7. Keep paid features gated until the current Stripe and store-payment requirements have been reviewed for the actual product. Do not assume existing web checkout is automatically allowed inside a store app.

## QA matrix

- iPhone small/large screens and iPad; Android small/large phones and tablet; portrait/landscape, keyboard, safe areas and large text.
- VoiceOver and TalkBack: labels, headings, focus order, disabled controls, contrast, reduced motion and photo alternatives.
- Personal link opened from email/browser; wrong-event token, expired link, signed-out launch, session revocation and account deletion.
- Guest opt-in name visibility, latest RSVP, one vote per guest, closed polls, pending photos, disabled albums, owner quota and photo removal.
- Slow connection, loss/recovery, upload cancellation, repeated taps, server errors and stale event changes.
- Host roles, check-in, navigation, forms, links, timezones/DST, analytics privacy and server access denials.

## Release and rollback

Store beta and public submissions use signed versioned builds, current privacy/data-safety disclosures, support links and synthetic review credentials. Release mobile and server contracts compatibly; preserve the previous API contract until older installed versions age out. Use staged release and pause if crash, upload or authentication failures increase. A server rollback must not delete social tables or uploaded media. App review and device-test results are external evidence, not inferred from a green web build.

## Current blockers for native distribution

Developer-account access, identifiers/signing, a Mac build environment, physical devices, tester invitations and completed review metadata are not available in this workspace. These are implementation prerequisites, not completed work. No account creation, fees, tester messages or store submissions have been performed.

## Official references checked 2026-10-07

- [Apple App Review Guidelines, especially minimum functionality and privacy](https://developer.apple.com/app-store/review/guidelines/)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Apple external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — matched against the installed Next.js documentation.
