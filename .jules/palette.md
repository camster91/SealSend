## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Implicit ARIA Labels for Tooltip Buttons]
**Learning:** Simply wrapping a button in a tooltip component is insufficient for screen readers if the button contains only an icon. The tooltip text should be automatically applied as an `aria-label` to the underlying button to ensure the interaction is accessible without additional manual labeling.
**Action:** Always ensure the core `Button` component maps the `tooltip` prop to the `aria-label` attribute when children are not text-based.

## 2025-05-24 - [Dual-Layer Character Counters for Accessibility]
**Learning:** When using character counters that are visually placed above an input but technically described by it via `aria-describedby`, duplicate IDs often occur if multiple elements are used for different screen regions. Using a `-visual` suffix with `aria-hidden="true"` for decorative counters ensures the layout remains consistent without confusing screen readers or triggering duplicate ID validation errors.
**Action:** Use unique IDs for visual-only UI elements and explicitly hide them from the accessibility tree using `aria-hidden="true"`.
