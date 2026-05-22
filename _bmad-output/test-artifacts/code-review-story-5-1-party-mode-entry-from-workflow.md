---
reviewDate: '2026-05-22T10:25:28+08:00'
storyId: '5.1'
storyKey: 5-1-party-mode-entry-from-workflow
reviewMode: multi-pass-adversarial-review
status: PASS
---

# Code Review - Story 5.1

## Review Scope

Story 5.1 implements Party Mode as an in-workflow decision action, not as a standalone page. Review focused on backend action validation, tenant-owned availability, Party Mode start/return state transitions, checkpoint metadata, streaming behavior, and frontend decision-control behavior.

## Review Passes

| Pass | Focus | Result |
| --- | --- | --- |
| Pass 1 | Server-owned option validation, forged/disabled action rejection, stale frontend controls, stream branch | Findings fixed |
| Pass 2 | Atomic start/return state, JSONB metadata merge, checkpoint metadata, return-to-workflow path | Findings fixed |
| Final subagent pass | Failure rollback retryability across persisted conversation messages | HIGH fixed |
| Local final pass | DTO/API validation, client action path, trace/test evidence | PASS |

## Blocking Findings Fixed

| Severity | Finding | Resolution |
| --- | --- | --- |
| HIGH | `decisionAction: "party-mode"` could be forged or submitted from a disabled/stale option. | Backend now requires the latest assistant decision message to expose an enabled Party Mode option before starting. Disabled/forged/stale actions are rejected before message history is written. |
| HIGH | Party Mode start claim could leave session metadata stuck when later persistence failed. | Added claim/finalize/rollback repository transitions. Failed starts roll back to `party_mode_active: false` and `party_mode_status: "start-failed"` so the user can retry. |
| HIGH | `return-to-workflow` was exposed by backend output but not wired through frontend/server action path. | Added server-owned return action handling and frontend submission through the existing stream client. Return does not call the provider and restores normal workflow controls. |
| HIGH | Start/return failure after assistant message creation could leave orphaned decision messages and block retry. | Start/return wrappers now delete the Party Mode user/assistant messages created by the failed attempt before rolling back metadata. Added P0 tests for start-finalize and return-finalize failure cleanup. |
| MEDIUM | Final Party Mode metadata writes could overwrite concurrent metadata changes. | Repository finalization and rollback use JSONB merge instead of whole-object update. |
| MEDIUM | API DTO accepted `party-mode` but not `return-to-workflow`. | Added `return-to-workflow` to `THINKTANK_DECISION_ACTIONS` and DTO tests for allowed return plus rejected unknown action. |
| MEDIUM | Frontend decision submits cleared/restored the free-text draft like normal submits. | Decision submits now preserve drafts and only send command content through the override path. |
| MEDIUM | Historical decision buttons stayed clickable after newer decision controls arrived. | `AdvisoryChatMessage` receives `decisionOptionsAreCurrent`; stale controls render disabled and handler rejects non-latest options. |

## Verification Evidence

| Command | Result |
| --- | --- |
| `cd backend && npm test -- advisory-session.party-mode-entry.atdd.spec.ts advisory-session.repository.spec.ts advisory-session.messages.spec.ts advisory-session.checkpoint.spec.ts submit-advisory-message.dto.spec.ts --runInBand` | PASS, 5 suites / 42 tests |
| `cd backend && npx tsc --noEmit` | PASS |
| `cd frontend && npm test -- app/advisory/__tests__/page.test.tsx --runInBand` | PASS, 1 suite / 50 tests |
| `cd frontend && npx tsc --noEmit` | PASS |
| `cd frontend && npm run test:e2e -- advisory-theme-density-baseline.spec.ts --project=chromium` | First run: 5/6 PASS, 1 cold-start `waitForResponse` timeout; immediate warmed rerun: PASS, 6/6 |
| `cd backend && npm test -- --runInBand` | PASS, 322 suites passed / 19 skipped; 2830 tests passed / 112 skipped / 5 todo |

## Review Result

PASS. No HIGH or MEDIUM findings remain. Residual risk is intentionally deferred to later Epic 5 stories: persona loading, serial expert turns, differentiated frameworks, integrated conclusion write-back, and resource/failure budget controls are out of Story 5.1 scope.
