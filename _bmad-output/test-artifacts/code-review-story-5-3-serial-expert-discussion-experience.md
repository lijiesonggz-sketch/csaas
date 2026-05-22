---
storyId: 5-3-serial-expert-discussion-experience
reviewedAt: '2026-05-22T12:40:00+08:00'
result: PASS
---

# Code Review: Story 5.3 Serial Expert Discussion Experience

## Review Layers

- Blind Hunter: completed.
- Edge Case Hunter: completed.
- Acceptance Auditor: completed.

## Triage Summary

- intent_gap: 0
- bad_spec: 0
- patch: 7, all resolved
- defer: 0
- rejected as noise: 0

## Findings Resolved

| Finding | Category | Resolution |
| --- | --- | --- |
| Party Mode SSE treated any advisor `message.completed` as the whole stream terminal event. | PATCH | Backend now marks only the final advisor completion with `partyModeTurnComplete: true`; frontend streaming parser treats intermediate Party Mode completions as non-terminal and raises malformed stream errors on partial streams. |
| Concurrent Party Mode submits could compute the same round from stale history. | PATCH | Added per-session Party Mode turn locking and re-read conversation history inside the lock before calculating round/order. |
| Streaming aborts could leave a persisted user turn or partial advisor messages. | PATCH | Streaming Party Mode now deletes the current user/advisor messages on abort after persistence and before returning. |
| Party Mode advisor deltas were buffered until each advisor finished. | PATCH | Streaming path now yields `message.delta` as provider chunks arrive for the active advisor. |
| Later advisor failure could leave already-rendered advisor messages in the UI after backend rollback. | PATCH | WorkspaceShell tracks all local, pending, and completed message ids for the active stream and removes the whole turn on `message.error`, malformed stream, or thrown stream error. |
| Invalid addressed expert hints in the streaming path became generic retryable stream errors after SSE start. | PATCH | Party Mode streaming validation now occurs before the first yielded SSE event, so forged/stale references use normal HTTP exception handling. |
| Prompt-cache source refs/source hashes were not proven clean for Party Mode provider calls. | PATCH | Party Mode advisor provider requests disable prompt cache and regression tests assert source paths/hashes are not present in provider or message metadata. |

## Verification

Passed:

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell --runInBand
cd frontend && npm run test -- lib/advisory/streaming --runInBand
cd frontend && npm run test -- --runTestsByPath "app/api/advisory/sessions/[sessionId]/messages/route.test.ts" --runInBand
cd frontend && npm run test -- --runTestsByPath "app/api/advisory/sessions/[sessionId]/messages/stream/route.test.ts" --runInBand
cd frontend && npx tsc --noEmit
git diff --check
```

## Result

No blocking findings remain. Story 5.3 can proceed to trace/gate and done marking.
