# Story 5.5: Party Mode Resource and Failure Controls

Status: done

## Story

As a platform operator,
I want Party Mode to enforce budget and failure boundaries,
so that multi-advisor discussions do not destabilize the core consulting workflow.

## Acceptance Criteria

1. Given Party Mode is active, when advisor calls are made, then the system enforces the configured token or cost budget for the party session, remaining budget state is available to the orchestration layer, and budget exceedance emits telemetry event `thinktank.party_mode.budget_exceeded`.
2. Given an advisor call times out or partially fails, when the discussion continues, then the UI shows which advisor failed or was omitted, and the user can continue, retry, or return to the base workflow without losing prior work, and advisor failure emits telemetry event `thinktank.party_mode.advisor_failed`.
3. Given automated tests run for Party Mode, when fake advisors and fake GLM responses are used, then timeout, partial response, cost limit, and successful integration paths are deterministic, and single-advisor workflow tests remain unaffected by Party Mode failures.

## Tasks / Subtasks

- [x] ATDD coverage first (AC: 1, 2, 3)
  - [x] Add backend RED tests for Party Mode budget accounting, remaining budget metadata, budget-exceeded stop behavior, and `thinktank.party_mode.budget_exceeded` telemetry.
  - [x] Add backend RED tests for advisor timeout/partial failure that preserve prior advisor messages, emit `thinktank.party_mode.advisor_failed`, and expose continue/retry/return controls.
  - [x] Add frontend RED tests for advisor failed/omitted rendering, remaining budget visibility, retry/continue/return controls, and streaming parser metadata.
  - [x] Add regression tests proving normal single-advisor submit/stream behavior remains unchanged.
- [x] Backend Party Mode budget controls (AC: 1, 3)
  - [x] Add deterministic Party Mode budget policy from environment/config with safe defaults: max tokens and max estimated cost per Party Mode session.
  - [x] Track Party Mode consumed/remaining tokens and cost in session/checkpoint metadata using scalar fields only.
  - [x] Enforce budget before each advisor/integration provider call and after provider usage/cost is known.
  - [x] When budget is exceeded, stop additional advisor calls, preserve completed prior work, expose user-safe decision options, and emit `thinktank.party_mode.budget_exceeded`.
- [x] Backend failure controls (AC: 2, 3)
  - [x] Catch provider timeout/failure for individual Party Mode advisors without rolling back already completed advisor messages.
  - [x] Persist a bounded assistant failure/omission message with advisor id/name/role, round, failure category, retryable flag, and remaining budget metadata.
  - [x] Emit `thinktank.party_mode.advisor_failed` with tenant/session/advisor/round/error category and without raw prompt, message, report, or persona content.
  - [x] Support continue, retry, and existing `return-to-workflow` controls through server-owned decision validation; do not trust browser-provided Party Mode state.
- [x] Frontend resource/failure UX (AC: 1, 2)
  - [x] Extend existing single-column Party Mode rendering; do not add a dashboard or standalone Party Mode page in this story.
  - [x] Render remaining Party Mode budget state and advisor failure/omission state from message metadata/accessibility labels.
  - [x] Wire retry/continue/return controls through existing `AdvisoryChatMessage` decision controls and `AdvisoryWorkspaceShell` streaming submit path.
  - [x] Keep text selection, scroll behavior, current-speaker status, and follow-up/integration controls from Stories 5.3/5.4 intact.
- [x] Regression boundaries (AC: 1, 2, 3)
  - [x] Preserve Story 5.1 feature flag, latest decision validation, rollback cleanup, and `return-to-workflow`.
  - [x] Preserve Story 5.2 advisor selection and sanitized source metadata boundaries.
  - [x] Preserve Story 5.3 serial advisor order/current-speaker/addressed expert behavior where no advisor fails.
  - [x] Preserve Story 5.4 differentiated frameworks, integration conclusion, accept append, and report return behavior.
  - [x] Do not implement Epic 6 operations dashboards or telemetry aggregation; Story 5.5 only emits source events and user-facing recovery controls.
- [x] Verification (AC: 1, 2, 3)
  - [x] Run focused backend Party Mode/session/provider/event tests and `cd backend && npx tsc --noEmit`.
  - [x] Run focused frontend ChatMessage/WorkspaceShell/streaming tests and `cd frontend && npx tsc --noEmit`.
  - [x] Update code review, traceability, gate, story status, and sprint status artifacts after implementation.

## Dev Notes

### Source Requirements

