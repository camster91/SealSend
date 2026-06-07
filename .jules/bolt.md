## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.

## 2025-05-16 - Resolved N+1 Bottleneck in Reminder Service
**Learning:** Batching independent queries with `ANY($1)` and moving logic to SQL significantly reduces DB round-trips. When grouping results in memory, always use `(results || [])` to prevent runtime crashes on empty result sets.
**Action:** Identify loops containing database queries and refactor them into bulk fetches. Always favor SQL filtering over in-memory JavaScript filtering for large datasets.
