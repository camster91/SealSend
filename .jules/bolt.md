## 2025-05-14 - Optimized Invited Events Fetching
**Learning:** Sequential database queries for related data (like fetching IDs first, then objects) can be significantly optimized into a single SQL JOIN. This reduces database round-trips and improves TTFB.
**Action:** Always look for opportunities to replace multiple queries with a single JOIN, especially in raw SQL environments.

## 2025-05-14 - Parallelizing Data Fetching in Next.js Server Components
**Learning:** Next.js Server Components often perform multiple independent database queries. Running these sequentially with 'await' increases total response time.
**Action:** Use 'Promise.all' for independent queries in server-side data fetching to reduce page load time.
