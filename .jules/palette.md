## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-22 - [Password Visibility Toggle in Input Component]
**Learning:** Implementing a password visibility toggle within the core Input component provides a consistent and accessible way for users to verify their input, which is especially important for complex passwords in settings and login forms.
**Action:** Use the `type="password"` prop on the `Input` component to automatically enable the visibility toggle. Ensure `focus-visible` styles are used on the toggle button to maintain keyboard accessibility.
