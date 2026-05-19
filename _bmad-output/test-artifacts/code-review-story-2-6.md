---
workflowType: code-review
storyId: '2.6'
storyKey: '2-6-guided-step-conversation-and-decision-controls'
reviewMode: full
reviewDate: '2026-05-20T06:14:00+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: 'New subagent creation was unavailable because the thread limit was reached; the main agent performed equivalent blind, edge-case, and acceptance-auditor passes against the Story 2.6 diff and spec.'
---

# Code Review - Story 2.6

## Scope

- Backend `conversation_messages` entity, migration, repository, session message service/controller, provider gateway stream orchestration, privacy-safe metadata, and tests.
- Frontend session messages client, Next proxy route, advisory workspace conversation UI, keyboard controls, draft persistence, and tests.
- Story, sprint status, and ATDD artifacts for Story 2.6.

## Findings Raised And Resolved

### Patch Findings

1. **Message sequence used count instead of max sequence**
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`.
   - Risk: `count + 1` can reuse a sequence value after deletion and is weaker than the story's monotonic ordering requirement.
   - Resolution: `nextSequenceForSession()` now computes the next value from the tenant/session-scoped maximum `sequence`; repository tests cover the max-sequence behavior.

2. **Decision shortcut listener had duplicate registration risk**
   - Source: Blind Hunter.
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Risk: registering the same keyboard handler on both `document` and `body` could double-trigger future decision side effects.
   - Resolution: shortcut handling is now registered once on `document`, with the conversation focus target preserving the tested decision-key flow.

## Acceptance Auditor

No remaining acceptance blockers were found after fixes:

- AC1: user answers are submitted through the governed provider gateway stream path and advisor responses return stream chunks plus decision options.
- AC2: `conversation_messages` is tenant-scoped; repository/service tests cover cross-tenant read/update/delete rejection and raw message exclusion from telemetry metadata.
- AC3: message submission does not advance `currentStep`; follow-up/deepen/revise remain on the same step.
- AC4: Enter, Shift+Enter, Escape, Ctrl+D, and decision shortcuts are covered by frontend tests with accessible labels/titles and focus-preserving behavior.

## Verification After Fixes

- `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand` — 45 tests passed.
- `cd backend && npx tsc --noEmit` — passed.
- `cd backend && npm run orm:entities:parity` — passed.
- `cd backend && npm run orm:metadata:check` — passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand` — 50 tests passed.
- `cd frontend && npx tsc --noEmit` — passed.

## Conclusion

Code review initially found two patch-level issues. Both were fixed and reverified. Current conclusion: **Pass / no remaining blocking findings**.
