# SealSend AI beta release targets

These are release targets, not current results. Review them after the first 20 completed beta event workflows and revise only with recorded evidence.

| Metric | Initial target | Evidence source |
| --- | ---: | --- |
| Generation completion rate | at least 95% including safe fallback | `ai_generations.status` |
| Provider-only completion rate | at least 90% when a provider is configured | `ai_generations.provider`, `status` |
| Host acceptance rate | at least 55% | `ai_generations.outcome` |
| Median generation latency | at most 8 seconds | `ai_generations.latency_ms` |
| P95 generation latency | at most 18 seconds | `ai_generations.latency_ms` |
| Average output cost | at most USD 0.08 per accepted event draft | `estimated_cost_micros`, accepted drafts |
| Publish after accepted draft | at least 60% within 24 hours | events linked by `ai_generation_id` |
| Average host edits | establish baseline in beta before setting a target | compare accepted structured draft with saved event fields |

Privacy rules:

- Do not retain prompt or guest response bodies for metrics.
- Use prompt hashes only for abuse/replay analysis, never prompt reconstruction.
- Report cohorts only when there are at least five workflows.
- Treat fallback completion separately from provider reliability.

Public AI rollout remains blocked if validation bypasses, fabricated essential facts, uncontrolled saves/sends, or personal-data leakage are observed.
