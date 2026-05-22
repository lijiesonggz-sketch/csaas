---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-22T15:54:46+08:00'
storyId: 5-5-party-mode-resource-and-failure-controls
gateDecision: PASS
---

# Traceability Report: Story 5.5 Party Mode Resource and Failure Controls

## Gate Decision: PASS

**Rationale:** P0 coverage is 100%, P1 coverage is 100%, and overall coverage is 100% against the 80% minimum. Story 5.5 has deterministic backend service coverage, DTO validation, telemetry privacy coverage, frontend component/workspace coverage, and streaming parser coverage for Party Mode budgets, advisor failure recovery, malformed failure streams, successful Party Mode regressions, and single-advisor isolation.

## Context Loaded

- Story file: `_bmad-output/implementation-artifacts/5-5-party-mode-resource-and-failure-controls.md`
- ATDD artifact: `_bmad-output/test-artifacts/atdd-checklist-5-5-party-mode-resource-and-failure-controls.md`
- Planning context: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/thinktank-prd.md`, `_bmad-output/planning-artifacts/architecture-thinktank.md`, `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md`
- Previous story context: Story 5.1-5.4 implementation artifacts for Party Mode entry, advisor persona metadata, serial discussion, and integrated conclusion
- TEA knowledge: `test-priorities-matrix.md`, `risk-governance.md`, `probability-impact.md`, `test-quality.md`, `selective-testing.md`

## Tests Discovered

| Test File | Level | Relevant Coverage |
| --- | --- | --- |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts` | Backend service/stream integration | Budget accounting, budget-exceeded stop behavior, budget telemetry, advisor timeout/failure, retry/continue recovery queues, non-retryable rejection, integration budget guard, successful Party Mode regression, single-advisor isolation |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts` | Backend service/stream regression | Story 5.3 serial advisor order/current-speaker behavior when Party Mode succeeds |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts` | Backend service/stream regression | Story 5.4 integrated conclusion and accept/return behavior |
| `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts` | Backend DTO/unit | `retry-party-mode-advisor` and `continue-party-mode` API validation |
| `backend/src/modules/advisory/events/advisory-event.service.spec.ts` | Backend telemetry/unit | Operational telemetry validation and raw-content rejection |
| `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx` | Frontend component | Failure/budget metadata, omitted advisors, remaining budget, and recovery controls |
| `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx` | Frontend component/integration | Retry, continue, and return controls submitted from the latest failure message without losing prior work |
| `frontend/lib/advisory/streaming.party-mode.atdd.test.ts` | Frontend parser/unit | `party_mode.advisor_failed` as a non-terminal intermediate event, persisted failure terminal message handling, malformed failure stream rejection |

## Coverage Summary

- Total Requirements: 3
- Fully Covered: 3
- Partially Covered: 0
- Uncovered: 0
- Overall Coverage: 100%
- P0 Coverage: 2/2 (100%)
- P1 Coverage: 1/1 (100%)

## Traceability Matrix

| Requirement | Priority | Coverage | Tests | Heuristics |
| --- | --- | --- | --- | --- |
| AC1: Party Mode enforces token/cost budget, exposes remaining budget state, and emits `thinktank.party_mode.budget_exceeded`. | P0 | FULL | `5.5-BE-001`, `5.5-BE-002`, `5.5-BE-008`, `5.5-BE-009`, `5.5-FE-001`, `5.5-FE-004`, event service telemetry tests | Existing submit/stream paths are covered; no new endpoint was added. Budget before-call and after-usage guards, final-advisor exhaustion, integration budget guard, and raw-content-safe telemetry are covered. |
| AC2: Advisor timeout/partial failure preserves prior work, shows failed/omitted advisors, offers retry/continue/return controls, and emits `thinktank.party_mode.advisor_failed`. | P0 | FULL | `5.5-BE-003`, `5.5-BE-006`, `5.5-BE-007`, DTO `5.5-BE-006`, `5.5-FE-001`, `5.5-FE-002`, `5.5-FE-003`, `5.5-FE-004`, `5.5-FE-006`, event service telemetry tests | Recovery actions use server-owned latest message validation. Timeout, retryable failure, non-retryable failure, omitted advisor queues, malformed stream rejection, and failure metadata rendering are covered. |
| AC3: Fake advisors/GLM responses keep timeout, partial response, cost limit, successful integration, and single-advisor paths deterministic. | P1 | FULL | `5.5-BE-001`, `5.5-BE-003`, `5.5-BE-004`, `5.5-BE-005`, `5.5-BE-006`, `5.5-BE-007`, `5.5-BE-009`, Story 5.3/5.4 regressions, DTO tests, frontend workspace/parser regressions, backend/frontend `tsc` | No live GLM/network/provider call is required. Single-advisor workflow remains isolated from Party Mode budget/failure state. Full browser E2E is a non-blocking residual risk because deterministic service/component/parser tests cover the story contract. |

## Coverage Heuristics

- Endpoints without tests: 0. Story 5.5 extends the existing session message submit and streaming contracts; DTO, backend service, workspace, and parser tests cover the new decision actions and stream semantics.
- Auth/authz negative-path gaps: 0. No new auth/authz surface is introduced. Latest server-owned decision validation, source message binding, non-retryable retry rejection, and existing tenant/session boundaries remain covered through Party Mode regressions.
- Happy-path-only criteria: 0. Each requirement includes negative or edge coverage: budget exhaustion before/after calls, final-advisor budget exhaustion, advisor timeout/failure, malformed `advisor_failed` stream, omitted advisor recovery, non-retryable failure retry rejection, and single-advisor isolation.

## Verification

Passed commands:

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-resource.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/events/advisory-event.service.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand
cd frontend && npx tsc --noEmit
git diff --check
```

## Gaps & Recommendations

No blocking coverage gaps remain.

Residual non-blocking risk: no full browser E2E was added for recovery controls. This is acceptable for Story 5.5 because the acceptance criteria require deterministic fake advisors/provider responses, and the implemented test set covers backend service behavior, DTO validation, frontend component rendering, workspace submit wiring, and streaming parser terminal semantics.

Recommendation: keep the Story 5.5 resource ATDD, DTO, event service, ChatMessage, WorkspaceShell, and streaming parser suites in the Epic 5 regression set.

## Gate Summary

GATE DECISION: PASS

- P0 Coverage: 100% (required: 100%) -> MET
- P1 Coverage: 100% (PASS target: 90%, minimum: 80%) -> MET
- Overall Coverage: 100% (minimum: 80%) -> MET
- Critical Gaps: 0

Story 5.5 is approved to move from review to done.
