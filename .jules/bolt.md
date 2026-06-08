## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.

## 2026-06-08 - Consolidation of Entity Counts into Single Fetch
**Learning:** Sequential queries for an entity and its associated counts (e.g., event + RSVP count + guest count) create avoidable waterfalls. Combining these into a single SQL statement with scalar subqueries reduces database round-trips from N to 1, significantly improving TTFB for dashboard views.
**Action:** Use scalar subqueries for counts when fetching a single entity to minimize sequential database calls. Use TypeScript intersection types to maintain type safety for the augmented result.
