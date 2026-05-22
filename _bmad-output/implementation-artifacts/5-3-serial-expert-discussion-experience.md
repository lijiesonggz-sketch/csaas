# Story 5.3: Serial Expert Discussion Experience

Status: done

## Story

As a ThinkTank user,
I want experts to speak in a clear serial discussion flow,
so that I can compare viewpoints without being overwhelmed.

## Acceptance Criteria

1. Given Party Mode is active, when advisors respond, then responses appear in the single conversation column with expert name, role, colored identity border, and current round indicator, and identity is distinguishable by label and structure, not color alone.
2. Given one advisor is responding, when the user watches the discussion, then loading or streaming state clearly identifies the current speaker, and the user can scroll, read, and select previous expert messages.
3. Given the user responds to a specific expert, when the next Party Mode turn begins, then the addressed expert can deepen the point, and other advisors can add relevant follow-up without losing shared context.

## Tasks / Subtasks

- [x] Backend serial Party Mode turn orchestration (AC: 1, 2, 3)
  - [x] Add a server-owned Party Mode discussion path after Story 5.2 `party_mode_status: "context-created"`; do not treat Party Mode start as a provider call.
  - [x] Read selected advisor metadata from session metadata and create deterministic serial advisor response messages in round order.
  - [x] Persist per-message metadata for advisor id/name/role/perspective, round number, speaking order, addressed advisor id when present, and shared context pointer.
  - [x] Emit or return a current-speaker loading/streaming descriptor so the UI can show which expert is speaking before/during message generation.
  - [x] Validate user replies addressed to an expert against selected advisor ids/names from server metadata; reject forged or stale advisor references.
- [x] Frontend single-column expert discussion rendering (AC: 1, 2, 3)
  - [x] Extend existing advisory message rendering rather than adding a standalone Party Mode page.
  - [x] Render Party Mode advisor messages in the current conversation column with expert label, role, accessible identity structure, 3px identity border, and round indicator.
  - [x] Show loading/streaming state with the current expert name and role, using `aria-live="polite"` without blocking scroll or text selection.
  - [x] Allow selecting a previous expert message as the reply target using existing accessible controls; the next submit must include a server-validated addressed expert reference.
  - [x] Preserve Enter submit, Shift+Enter newline, Escape drawer/modal behavior, and existing decision shortcuts.
- [x] Regression boundaries (AC: 1, 2, 3)
  - [x] Preserve Story 5.1 latest decision validation, feature flag/tenant allowlist, rollback cleanup, and `return-to-workflow`.
  - [x] Preserve Story 5.2 persona loading/selection, sanitized metadata pointers, omission visibility, and fail-closed source validation.
  - [x] Do not implement differentiated framework assignment, consensus/disagreement integration, report append, token budget enforcement, retries, or timeout controls in this story.
- [x] Automated coverage (AC: 1, 2, 3)
  - [x] Add backend RED tests proving serial advisor messages are generated with round/current-speaker/advisor metadata and shared context.
  - [x] Add backend tests for addressed expert validation, forged advisor rejection, stale/non-Party-Mode rejection, and no raw persona content in provider/message metadata.
  - [x] Add frontend tests for single-column Party Mode rendering, accessible labels, current-speaker loading state, message selection, and addressed reply payload.
  - [x] Re-run existing Story 5.1/5.2 Party Mode tests plus relevant message/session/frontend regressions and TypeScript checks.

## Dev Notes

### Source Requirements

