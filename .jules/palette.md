## 2025-05-22 - [Centralized Tooltip Support in Button Component]
**Learning:** For SaaS dashboards with dense data and icon-only actions, embedding tooltip support directly into the core Button component ensures consistent accessibility and discoverability without bloating page-level code.
**Action:** Use the `tooltip` prop on the `Button` component for all icon-only actions to provide both ARIA labels and visual guidance.
## 2026-06-09 - [Standardized Accessibility and UX for Form Components]
**Learning:** Consolidating accessibility features (ARIA labels, error linking) and micro-UX (password toggles, required indicators) into core UI components ensures a high baseline of quality across the entire application with minimal developer overhead.
**Action:** Use the `required` and `error` props on `Input`, `Textarea`, and `Select` components to leverage built-in accessibility linking (`aria-describedby`) and visual indicators.
