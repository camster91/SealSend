## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.

## 2025-05-16 - Eliminating Waterfalls in Next.js 15 Server Components
**Learning:** In Next.js 15+, `params` and `searchParams` are Promises. Awaiting them sequentially alongside `getCurrentUser()` creates a significant client-side waterfall. Scalar subqueries are an excellent way to fetch aggregate counts (e.g., response/guest counts) alongside main entity data in a single SQL round-trip.
**Action:** Use `Promise.all` to resolve `params`, `searchParams`, and session data in parallel. Use scalar subqueries to consolidate count lookups into the primary entity query.
