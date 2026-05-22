---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-22T12:50:00+08:00'
storyId: 5-4-differentiated-frameworks-and-integrated-conclusion
inputDocuments:
  - _bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md
  - _bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md
  - _bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md
  - _bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md
  - _bmad/tea/config.yaml
---

# ATDD Checklist: Story 5.4 Differentiated Frameworks and Integrated Conclusion

## Step 1: Preflight and Context

- Detected stack: fullstack.
- Primary test levels: backend service/integration, frontend component, frontend workspace stream handling.
- Browser selector recording: N/A. Story 5.4 extends existing advisory workspace components and SSE/message contracts; selectors use roles, labels, and visible text.
- Pact/CDC: N/A. No new external provider endpoint; existing `sessions/:sessionId/messages` and `messages/stream` contracts are extended with server-owned decision actions.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: acceptance criteria are explicit and existing backend/frontend test patterns cover the affected services and components.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED Test |
| --- | --- | --- | --- | --- |
| AC1 | Assign differentiated frameworks/lenses to advisor prompts and message/provider metadata | Backend service | P0 | `backend/src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts` |
| AC2 | Generate integrated conclusion covering consensus, disagreements, risks, and next steps | Backend service | P0 | backend ATDD spec |
| AC2 | Keep Party Mode active after integration so the user can ask follow-up before acceptance | Backend decision contract | P0 | backend ATDD spec |
| AC3 | Accept integrated conclusion, append it to active report draft, and return to workflow | Backend service/output integration | P0 | backend ATDD spec |
| AC1, AC2 | Render analysis framework and visible `[AI Generated]` integration label | Frontend component | P0 | `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx` |
| AC3 | Accept integration decision through existing workspace controls and refresh live document draft | Frontend workspace | P0 | `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx` |
| Regression | Reject stale integration/accept decisions before persistence, provider calls, or report append | Backend service | P0 | backend ATDD spec |

## Step 4: RED Tests Generated

- Backend RED tests:
  - `backend/src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts`
  - 4 tests for framework differentiation, integrated conclusion generation, accept+append+return, and stale-action rejection.
- Frontend RED tests:
  - `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
  - `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx`
  - 2 tests for framework/AI label rendering and accept action output refresh.

RED tests are active for the dev green phase and assert expected behavior rather than placeholders. They do not require live GLM/network/provider calls.

## Step 5: Validation

- Acceptance criteria are mapped to focused backend/frontend tests without duplicate broad E2E coverage.
- Tests avoid production `data-testid`; selectors use roles, labels, visible text, and `within`.
- No browser CLI sessions were opened.
- Temporary artifacts are stored under `_bmad-output/test-artifacts/`.
- Story 5.5 budget/timeouts/retries/telemetry are explicitly out of scope.

## Green Phase Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.outputs.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand
cd frontend && npx tsc --noEmit
```

## Implementation Guidance

- Extend existing Party Mode session orchestration; do not add a standalone Party Mode page.
- Add deterministic framework assignment per selected advisor and include it in provider prompt, provider metadata, and message metadata.
- Add server-owned actions `integrate-party-mode` and `accept-party-mode-conclusion` to the existing decision action validation path.
- Generate integration as an assistant message with `party_mode_integration: true`, visible AI label metadata, source round/message pointers, and accept/return decision options.
- On accept, append the integration assistant message to the active report draft using `sourceMessageId`, then reuse Party Mode return finalization so normal workflow controls resume.
