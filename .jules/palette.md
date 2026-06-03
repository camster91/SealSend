## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.

## 2025-05-23 - [Standardizing Form Toggles for Accessibility]
**Learning:** Manual toggle implementations (using buttons and spans) often miss proper ARIA roles and associated labels. Using a standardized `Toggle` component with a `label` prop ensures screen readers correctly associate the label with the switch state.
**Action:** Replace custom toggle switches with the `Toggle` UI component to improve accessibility and maintain consistent design tokens.
