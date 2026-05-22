# Story 5.1: Party Mode Entry from Workflow

Status: done

## Story

As a ThinkTank user,
I want to start Party Mode from an active workflow step,
so that I can bring multiple advisor perspectives into a difficult decision without leaving the workflow.

## Acceptance Criteria

1. Given a workflow step supports Party Mode, when the AI presents available step actions, then the user can choose Party Mode as an in-workflow option, and Party Mode does not appear as an unrelated standalone MVP page.
2. Given Party Mode is disabled by feature flag or tenant configuration, when the user reaches a step that would otherwise offer it, then the option is hidden or shown as unavailable with clear messaging, and the normal single-advisor workflow remains usable.
3. Given Party Mode starts, when the system creates the party session context, then it preserves the current workflow step, user problem, report draft, and relevant conversation context, and it can return to the original workflow after the discussion.

## Tasks / Subtasks

- [x] Backend Party Mode entry contract (AC: 1, 2, 3)
  - [x] Add server-owned Party Mode availability evaluation for feature flag and tenant-scoped configuration.
  - [x] Convert the existing `party-mode` decision option from static disabled placeholder to context-aware availability.
  - [x] Handle `decisionAction: "party-mode"` through the existing advisory session message path without trusting tenant/session context from the browser.
  - [x] Persist a sanitized Party Mode session context pointer in session/checkpoint metadata.
- [x] Frontend in-workflow action wiring (AC: 1, 2)
  - [x] Keep Party Mode inside advisory workflow decision controls only; do not add standalone navigation/page entry.
  - [x] Trigger Party Mode from the existing message decision controls and `P` shortcut when enabled.
  - [x] Show disabled/unavailable messaging through existing button description/status patterns while leaving single-advisor actions usable.
- [x] ATDD and regression coverage (AC: 1, 2, 3)
  - [x] Add backend tests for enabled, disabled, and context-preservation paths.
  - [x] Add frontend tests for enabled decision action, disabled state, and no standalone entry.
  - [x] Verify existing single-advisor workflow message and document update tests remain green.

## Dev Notes

### Source Requirements

- Epic 5 defines Party Mode as workflow-embedded, serial, single-column MVP behavior, not a separate product page. Source: `_bmad-output/planning-artifacts/epics.md` Epic 5 implementation notes and Story 5.1.
- FR24 requires starting Party Mode for multiple advisor perspectives. FR27 requires resource controls later in Epic 5; Story 5.1 must create the entry/context without implementing full budget orchestration. Source: `_bmad-output/planning-artifacts/epics.md` FR24, FR27.
- UX-DR16 requires Party Mode to be a workflow option and return to the normal workflow after accepted conclusions. Source: `_bmad-output/planning-artifacts/epics.md` UX-DR16; `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` Journey 4.

### Architecture and Reuse Guardrails

- Reuse `AdvisorySessionService` and existing `sessions/:sessionId/messages` / `messages/stream` flow. Do not create a standalone Party Mode page or independent workflow launch path for this story.
- Existing backend decision option seam is `createDecisionOptions()` in `backend/src/modules/advisory/sessions/advisory-session.service.ts`; it already includes `action: "party-mode"` as disabled. Extend this seam instead of inventing a new action registry.
- Persist Party Mode context as sanitized metadata/pointers only: workflow key, current step, message counts, last message id, output id/section count, and return state. Do not store raw conversation/report content in telemetry or provider metadata.
- Tenant isolation must stay server-owned through `tenantId + BaseRepository` and authenticated `actorId`; ignore any browser-provided tenant/session ownership fields.
- Reuse `AdvisoryCheckpointService` for recovery metadata where available. Party Mode start must not corrupt resume/safe-exit/delete behavior from Epic 4.
- Frontend entry point is `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` `handleDecisionOption()`. Reuse `AdvisoryChatMessage` decision buttons, `streamThinkTankSessionMessage()`, and existing keyboard shortcut handling.
- Frontend API calls must continue to go through `/api/advisory/...` proxy/client helpers. Do not call backend URLs directly.
- Do not add production `data-testid`. Tests should prefer role, label, text, and existing accessible names.

### Previous Story Intelligence

- Story 4.6 established context compression and checkpoint metadata. Party Mode should store context pointers and compressed/recoverable metadata, not raw private content.
- Story 4.7 established safe exit and destructive delete behavior. Party Mode state must live under the same session lifecycle so users can return to the base workflow without losing prior work.
- Recent Epic 4 commits use targeted service-level Jest coverage plus frontend Testing Library checks. Follow the same pattern before broader E2E.

