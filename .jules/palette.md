## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Accessibility-First Character Counters]
**Learning:** When implementing character counters for form fields, using `aria-live="polite"` on the counter and linking it to the input via `aria-describedby` provides critical feedback to screen reader users without being disruptive.
**Action:** Always associate character counters with their inputs using `aria-describedby` and ensure they are discoverable via `aria-live`.
