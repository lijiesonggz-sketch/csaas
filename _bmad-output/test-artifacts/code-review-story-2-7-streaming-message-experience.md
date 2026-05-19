---
workflowType: code-review
storyId: '2.7'
storyKey: '2-7-streaming-message-experience'
reviewMode: full
reviewDate: '2026-05-20T07:24:00+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: 'Blind Hunter, Edge Case Hunter, and Acceptance Auditor review layers were run for the Story 2.7 diff and spec. Findings were triaged as patch items and fixed before this artifact was finalized.'
---

# Code Review - Story 2.7

## Scope

- Backend advisory session SSE endpoint, stream orchestration, provider gateway abort handling, sequence persistence, migration, and focused tests.
- Frontend streaming proxy route, SSE parser/client, advisory workspace streaming UI, message renderer, Markdown/code handling, scroll anchoring, lazy rendering, and tests.
- Story, sprint status, and ATDD artifacts for Story 2.7.

## Findings Raised And Resolved

### Patch Findings

1. **Abort/cancel was not propagated end-to-end**
   - Source: Blind Hunter + Edge Case Hunter.
   - Location: `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.ts`, `backend/src/modules/advisory/sessions/advisory-session.controller.ts`, `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`.
   - Risk: closed browser streams could leave backend/provider work running and persist stale assistant messages.
   - Resolution: Next proxy forwards `request.signal`; Nest response close aborts the service stream; provider gateway bridges external abort signals and normalizes abort errors. Tests cover client close and provider signal propagation.

2. **Pre-stream validation errors could be returned as SSE 200**
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.controller.ts`.
   - Risk: validation/session errors before the first event would look like a successful SSE stream.
   - Resolution: controller pulls the first async iterator event before writing status and headers, so pre-yield exceptions use normal Nest error handling.

3. **SSE writes ignored backpressure**
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.controller.ts`.
   - Risk: large or slow streams could buffer without respecting Express backpressure.
   - Resolution: `writeSseEvent()` awaits `drain` when `response.write()` returns `false` and exits on abort/close.

4. **Empty provider stream could persist a successful empty assistant message**
   - Source: Acceptance Auditor.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
   - Risk: users would see a successful completion with no advisor content, violating recoverable failure expectations.
   - Resolution: empty assistant content emits `message.error` and only the user message is persisted.

5. **Concurrent submits could race message sequence assignment**
   - Source: Blind Hunter + Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`, `backend/src/database/entities/advisory-conversation-message.entity.ts`, `backend/src/database/migrations/1772000000032-MakeConversationMessageSequenceUnique.ts`.
   - Risk: two concurrent messages could receive duplicate tenant/session sequence values.
   - Resolution: repository now creates messages through a transaction with `pg_advisory_xact_lock(hashtext(...))`; sequence index is unique and covered by migration.

6. **Frontend EOF without terminal event could leave partial UI state**
   - Source: Acceptance Auditor.
   - Location: `frontend/lib/advisory/streaming.ts`, `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`, `frontend/app/advisory/__tests__/page.test.tsx`.
   - Risk: malformed streams could leave a half-rendered assistant reply and no retryable error.
   - Resolution: streaming client rejects streams that end without `message.completed` or `message.error`; UI restores the draft, removes partial local messages, and maps malformed stream errors to the localized submit failure message.

7. **Markdown sanitization broke JSX/XML/generic code fences**
   - Source: Blind Hunter.
   - Location: `frontend/components/advisory/AdvisoryChatMessage.tsx`.
   - Risk: AI code samples such as `<div>` or `Promise<string>` could be stripped or corrupted.
   - Resolution: fenced code blocks bypass normal HTML stripping while normal Markdown still strips script/style and unsafe raw HTML.

8. **Live-region streaming updates could be too frequent**
   - Source: Acceptance Auditor.
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Risk: screen readers could be overwhelmed by token-level announcements.
   - Resolution: streaming announcements are throttled and immediate only for major state changes.

9. **Scroll/lazy rendering could move the user's reading position**
   - Source: Edge Case Hunter + Acceptance Auditor.
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Risk: streamed deltas could force-scroll users away from historical text or shift the lazy-render boundary.
   - Resolution: UI tracks near-bottom state, auto-scrolls only when appropriate, exposes "查看新回复", and expands older messages when the user is away from bottom.

10. **Stale stream finalizers and double submit risks**
    - Source: Blind Hunter.
    - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
    - Risk: late stream finalizers could clear active state from a newer stream, and duplicate submit paths could start concurrent streams.
    - Resolution: submit is guarded by `messageSubmitInFlightRef`; finalizers clear streaming state only for the current `AbortController`.

## Acceptance Auditor

No remaining acceptance blockers were found after fixes:

- AC1: SSE events render incrementally, expose streaming state, handle malformed EOF, and throttle polite live-region updates.
- AC2: scroll anchoring preserves the user's reading position unless the viewport is already near the bottom.
- AC3: Markdown/code rendering keeps role labels visible and preserves code fences safely.
- AC4: long conversations lazy-render older messages behind an accessible boundary while preserving latest streaming behavior.

## Verification After Fixes

- `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand` - 53 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand` - 63 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd frontend && npx tsc --noEmit` - passed.
- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx lib/advisory/streaming.test.ts --runInBand` - 33 tests passed after the malformed EOF and timer type fixes.

## Conclusion

Code review initially found ten patch-level issues. All were fixed and reverified. Current conclusion: **Pass / no remaining blocking findings**.
