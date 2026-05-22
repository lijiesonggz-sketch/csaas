---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-22T13:05:29+08:00'
storyId: 5-4-differentiated-frameworks-and-integrated-conclusion
gateDecision: PASS
---

# Traceability Report: Story 5.4 Differentiated Frameworks and Integrated Conclusion

## Gate Decision: PASS

**Rationale:** P0 coverage is 100%, no P1 requirements were identified, and overall coverage is 100% against the 80% minimum. Story 5.4 has backend service/streaming coverage, frontend component/workspace coverage, output append regression coverage, stale decision rejection, append idempotency, and source-boundary metadata checks.

## Context Loaded

- Story file: `_bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md`
- ATDD artifact: `_bmad-output/test-artifacts/atdd-checklist-5-4-differentiated-frameworks-and-integrated-conclusion.md`
- Code review artifact: `_bmad-output/test-artifacts/code-review-story-5-4-differentiated-frameworks-and-integrated-conclusion.md`
- Planning context: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/thinktank-prd.md`, `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md`, `_bmad-output/planning-artifacts/architecture-thinktank.md`
- TEA knowledge: `test-priorities-matrix.md`, `risk-governance.md`, `probability-impact.md`, `test-quality.md`, `selective-testing.md`

## Tests Discovered

| Test File | Level | Relevant Coverage |
| --- | --- | --- |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts` | Backend service/stream integration | Differentiated frameworks, integration conclusion generation, latest/stale decision rejection, streaming event order, accept append/return, append idempotency |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts` | Backend service/stream regression | Story 5.3 serial advisor order, current-speaker SSE, addressed expert validation, rollback boundaries |
| `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts` | Backend service regression | Story 5.1/5.2 availability, start/return, persona selection, sanitized metadata boundaries |
| `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts` | Backend output integration | Active report draft append/source validation regressions |
| `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts` | Backend service integration | Existing message lifecycle and provider stream regressions |
| `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts` | Backend controller/API | Existing message/stream controller regressions |
| `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts` | Backend DTO/unit | New server-owned decision actions and source message id payload validation |
| `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx` | Frontend component | Advisor framework rendering, integration article label, visible `[AI Generated]`, follow-up/accept controls |
| `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx` | Frontend component/integration | Accept integration from clicked source message and refresh live document draft |
| `frontend/components/advisory/AdvisoryWorkspaceShell` | Frontend component regression | Workspace decision handling and output refresh regressions |
| `frontend/lib/advisory/streaming.party-mode.atdd.test.ts` | Frontend parser/unit | Party Mode stream parser regressions |

## Coverage Summary

- Total Requirements: 3
- Fully Covered: 3
- Partially Covered: 0
- Uncovered: 0
- Overall Coverage: 100%
- P0 Coverage: 3/3 (100%)

## Traceability Matrix

| Requirement | Priority | Coverage | Tests | Heuristics |
| --- | --- | --- | --- | --- |
| AC1: Party Mode prompts assign differentiated frameworks/lenses, and tests verify advisors are not all asked to perform the same role. | P0 | FULL | `5.4-BE-001`, `5.4-BE-005`, `5.4-FE-001` | Framework metadata is scalar-safe; prompt instructions are not persisted; deduplication avoids collapsed lenses within one turn. |
| AC2: Integration summarizes consensus, disagreements, risks, and next steps, while allowing follow-up questions before acceptance. | P0 | FULL | `5.4-BE-002`, `5.4-BE-004`, `5.4-BE-006`, `5.4-FE-001` | Integration action is latest-option/source-bound; SSE emits started/delta/completed; integration message keeps Party Mode active with follow-up and accept choices. |
| AC3: Accepting the integrated conclusion appends it to the active report draft and resumes normal workflow. | P0 | FULL | `5.4-BE-003`, `5.4-BE-004`, `5.4-BE-007`, `5.4-FE-002`, output/message/controller/workspace/streaming regressions | Accept validates source message, appends idempotently by `sourceMessageId`, preserves AI label/provider metadata, and reuses return-to-workflow finalization. |

## Coverage Heuristics

- Endpoints without tests: 0. Story 5.4 extends existing `sessions/:sessionId/messages` and `messages/stream`; backend service/controller and frontend stream/workspace tests cover the contract.
- Auth/authz negative-path gaps: 0. Module availability, tenant/session ownership, latest-option validation, stale/forged action rejection, and source-message binding are covered.
- Happy-path-only criteria: 0. Each AC includes negative or edge coverage: duplicate framework assignment, stale actions, streaming order, retry idempotency, refresh failure messaging, and regression boundaries.

## Verification

Passed commands:

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.outputs.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell --runInBand
cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts --runInBand
cd frontend && npx tsc --noEmit
```

## Gaps & Recommendations

No blocking coverage gaps remain.

Recommendation: keep the Story 5.4 integration ATDD, DTO, output append, ChatMessage, WorkspaceShell, and Party Mode stream parser suites in the Epic 5 regression set because they guard framework differentiation, integration/accept decision integrity, and report append behavior.

## Gate Summary

GATE DECISION: PASS

- P0 Coverage: 100% (required: 100%) -> MET
- P1 Coverage: 100% effective (no P1 requirements detected) -> MET
- Overall Coverage: 100% (minimum: 80%) -> MET
- Critical Gaps: 0

Story 5.4 is approved to move from review to done.
