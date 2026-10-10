# SealSend growth package
Prepared October 10, 2026; initial audience assumption: small clubs/community organizers. This is an experiment plan with two implemented feature pages, not a claim that acquisition or customer acceptance is proven.

- [Strategy and measurement](SEO-STRATEGY.md)
- [Competitor observations and sources](COMPETITOR-ANALYSIS.md)
- [Eight-week content calendar](CONTENT-CALENDAR.md)
- [Implementation checklist and owners](IMPLEMENTATION-ROADMAP.md)
- [Page architecture](SITE-STRUCTURE.md)
- [First ten-host pilot and unsent outreach draft](HOST-PILOT.md)

Candidate routes: /rsvp-tracking and /qr-event-check-in. Both have unique metadata/canonicals, useful visible answers, digital illustration, existing beta CTA, footer/cross-links and sitemap entries. Public routing explicitly permits these two pages; existing protected routes are untouched. No fake reviews or broad unlimited/free-forever claims. No new third-party scripts or graphics purchases.

Local validation: production build, typechecks, lint and593 unit/readiness tests pass. All50 marketing/navigation/visual/accessibility checks pass across five browser profiles, including both new routes and nineteen public/auth pages in the accessibility suite at three widths. Desktop and375px layouts manually inspected. Initial tests caught the missing public-route entries; corrected and final runs pass. Protected CI/deployment and Search Console measurement are separate next actions; current release status is tracked in GitHub issue #244.

Field Core Web Vitals, Google coverage, search volumes, channel conversion rates and real-host outcomes were not available in this planning pass. A source review identified invitation indexing defaults for a separate privacy decision before wider promotion; no real guest pages were crawled. Current payment/SMS/provider settings were not changed.

Conversion polish: homepage and pricing share a clear “Create a free event” action and a single honest beta offer, replacing future paid plans on the beta homepage. The hero links directly to a signup-free sample, the sample and search landing pages link back to account creation, and signup explains the email code and invitation preview. No new data collection or provider requests are introduced.

Polish validation: production build, typechecks, zero-warning lint and all 593 unit checks pass. All 90 affected browser checks pass across Chromium, Firefox, WebKit and two phone profiles, including public routes/links, sample-to-signup navigation, pricing, protected redirects and accessibility at three widths. Desktop and 375px layouts manually inspected. This verifies behavior, not a measured lead increase. Protected CI and exact production readback remain release gates.
