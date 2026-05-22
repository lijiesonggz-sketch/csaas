---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-22T11:48:00+08:00'
storyId: 5-3-serial-expert-discussion-experience
inputDocuments:
  - _bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md
  - _bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md
  - _bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md
  - _bmad/tea/config.yaml
---

# ATDD Checklist: Story 5.3 Serial Expert Discussion Experience

## Step 1: Preflight and Context

- Detected stack: fullstack.
- Primary test levels: backend service/integration, frontend component, frontend streaming parser.
- Browser selector recording: N/A. Story 5.3 extends existing advisory workspace components and SSE contracts; selectors use roles, labels, and visible text.
- Pact/CDC: N/A. No new external provider endpoint; existing `sessions/:sessionId/messages` and `messages/stream` contracts are extended.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: acceptance criteria are explicit and existing backend/frontend test patterns cover the affected services and components.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED Test |
| --- | --- | --- | --- | --- |
| AC1 | Persist serial advisor messages with expert id/name/role/perspective/round/order/shared-context metadata | Backend service | P0 | `backend/src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts` |
| AC2 | Emit current-speaker metadata before each advisor response | Backend stream + frontend parser | P0 | backend ATDD spec, `frontend/lib/advisory/streaming.party-mode.atdd.test.ts` |
| AC1, AC2 | Render single-column Party Mode expert messages with visible identity, round, and polite current-speaker status | Frontend component | P0 | `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx` |
| AC3 | Validate addressed expert replies and make addressed expert speak first | Backend service | P0 | backend ATDD spec |
| AC3 | Reject forged, stale, or non-Party-Mode addressed expert hints before persistence/provider calls | Backend service | P0 | backend ATDD spec |
| Regression | Avoid raw persona/source content in provider and message metadata | Backend service | P1 | backend ATDD spec |

## Step 4: RED Tests Generated

- Backend RED tests:
  - `backend/src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts`
  - 5 skipped RED tests for serial turn orchestration, current-speaker streaming, addressed advisor ordering/validation, fail-closed rejection, and metadata privacy.
- Frontend RED tests:
  - `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
  - `frontend/lib/advisory/streaming.party-mode.atdd.test.ts`
  - 3 skipped RED tests for expert identity rendering, current-speaker live region, and SSE current-speaker parsing.

RED tests were first generated from the ATDD workflow and then activated during the dev green phase. They now assert expected behavior rather than placeholders.

## Step 5: Validation

- Acceptance criteria are mapped to backend and frontend tests without duplicate broad E2E coverage.
- Tests do not require live GLM/network/provider calls.
- Tests avoid production `data-testid`; selectors use roles, labels, visible text, and `within`.
- CLI/browser sessions: none opened.
- Temporary artifacts: stored under `_bmad-output/test-artifacts/`.

## Green Phase Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx
cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts
cd frontend && npx tsc --noEmit
```

## Implementation Guidance

- Add a server-owned Party Mode serial discussion path when session metadata has `party_mode_active: true` and `party_mode_status: "context-created"`.
- Parse Story 5.2 pipe-delimited selected advisor metadata into ordered advisor records.
- Persist one advisor response per selected advisor per round, including scalar metadata for identity, round, order, addressed expert, and shared context pointer.
- Extend the existing SSE parser with a narrow `party_mode.current_speaker` event instead of creating a second streaming client.
- Extend `AdvisoryChatMessage` and `AdvisoryWorkspaceShell` in place; do not add a standalone Party Mode page.