### Implementation Boundary

- In scope: enable/disable Party Mode as an in-message decision action, start a Party Mode context, persist return/context pointers, update UI action handling, and add tests.
- Out of scope for Story 5.1: loading distinct personas, serial expert messages, differentiated frameworks, integrated conclusion, budget enforcement, retry/timeout controls. Those belong to Stories 5.2-5.5.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: RED confirmed after unskipping Story 5.1 ATDD tests; backend failed on static disabled Party Mode and provider invocation, frontend failed because `party-mode` did not submit.
- 2026-05-22: GREEN confirmed with backend ATDD, frontend page suite, adjacent backend message/checkpoint suites, and TypeScript checks.
- 2026-05-22: Code review follow-ups resolved: latest-option server validation, disabled/forged no-side-effect rejection, non-continue return action, stale button disablement, draft preservation, disabled reason messaging, stream Party Mode coverage, and output pointer fallback.
- 2026-05-22: Second review follow-ups resolved: atomic Party Mode claim/finalize/rollback state, JSONB metadata merge finalization, checkpoint metadata coverage, and real `return-to-workflow` server/frontend path.
- 2026-05-22: Final review follow-up resolved: failed Party Mode start/return attempts now remove newly created decision messages before metadata rollback, preserving retryable latest decision state. DTO validation now permits server-owned `return-to-workflow` and rejects unknown actions.
- 2026-05-22: Advisory Chromium E2E smoke rerun passed after an initial cold-start `waitForResponse` timeout in an older Story 2.3 baseline test.
- 2026-05-22: Full backend regression passed after Story 5.1 fixes: 322 suites passed / 19 skipped; 2830 tests passed / 112 skipped / 5 todo.

### Completion Notes List

- Implemented server-owned Party Mode availability using `THINKTANK_PARTY_MODE_ENABLED` plus `THINKTANK_PARTY_MODE_TENANTS`.
- Reused the existing advisory session message/stream paths for `decisionAction: "party-mode"` and short-circuited provider calls when starting Party Mode.
- Persisted sanitized Party Mode context pointers in session/checkpoint metadata: workflow, step, message count/last message id, output id/section count, and return state.
- Wired frontend decision controls and `P` shortcut to submit `content: "启动 Party Mode"` with `decisionAction: "party-mode"` through the existing streaming client.
- Kept Party Mode out of standalone workflow navigation and preserved disabled no-op behavior.
- Addressed code review findings by requiring the latest assistant message to expose an enabled Party Mode option before backend start, preserving user drafts during decision submits, disabling stale decision controls, and avoiding report append from Party Mode return controls.
- Added repository-level atomic Party Mode start/return state transitions so failed starts roll back to a retryable state and final metadata is merged without overwriting concurrent session metadata.
- Implemented `return-to-workflow` as a server-owned decision action that exits Party Mode context and returns normal workflow decision controls without invoking the provider.
- Added cleanup for failed Party Mode start/return attempts so orphaned user/assistant messages cannot leave stale decision controls that block retry.
- Added DTO coverage for `return-to-workflow` API validation and unknown decision action rejection.
- Completed traceability matrix and quality gate with PASS across all three P0 acceptance criteria.

### File List

- `_bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-5-1-party-mode-entry-from-workflow.md`
- `_bmad-output/test-artifacts/code-review-story-5-1-party-mode-entry-from-workflow.md`
- `_bmad-output/test-artifacts/traceability-story-5-1-party-mode-entry-from-workflow-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-5-1-party-mode-entry-from-workflow.md`
- `_bmad-output/test-artifacts/gate-decision-story-5-1-party-mode-entry-from-workflow.yaml`
- `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.repository.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/components/advisory/AdvisoryChatMessage.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`

## Change Log

- 2026-05-22: Created Story 5.1 implementation context.
- 2026-05-22: Implemented Party Mode workflow entry, context pointers, frontend action wiring, and passing ATDD/regression coverage.
- 2026-05-22: Resolved code review follow-ups for action validation, idempotent UI behavior, disabled messaging, and stream coverage.
- 2026-05-22: Resolved second review blockers for retryable failed starts, atomic metadata merge, checkpoint coverage, and real return-to-workflow behavior.
- 2026-05-22: Resolved final review blocker for orphaned Party Mode messages on finalize failure, added DTO validation coverage, completed traceability, and marked story done.
