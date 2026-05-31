## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Accessible Character Counters for Length-Limited Inputs]
**Learning:** Providing real-time character count feedback on length-limited fields (like event descriptions) reduces user anxiety about hidden limits and improves accessibility when paired with `aria-live`.
**Action:** Use the `showCharacterCount` prop on the `Textarea` component for any multi-line input with a `maxLength` constraint.
