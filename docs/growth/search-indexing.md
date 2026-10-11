# Search indexing and invitation privacy

Application pages inherit `noindex, nofollow` from the root layout. The marketing
layout explicitly enables `index, follow`; the sitemap contains marketing pages
only. Published invitations, token links, guest login, host workspaces and account
pages stay out of search by default. There is no host opt-in to event indexing.

`X-Robots-Tag: noindex, nofollow` also covers application redirects, error pages,
API responses and uploaded invitation assets. `robots.txt` allows crawling so
search engines can read the exclusion directive. Blocking crawling alone can
still leave a discovered URL in search results. See [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Invitation Open Graph previews and RSVP access remain available to people with
the shared link. These directives apply to cooperative search engines; they do
not authenticate visitors or make a link-only invitation confidential. Existing
search entries disappear only after a crawler revisits them. This change does
not establish that a search engine has removed an existing entry.

Verification: unit configuration/sitemap checks; all five public browser profiles
check marketing and signup metadata plus application response headers. Native
isolated PostgreSQL/browser QA checks a published invitation with and without a
guest token, guest login, Open Graph preview, RSVP availability and an absent
event. Live QA uses public marketing/auth pages and fabricated invalid routes;
it does not crawl real invitations or guest data.
