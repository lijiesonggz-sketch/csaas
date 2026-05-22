---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04a-subagent-api-failing
  - step-04b-subagent-e2e-failing
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-22T14:20:50+08:00'
storyId: 5-5-party-mode-resource-and-failure-controls
inputDocuments:
  - _bmad-output/implementation-artifacts/5-5-party-mode-resource-and-failure-controls.md
  - _bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md
  - _bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md
  - _bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md
  - _bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md
  - _bmad/tea/testarch/tea-index.csv
---

# ATDD Checklist: Story 5.5 Party Mode Resource and Failure Controls

## Step 1: Preflight and Context

- Detected stack: fullstack.
- Primary test levels: backend service/integration, frontend component, frontend workspace stream handling, frontend streaming parser.
- Browser selector recording: N/A. Story 5.5 extends existing advisory workspace components and existing SSE/message contracts; selectors use roles, labels, and visible text.
- Pact/CDC: N/A. No new external provider endpoint; existing `sessions/:sessionId/messages` and `messages/stream` contracts are extended with server-owned Party Mode recovery actions and metadata.

## Step 2: Generation Mode

- Mode: AI generation with subagent workers for API/backend and frontend/E2E-style component coverage.
- Rationale: acceptance criteria are explicit and existing backend/frontend test patterns cover the affected services and components. No live browser recording is required.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED Test |
| --- | --- | --- | --- | --- |
| AC1 | Account provider usage/cost for each advisor and expose remaining Party Mode budget in advisor/checkpoint metadata | Backend service | P0 | `backend/src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts` |
| AC1 | Stop additional advisor calls when budget is exceeded and emit `thinktank.party_mode.budget_exceeded` without raw content | Backend service/telemetry | P0 | backend resource ATDD spec |
| AC2 | Preserve completed advisor messages when a later advisor times out or partially fails | Backend service | P0 | backend resource ATDD spec |
| AC2 | Emit `thinktank.party_mode.advisor_failed` with operational metadata and expose retry/continue/return decisions | Backend service/telemetry | P0 | backend resource ATDD spec |
| AC2 | Render failed/omitted advisor state, remaining budget, and recovery controls accessibly | Frontend component/workspace | P0 | `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`, `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx` |
| AC3 | Parse intentional Party Mode advisor failure terminal events and deterministic persisted failure messages | Frontend streaming parser | P0 | `frontend/lib/advisory/streaming.party-mode.atdd.test.ts` |
| AC3 | Preserve deterministic successful Party Mode and single-advisor workflow regressions | Backend/Frontend regression | P1 | backend resource ATDD plus existing Party Mode serial/integration/message tests |

## Step 4: RED Tests Generated

- Backend RED tests:
  - `backend/src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts`
  - 5 tests for budget accounting, budget exceeded telemetry, advisor timeout/partial failure recovery, deterministic successful fake-provider Party Mode, and single-advisor regression isolation.
- Frontend RED tests:
  - `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
  - `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx`
  - `frontend/lib/advisory/streaming.party-mode.atdd.test.ts`
  - 4 added tests for failure/budget rendering, source-bound retry/continue/return decisions, and intentional Party Mode failure terminal stream parsing.

RED tests are active for the dev green phase and assert expected behavior rather than placeholders. They do not require live GLM/network/provider calls.

## Step 5: Validation

- Acceptance criteria are mapped to focused backend/frontend tests without duplicate broad E2E coverage.
- Tests avoid production `data-testid`; selectors use roles, labels, visible text, and `within`.
- Two ATDD subagents were used and closed after returning their outputs.
- No browser CLI sessions were opened.
- Temporary artifacts are stored under `_bmad-output/test-artifacts/`.
- Epic 6 dashboards/aggregation are explicitly out of scope; Story 5.5 only emits source events and recovery controls.

## Green Phase Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/events/advisory-event.service.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand
cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts --runInBand
cd frontend && npx tsc --noEmit
```

## Implementation Guidance

- Add budget accounting in Party Mode orchestration, not in the provider gateway.
- Keep provider gateway retry/timeout behavior as the generic provider layer; Story 5.5 adds Party Mode-specific recovery and telemetry.
- Persist scalar budget/failure metadata only.
- Treat intentional Party Mode partial failure as a terminal recoverable state, not as a malformed truncated stream.
- Keep all recovery actions server-owned and latest-option validated.
