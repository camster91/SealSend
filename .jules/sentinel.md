## 2025-05-15 - [Rate Limiting Normalization Bypass]
**Vulnerability:** Identifier-based rate limiting was vulnerable to bypasses because the identifiers (email and phone number) were not normalized.
**Learning:** Attackers can bypass rate limits by using different casing for emails (e.g., `user@example.com` vs `User@example.com`) or different formats for phone numbers (e.g., `+1234567890` vs `1234567890`). This allows them to create multiple "buckets" for the same account.
**Prevention:** Always normalize identifiers before using them in rate-limiting keys. Emails should be converted to lowercase, and phone numbers should be formatted to a standard format (like E.164) using a validation library.
