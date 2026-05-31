## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.

## 2025-05-20 - Reducing Waterfall in Next.js 15 Server Components
**Learning:** In Next.js 15+, `params` and `searchParams` are Promises. Sequential `await` calls on these, followed by auth and database queries, create a significant waterfall. Resolving them in parallel using `Promise.all` alongside `getCurrentUser()` saves critical milliseconds on every request.
**Action:** Use `Promise.all` for initial async resolutions in Page components. Combine entity fetching and related counts into single SQL queries with subqueries to minimize round-trips.
