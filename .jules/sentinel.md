## 2025-05-14 - Dual-Layer Rate Limiting Pattern
**Vulnerability:** Sensitive authentication endpoints (OTP generation, OTP verification, password login) were only protected by IP-based rate limiting.
**Learning:** IP-based rate limiting alone is insufficient to prevent distributed attacks where an attacker uses multiple IPs to target a single account (e.g., OTP bombing or brute-forcing). Conversely, identifier-only limiting can be used for DoS against a specific user from a single IP.
**Prevention:** Implement dual-layer rate limiting on all sensitive authentication endpoints: one layer for the client IP to prevent bulk abuse, and a stricter second layer for the account identifier (email or phone) to protect individual accounts from distributed attacks.
