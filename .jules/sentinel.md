# Sentinel Security Journal

## 2025-05-15 - HTML Injection in Host Notifications and CSV Formula Injection
**Vulnerability:** User-controlled input was being directly interpolated into HTML strings for emails and CSV exports without proper escaping.
**Learning:** Even if data is validated by schemas (like Zod), it must still be escaped for the specific output format (HTML, CSV, etc.) to prevent injection attacks. Automated tools often miss these "manual" interpolations.
**Prevention:** Always use specialized escaping functions (like `escapeHtml` or a dedicated CSV escape helper) before interpolating data into non-parameterized strings.
