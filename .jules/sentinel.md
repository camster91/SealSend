## 2025-05-15 - [Dual-Layer Rate Limiting]
**Vulnerability:** Identifier-based bombing/brute-force.
**Learning:** IP-based rate limiting alone is insufficient for high-value authentication endpoints. Attackers can rotate IP addresses to target a single email or phone number, exhausting SMS/Email quotas or conducting brute-force attacks.
**Prevention:** Implement a second layer of rate limiting based on the user identifier (email or phone). This ensures that even if an attack is distributed across multiple IPs, the specific account remains protected.