- Epic 5 defines Party Mode as workflow-embedded multi-advisor discussion with controlled follow-on stories. Story 5.3 owns serial expert discussion experience only. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5 / Story 5.3]
- FR24 requires Party Mode to start multiple advisor perspectives. FR25 requires advisors to use independent persona, knowledge system, and evaluation criteria. Story 5.3 must consume the selected persona metadata created by Story 5.2 rather than reloading or reselecting advisors in the UI. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR24, FR25]
- UX-DR15 requires `PartyModeMessage` and `ExpertBadge` for serial single-column discussion with colored borders, expert names, round indicators, expert references, user replies to a specific expert, and later final integration. This story implements the message/reference/reply experience but not final integration. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR15]
- UX-DR21 requires streaming feedback to identify active generation, allow scrolling during streaming, remove the cursor after completion, and expose polite live-region updates. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR21; `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - AI 流式输出反馈]
- UX-DR30 requires keyboard support: Enter submit, Shift+Enter newline, Escape close modal/drawer, Ctrl+D drawer toggle, arrow keys for session cards, and A/P/C decision actions where active. Party Mode additions must not regress these. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR30]

### Existing Code To Reuse

- Backend orchestration belongs in the existing advisory session/message path under `backend/src/modules/advisory/sessions/`. Reuse `AdvisorySessionService`, `AdvisoryConversationMessageRepository`, and the existing `sessions/:sessionId/messages` plus `messages/stream` flow.
- Reuse Story 5.1 server-owned Party Mode seams in `backend/src/modules/advisory/sessions/advisory-session.service.ts`: `startPartyModeFromDecision()`, `returnToWorkflowFromPartyMode()`, `createPartyModeStartedResponse()`, `createPartyModeContextMetadata()`, `findLatestAssistantDecisionOption()`, and repository claim/finalize/rollback methods.
- Reuse Story 5.2 selected advisor metadata keys from session metadata: `party_mode_selected_advisor_ids`, `party_mode_selected_advisor_names`, `party_mode_selected_advisor_roles`, `party_mode_selected_advisor_perspectives`, `party_mode_selected_advisor_source_paths`, `party_mode_selected_advisor_source_hashes`, `party_mode_selected_advisor_reasons`, and `party_mode_selected_advisor_role_families`.
- Reuse `ThinkTankProviderGatewayService` and fake provider fixtures for deterministic tests if actual advisor text generation is needed. No live GLM/API call is allowed in tests.
- Frontend must extend `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`, `frontend/components/advisory/AdvisoryChatMessage.tsx`, `frontend/lib/advisory/sessions.ts`, and `frontend/lib/advisory/streaming.ts` where relevant. Do not add a standalone `/advisory/party-mode` route for MVP Story 5.3.
- Use shadcn/ui and existing Tailwind/CSAAS design language. Custom Party Mode UI belongs under `frontend/components/advisory/`; avoid production `data-testid`.

### Serial Discussion Contract

- Party Mode becomes discussable only when session metadata has `party_mode_active: true` and `party_mode_status: "context-created"`.
- A Party Mode turn is one user submission followed by advisor messages in deterministic serial order. For MVP, generate one message per selected advisor per round unless the user addressed a specific expert; then the addressed advisor must speak first and other selected advisors may follow with relevant additions.
- Current round starts at `1` after the Story 5.2 advisor-introduction message. Store round/order as scalar metadata so old messages can render without recalculation.
- Each advisor message should include:
  - `party_mode_message: true`
  - `party_mode_round`
  - `party_mode_speaker_index`
  - `party_mode_advisor_id`
  - `party_mode_advisor_name`
  - `party_mode_advisor_role`
  - `party_mode_advisor_perspective`
  - `party_mode_addressed_advisor_id` when the user replied to a specific expert
  - `party_mode_current_speaker: false` after completion
  - `ai_generated: true`
- Loading/streaming state should identify the current speaker before content is complete. If existing SSE chunk events cannot carry structured metadata, add a narrow metadata event/type in the existing stream parser rather than inventing a second streaming client.
- User reply target metadata must be server-validated. Browser-provided advisor names/ids are hints only; the backend must match them against selected advisor ids/names in session metadata and reject unknown/stale values.

### UX Guardrails

- MVP Party Mode is serial single-column expert discussion, not parallel columns. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Implementation Source of Truth / Journey 4]
- Identity cannot rely on color only. Each expert message must show a visible expert name, role, and round label; the colored border is supplemental. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Accessibility Considerations]
- `ExpertBadge` is display-only for identity and active speaker state. If a reply action is added to a message, it should be a message-level action with accessible label, not a hidden color-only affordance.
- Users must be able to scroll, read, copy, and select previous expert messages while the current expert is streaming. Avoid auto-scroll behavior that steals focus when the user is reviewing history.
- Keep text dense and operational; do not add marketing copy or a separate explanatory Party Mode landing screen.

### Previous Story Intelligence

- Story 5.1 made Party Mode availability server-owned through `THINKTANK_PARTY_MODE_ENABLED` and `THINKTANK_PARTY_MODE_TENANTS`; keep the browser untrusted for tenant/session state.
- Story 5.1 added retryable rollback and orphan-message cleanup for failed Party Mode start/return. New serial-turn failures must not leave stale latest decision states that block retry or return.
- Story 5.1 implemented `return-to-workflow` without provider calls. That control remains available while Party Mode is active and must continue to exit to the original workflow.
- Story 5.2 loads advisors from approved `_bmad/{bmm,cis,tea}/agents/**` sources and stores only sanitized pointers/hashes. Story 5.3 must not expose raw persona file content in visible text, provider metadata, telemetry, or session metadata.
- Story 5.2 start message explains selected and omitted advisors before discussion begins. Story 5.3 should append expert discussion messages after that introduction, not replace the introduction.

### Scope Boundaries

| Capability | Owner |
| --- | --- |
| Start Party Mode from workflow decision controls | Story 5.1 |
| Load/select personas and explain selected/omitted advisors | Story 5.2 |
| Serial advisor messages, current speaker state, expert identity UI, reply-to-expert | Story 5.3 |
| Differentiated framework/lens assignment and integrated conclusion/report append | Story 5.4 |
| Budget enforcement, timeout/retry/partial failure telemetry | Story 5.5 |

### Testing Requirements

- Follow TDD: create the ATDD artifact and failing tests before production changes.
- Backend focused commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/runtime --runInBand`
  - `cd backend && npx tsc --noEmit`
- Frontend focused commands:
  - `cd frontend && npm run test -- components/advisory/AdvisoryChatMessage`
  - `cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell`
  - `cd frontend && npm run test -- lib/advisory/streaming`
  - `cd frontend && npx tsc --noEmit`
- If frontend test command names differ, use the closest existing Jest/Vitest command from `package.json`; do not skip frontend coverage when UI changes.
- No test may depend on live GLM/network/provider calls. Use fake providers or deterministic service fixtures.
- Tests should use role, label, visible text, and accessible names. Do not add production `data-testid`.

### Project Structure Notes

- Keep new backend party-turn helpers small. If `AdvisorySessionService` becomes harder to maintain, extract a focused service under `backend/src/modules/advisory/sessions/` or `backend/src/modules/advisory/party-mode/` and register it in `advisory.module.ts`.
- Keep frontend UI under `frontend/components/advisory/`. A small `PartyModeMessage`/`ExpertBadge` helper is acceptable if it is composed by `AdvisoryChatMessage` and uses existing design tokens.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; this folder is ignored by default and needs `git add -f` during checkpoint commit.

### Latest Technical Information

- No external dependency or version research is required for this story. Implementation must use checked-in NestJS, Next.js, TypeScript, shadcn/ui/Tailwind, existing provider gateway, and existing advisory session APIs.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 5 and Story 5.3 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR24, FR25 and Party Mode product requirements.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - Advisory module/session/runtime organization and SSE/API flow.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Journey 4, PartyModeMessage, ExpertBadge, accessibility, and streaming feedback guidance.
- `_bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md` - Party Mode start/return and rollback guardrails.
- `_bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md` - selected advisor metadata and source validation guardrails.
- `backend/src/modules/advisory/sessions/advisory-session.service.ts` - session message orchestration and Party Mode seams.
- `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.ts` - selected advisor persona contract.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - current workflow message and decision handling.
- `frontend/components/advisory/AdvisoryChatMessage.tsx` - current message rendering.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: Story context created from Epic 5 Story 5.3, Story 5.1/5.2 implementation handoff, UX Journey 4, PartyModeMessage/ExpertBadge requirements, and advisory session/runtime architecture.
- 2026-05-22: ATDD RED phase generated backend/frontend acceptance coverage for serial advisor turns, current-speaker SSE metadata, expert identity UI, and addressed expert hint forwarding.
- 2026-05-22: Implemented server-owned Party Mode serial turn path in existing session message/stream flow; no standalone Party Mode page or raw persona source exposure.
- 2026-05-22: Code review fixes resolved Party Mode stream terminal semantics, per-session turn locking, abort cleanup, immediate delta streaming, UI rollback, pre-SSE addressed-reference validation, and prompt-cache source boundary coverage.
- 2026-05-22: Traceability matrix and quality gate generated with PASS decision: 3/3 P0 acceptance criteria fully covered.

### Completion Notes List

- Added Party Mode serial discussion for `party_mode_status: "context-created"` sessions. Each user turn now produces deterministic advisor messages with round/order/advisor/shared-context metadata.
- Added `party_mode.current_speaker` SSE event and frontend parsing/rendering so the current expert name/role is announced before streamed content.
- Added accessible expert identity rendering and reply controls in the existing single-column advisory conversation; addressed expert hints are forwarded to the backend and server-validated.
- Hardened stream failure behavior: incomplete Party Mode streams no longer count as successful, aborted/failed turns are rolled back consistently, and completed advisor bubbles from failed turns are removed from the UI.
- Preserved Party Mode start/return boundaries and Story 5.2 sanitized metadata behavior; differentiated frameworks, integrated conclusions, budget/retry/timeout controls remain out of scope.
- Validation passed: backend session suite, Story 5.1/5.2 Party Mode regressions, runtime tests, frontend AdvisoryChatMessage/WorkspaceShell/streaming tests, route proxy tests, and backend/frontend `tsc --noEmit`.

### File List

- `_bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-5-3-serial-expert-discussion-experience.md`
- `_bmad-output/test-artifacts/code-review-story-5-3-serial-expert-discussion-experience.md`
- `_bmad-output/test-artifacts/gate-decision-story-5-3-serial-expert-discussion-experience.yaml`
- `_bmad-output/test-artifacts/traceability-report-story-5-3-serial-expert-discussion-experience.md`
- `_bmad-output/test-artifacts/traceability-story-5-3-serial-expert-discussion-experience-phase1.json`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/route.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.ts`
- `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
- `frontend/components/advisory/AdvisoryChatMessage.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/lib/advisory/streaming.party-mode.atdd.test.ts`
- `frontend/lib/advisory/streaming.ts`
- `frontend/lib/advisory/workflows.ts`

## Change Log

- 2026-05-22: Created Story 5.3 implementation context and marked ready-for-dev.
- 2026-05-22: Implemented serial expert discussion experience and marked ready for review.
- 2026-05-22: Completed code review fixes, traceability PASS gate, and marked story done.
