## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Implicit ARIA Labels for Tooltip Buttons]
**Learning:** Simply wrapping a button in a tooltip component is insufficient for screen readers if the button contains only an icon. The tooltip text should be automatically applied as an `aria-label` to the underlying button to ensure the interaction is accessible without additional manual labeling.
**Action:** Always ensure the core `Button` component maps the `tooltip` prop to the `aria-label` attribute when children are not text-based.

## 2025-06-16 - [Dynamic Accessibility Descriptions with cn()]
**Learning:** When a form field has both a permanent description (like a character counter) and a conditional error message, combining them in `aria-describedby` using the `cn()` utility ensures that screen readers provide both pieces of context without manual string concatenation logic in the JSX.
**Action:** Use `aria-describedby={cn("permanent-id", errors.field && "error-id")}` for accessible form fields with multiple descriptive elements.
