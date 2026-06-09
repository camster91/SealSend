## 2026-06-09 - Hardening Authentication Code Delivery
**Vulnerability:** Account enumeration and potential identifier-based "bombing" attacks on the `send-code` endpoint.
**Learning:** Returning the `role` field in the `send-code` response allowed attackers to discover which emails were registered as admins before verification. Additionally, the lack of identifier-based rate limiting exposed users to targeted harassment via repeated code requests.
**Prevention:** Always remove role information from pre-authentication responses and implement dual-layer rate limiting (IP-based + identifier-based) for high-sensitivity endpoints like authentication code requests. Normalize identifiers (e.g., lowercase emails) to prevent rate-limit bypasses.
