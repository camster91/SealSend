## 2025-05-15 - Optimized Dashboard Loading and Guest Lookups
**Learning:** Database round-trips are a significant source of latency, especially when sequential. Parallelizing independent queries with `Promise.all` and merging dependent queries into a single JOIN can drastically reduce TTFB and overall page load time.
**Action:** Always check if multiple database queries can be parallelized or combined into a single efficient query. Ensure frequently queried fields (like phone numbers in guest lookups) are indexed.
## 2026-06-10 - Optimized API Authentication Lookup
**Learning:** Sequential database queries for session validation and user detail retrieval can be consolidated using a LEFT JOIN. This is particularly effective for middleware or utility functions like 'getApiUser' that are called on almost every authenticated API request.
**Action:** When fetching session data, evaluate if related user metadata can be joined in the same query to eliminate an extra round-trip.