- FR27 requires the system to control Party Mode per-session resource consumption through token budget limits. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - Party Mode]
- NFR18 requires GLM/API calls to handle retries/timeouts/fallback concerns. Existing provider gateway already owns generic retry/timeout; Story 5.5 must add Party Mode-level recovery semantics around advisor calls. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR18]
- Story 1.4 event registry already includes `thinktank.party_mode.budget_exceeded` and `thinktank.party_mode.advisor_failed`; Epic 6 consumes these later. Story 5.5 must emit them with operational metadata and no raw advisory content. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.4 / Epic 6 notes]
- UX requirements keep Party Mode embedded inside the workflow conversation and require users to continue, retry, or return without losing work. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 5.5]

### Existing Code To Reuse

- Backend Party Mode orchestration remains in `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
- Reuse current seams:
  - `collectPartyModeAdvisorResponse()`
  - `createPartyModeSerialTurn()`
  - `streamPartyModeSerialTurn()`
  - `createPartyModeIntegratedConclusion()`
  - `createPartyModeAdvisorMetadata()`
  - `createPartyModeDiscussionDecisionOptions()`
  - `returnToWorkflowFromPartyMode()`
  - `withPartyModeTurnLock()`
- Reuse provider gateway usage/cost/error contracts from `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts`. Provider stream chunks can carry `usage`, `estimatedCost`, `latencyMs`, `finishReason`, and provider errors can carry `category`, `status`, and `retryable`.
- Reuse telemetry emission through `backend/src/modules/advisory/events/advisory-event.service.ts` and enum names from `backend/src/modules/advisory/events/thinktank-event-contract.ts`.
- Reuse frontend single-column rendering and decision controls in `frontend/components/advisory/AdvisoryChatMessage.tsx`, `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`, and `frontend/lib/advisory/streaming.ts`.

### Suggested 5.5 Contract

- Environment/config names may be implementation-local, but tests must not depend on process-global leakage. Recommended names:
  - `THINKTANK_PARTY_MODE_MAX_TOKENS`
  - `THINKTANK_PARTY_MODE_MAX_COST`
- Persist scalar metadata such as:
  - `party_mode_budget_max_tokens`
  - `party_mode_budget_remaining_tokens`
  - `party_mode_budget_consumed_tokens`
  - `party_mode_budget_max_cost`
  - `party_mode_budget_remaining_cost`
  - `party_mode_budget_consumed_cost`
  - `party_mode_budget_exceeded`
  - `party_mode_failed_advisor_id`
  - `party_mode_failed_advisor_name`
  - `party_mode_failed_advisor_role`
  - `party_mode_failure_category`
  - `party_mode_failure_retryable`
  - `party_mode_omitted_advisor_ids`
- Budget is Party Mode scoped, not global billing. It is acceptable for MVP to account provider-reported usage/cost plus a deterministic estimate before a call when provider usage is unavailable.
- If one advisor fails after prior advisors completed, preserve completed advisor messages, create a bounded failure assistant message, and expose recovery controls. Do not roll back the whole Party Mode round unless no advisor message or failure message can be persisted.
- Recovery decision actions should stay server-owned. Use existing `return-to-workflow`; add narrow `retry-party-mode-advisor` and `continue-party-mode` only if they are validated against latest assistant decision options.
- Telemetry must use `privacyClassification: operational` and metadata must not include raw prompt/message/report/persona content. The event contract rejects raw sensitive keys such as `message`, `messages`, `prompt`, `content`, `report`, and `document`.

### Previous Story Intelligence

- Story 5.1 latest-option validation and failed-message cleanup prevent stale controls from blocking retry. New recovery actions must follow the same latest-option pattern.
- Story 5.2 selected advisors are stored as sanitized scalar metadata. Failure UI and telemetry should use advisor id/name/role from that metadata, not raw persona files.
- Story 5.3 streaming treats partial Party Mode streams as malformed until the final expert completes. Story 5.5 must update backend/frontend contracts so intentional partial continuation has an explicit terminal event/message, not a silent truncated stream.
- Story 5.4 integration/accept actions validate clicked source message ids. Retry/continue controls should also bind to the latest failure assistant message when possible.
- Story 5.4 disabled prompt cache for Party Mode advisor calls. Keep prompt cache disabled for Party Mode unless a separate safe cache policy is implemented outside this story.

### Scope Boundaries

| Capability | Owner |
| --- | --- |
| Start Party Mode from workflow decision controls | Story 5.1 |
| Load/select personas and explain selected/omitted advisors | Story 5.2 |
| Serial advisor messages, current speaker state, expert identity UI, reply-to-expert | Story 5.3 |
| Differentiated framework/lens assignment and integrated conclusion/report append | Story 5.4 |
| Party Mode budget, advisor timeout/failure recovery, telemetry source events | Story 5.5 |
| Operations dashboards and telemetry aggregation | Epic 6 |

### Testing Requirements

- Follow TDD: create the ATDD artifact and failing tests before production changes.
- Backend focused commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/events/advisory-event.service.spec.ts --runInBand`
  - `cd backend && npx tsc --noEmit`
