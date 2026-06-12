## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Implicit ARIA Labels for Tooltip Buttons]
**Learning:** Simply wrapping a button in a tooltip component is insufficient for screen readers if the button contains only an icon. The tooltip text should be automatically applied as an `aria-label` to the underlying button to ensure the interaction is accessible without additional manual labeling.
**Action:** Always ensure the core `Button` component maps the `tooltip` prop to the `aria-label` attribute when children are not text-based.

## 2025-05-24 - [Duplicate ARIA Attributes in JSX]
**Learning:** Duplicate JSX attributes (like `aria-describedby`) can cause hard build failures in the TypeScript compilation phase. This is especially common when mixing manual ARIA attributes with those spread from `react-hook-form` or other libraries.
**Action:** Always audit components for duplicate props after refactoring, especially when using spread props on standard HTML elements.
