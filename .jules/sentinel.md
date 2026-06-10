## 2025-05-15 - HTML Injection in RSVP Notifications
**Vulnerability:** User-supplied `respondent_name` was directly interpolated into an HTML email template sent to event hosts.
**Learning:** Even internal notification emails can be a vector for HTML injection or XSS if the recipient's email client renders the HTML.
**Prevention:** Always use `escapeHtml` when interpolating user-supplied strings into HTML templates, regardless of whether the output is for a public page or an internal notification.
