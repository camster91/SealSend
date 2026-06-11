## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.

## 2025-05-20 - Consolidated Dashboard Queries for Faster TTFB
**Learning:** For dashboard detail pages that require both the main record and multiple aggregate counts (e.g., responses and guests), using scalar subqueries in a single SELECT statement is more efficient than multiple sequential queries or even parallelized `Promise.all` calls, as it reduces total database overhead and eliminates the need for multiple connections.
**Action:** When a page needs a record plus related counts, consolidate them into one SQL query using scalar subqueries to minimize Time To First Byte (TTFB).
