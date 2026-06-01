## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.
## 2026-06-01 - Consolidated Event Detail Data Fetching
**Learning:** Next.js 15 Server Components can benefit from parallelizing `params`, `searchParams`, and session lookups. Consolidating sequential count queries into scalar subqueries within the main entity query significantly improves TTFB.
**Action:** Use scalar subqueries to fetch related counts in a single round-trip when possible, and resolve Server Component promises in parallel using `Promise.all`.
