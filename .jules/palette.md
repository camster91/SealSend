## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Accessible Password Visibility Toggle]
**Learning:** Providing a built-in password visibility toggle in the `Input` component improves UX by reducing entry errors and enhances accessibility by ensuring the toggle is keyboard-navigable and screen-reader friendly (using proper ARIA labels).
**Action:** Use the `type="password"` prop on the `Input` component to automatically enable the visibility toggle.
