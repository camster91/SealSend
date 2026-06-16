## 2025-05-15 - HTML Injection in Notification Emails
**Vulnerability:** Host notification emails for new RSVPs were directly injecting `respondent_name` and `event.title` into the HTML template without sanitization.
**Learning:** Developers often focus on sanitizing inputs for web-based XSS but forget that email clients also render HTML and can be vectors for injection or phishing if they trust server-generated notifications that include user-supplied data.
**Prevention:** Always use a utility like `escapeHtml` when inserting dynamic content into any HTML-based template, including emails and server-side rendered fragments.

## 2025-05-15 - Guest Session Identification Failure
**Vulnerability:** The `verify-code` API was using the transient `auth_code.id` as the `user_id` for guest sessions instead of looking up the persistent guest ID.
**Learning:** Transient authentication records (like OTP codes) should not be used as identity identifiers. This led to sessions that couldn't be correctly mapped back to the actual guest record in subsequent requests.
**Prevention:** Always resolve the final persistent entity ID (User or Guest) during the final step of authentication before creating a session.

## 2026-06-16 - Authentication Bypass via Undefined Environment Variables
**Vulnerability:** Comparing an authorization header against a template literal containing an undefined environment variable (e.g., `Bearer ${process.env.SECRET}`) allowed attackers to bypass authentication by sending `Bearer undefined`.
**Learning:** Never assume environment variables are present during string interpolation in security-critical checks. Always verify that the secret is configured before performing any comparison.
**Prevention:** Explicitly check if the secret is defined and return a 500 error if it is missing. Use `timingSafeEqual` for all secret comparisons to further protect against timing attacks.
