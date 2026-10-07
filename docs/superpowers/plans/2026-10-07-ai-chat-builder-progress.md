# SDD ledger — plan: docs/superpowers/plans/2026-10-07-ai-chat-builder.md
Spec: docs/superpowers/specs/2026-10-07-ai-chat-builder-design.md. Branches: feat/ai-chat-p1 (PR1, Tasks 1-3, includes spec+plan), feat/ai-chat-p2 (PR2, Tasks 4-6). OPENAI_API_KEY + AI_MODEL=gpt-6-luna set in prod 2026-10-07.

## Pre-flight scan
| Pair/task | Finding |
|---|---|
| T1→T2 | chatModelOutputSchema consumed by provider JSON schema — consistent |
| T1/T2→T3 | ChatTurn, ChatProvider, isAiChatConfigured, sanitizeChatTurn — consistent |
| T1→T4 | ChatTurn/ChatEventField consumed by applyChatUpdates — consistent |
| T4→T5 | applyChatUpdates/markHostEdited consumed — consistent; T5 must also call markHostEdited when host edits in manual → only matters on switch; ChatBuilder owns aiOwned in memory (lost on switch = fields become host-owned: safe) |
| T5→T6 | ChatBuilder props consumed by chat page & StartScreen — consistent |
| T5 self | needs BuilderShell ?step=review support — plan allows minimal change |
| T6 self | aiChatEnabled prop must reach BuilderShell via EventBuilder — implementer to thread it |
## Rulings
- Ruling R1: no activation_events name for chat (DB CHECK would need migration); quota rows are the only server record — cost if wrong: no chat usage analytics
- Ruling R2: aiOwned lives only in ChatBuilder memory; after switching/reload all existing values count as host-owned (AI only fills blanks / explicit overwrites) — safest default — cost if wrong: AI refines less after resume
## Progress
Task 1: dispatched (base daadba5, sonnet)
Task 1: fix round 1/5 (controller ruling: request data fields nullable/blank-tolerant; verified by controller probe)
Task 1: minor (deferred): whitespace-only title passes min(1) (matches eventUpdateSchema)
Task 1: complete (review clean + ruling fix)
Task 2: dispatched (base f7d90c4)
Task 1: fix round 2 (controller ruling: message field 'text' per spec; c63b370); probe with null/blank data passes
Task 2: complete (commits c63b370..e916a6b, review clean). Carried into Task 3: IANA timezone validation; unsupported AI_PROVIDER → unconfigured; label fields block as host data
Task 2: minor (deferred): no NODE_ENV guard on AI_PROVIDER=fake (e2e start script may need it in a prod build)
Task 3: dispatched (base e916a6b)
Task 3: fix round 1/5 (non-uuid eventId → 400; stronger no-console test; 503 test; 423c19c) — verified by controller diff read
Task 3: minor (deferred): AI_FAILED turns still consume quota; session looked up twice; timeout relies on provider honouring signal
Task 3: complete (commits e916a6b..423c19c)
PR1 #224 merged. Task 4: dispatched (base 307cc58, branch feat/ai-chat-p2)
Task 4: fix round 1/5 (event_date regex escape-collapse fixed + verified 0 backspace bytes; keyword map tightened (ruling R3: no "at the"/"from"/"by"); whitespace blank; 32e15e8)
- Ruling R3: overwrite keywords must clearly name the field — dropped "at the", "from", "by" — cost if wrong: host must use clearer words to make the AI change those fields
Task 4: complete (commits 307cc58..32e15e8)
Task 5: dispatched (base 32e15e8, opus)
Task 5: fix round 1/5 (late reply after leaving ignored; whole-turn announcements; stay in chat on failed draft; DST note filter; 73a223c) — re-review all addressed
Task 5: minor (deferred): an in-flight reply dropped silently when host leaves then stays (can resend)
Task 5: complete (commits 32e15e8..73a223c)
Task 6: dispatched (base fb5ba02)
Task 6: implementer DONE (3bb936b); concern: ChatBuilder has no templateCustomization prop
Task 6: minor (deferred → final fix): e2e preview assertion vacuous (scope to Invite preview aside at desktop width)
Task 6: minor (deferred): Switch to chat shows for published events in edit mode; AI_PROVIDER=fake has no NODE_ENV guard
Task 6: complete (commits fb5ba02..3bb936b, review clean)
Final review: package 9acabfb..3bb936b (whole project incl. merged #224)
Final review: with fixes (I1 chat off published events + leaveTo blocked; I2 e2e; I3 real OpenAI unproven). Real probe from prod container: key valid but account has NO CREDITS (429 insufficient_quota) — go-live of PR2 held until Cameron adds credits and a real turn returns 200.
Final fix wave: fa5c5c8