- Frontend focused commands:
  - `cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand`
  - `cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand`
  - `cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts --runInBand`
  - `cd frontend && npx tsc --noEmit`
- No tests may depend on live GLM/network/provider calls. Use fake provider stream chunks/errors and deterministic fixtures.
- Tests should use role, label, visible text, and accessible names. Do not add production `data-testid`.

### Project Structure Notes

- Keep implementation close to existing Party Mode seams. If extraction is needed, use focused helpers under `backend/src/modules/advisory/sessions/` and register only if Nest injection is required.
- Do not add Epic 6 dashboards or new telemetry aggregation tables.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; this folder is ignored by default and needs `git add -f` during checkpoint commit.

### Latest Technical Information

- No external dependency or version research is required. Use checked-in NestJS, TypeScript, TypeORM, Next.js, existing provider gateway, existing event service, and existing advisory session APIs.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 5 and Story 5.5 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR27 and NFR18.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - advisory module/session/provider/event boundaries.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Party Mode embedded workflow and operations telemetry context.
- `_bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md` - server-owned decision validation and rollback.
- `_bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md` - sanitized advisor metadata.
- `_bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md` - serial discussion and current-speaker stream contracts.
- `_bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md` - framework/integration/accept controls and source-message validation.
- `backend/src/modules/advisory/sessions/advisory-session.service.ts` - Party Mode orchestration.
- `backend/src/modules/advisory/events/advisory-event.service.ts` - telemetry emission.
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts` - provider retry/timeout/usage behavior.
- `frontend/components/advisory/AdvisoryChatMessage.tsx` - message rendering and decision controls.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - streaming submit and recovery UX.
- `frontend/lib/advisory/streaming.ts` - SSE parser and Party Mode terminal semantics.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: Story context created from Epic 5 Story 5.5, FR27/NFR18, Story 1.4 event registry, and Story 5.1-5.4 Party Mode handoffs.
- 2026-05-22: ATDD generated for backend Party Mode resource/failure controls, frontend failure/budget rendering, workspace recovery submissions, and streaming parser failure semantics.
- 2026-05-22: Implemented Party Mode budget accounting, budget-exceeded recovery, advisor failure recovery, retry/continue actions, and source telemetry emission.
- 2026-05-22: Ran adversarial code review and fixed blocking/high-risk findings around recovery subqueues, non-retryable retry rejection, omitted advisor metadata, final-advisor budget telemetry, integration budget guard, partial usage accounting, and frontend terminal stream semantics.
- 2026-05-22: Traceability and gate artifacts generated with PASS decision for AC1-AC3.

### Completion Notes List

- Party Mode now tracks configured max/consumed/remaining token and cost budget in scalar metadata and enforces guards before advisor/integration provider calls and after usage is known.
- Budget exhaustion preserves prior work, persists a bounded recovery message, disables unsafe continuation when the budget is exhausted, and emits `thinktank.party_mode.budget_exceeded` with operational metadata only.
- Advisor timeout/failure preserves completed advisor messages, persists failed/omitted advisor metadata, emits `thinktank.party_mode.advisor_failed`, and exposes validated retry/continue/return decisions.
- Retry resumes the failed plus omitted advisor segment, continue resumes only omitted advisors, and non-retryable failures reject retry server-side.
- Frontend rendering and streaming now treat `party_mode.advisor_failed` as an intermediate event and require a persisted terminal assistant message for recoverable failure completion.
- Epic 6 dashboards/aggregation were not implemented; Story 5.5 emits only source events and user-facing recovery controls.

### File List

- `_bmad-output/implementation-artifacts/5-5-party-mode-resource-and-failure-controls.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-5-5-party-mode-resource-and-failure-controls.md`
- `_bmad-output/test-artifacts/traceability-story-5-5-party-mode-resource-and-failure-controls-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-5-5-party-mode-resource-and-failure-controls.md`
- `_bmad-output/test-artifacts/gate-decision-story-5-5-party-mode-resource-and-failure-controls.yaml`
- `backend/src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts`
- `frontend/components/advisory/AdvisoryChatMessage.tsx`
- `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx`
- `frontend/lib/advisory/streaming.ts`
- `frontend/lib/advisory/streaming.party-mode.atdd.test.ts`

## Change Log

- 2026-05-22: Created Story 5.5 implementation context and marked ready-for-dev.
- 2026-05-22: Completed Party Mode budget/failure controls, deterministic ATDD/regression coverage, code-review fixes, traceability matrix, and PASS quality gate.
