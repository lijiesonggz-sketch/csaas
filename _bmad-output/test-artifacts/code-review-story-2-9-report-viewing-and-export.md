---
workflowType: code-review
storyId: '2.9'
storyKey: '2-9-report-viewing-and-export'
reviewMode: full
specFile: 'D:\Csaas\_bmad-output\implementation-artifacts\2-9-report-viewing-and-export.md'
reviewDate: '2026-05-20T11:33:45+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: '按 bmad-code-review 三层并行审查当前未提交 Story 2.9 diff；HIGH/MEDIUM patch findings 已在本轮自动修复并回归验证。'
---

# Code Review - Story 2.9 Report Viewing and Export

## Scope

Review scope covered the current Story 2.9 implementation diff:

- Backend export service, PDF renderer, controller route, advisory module wiring, and export tests.
- Next export proxy route and route tests.
- Frontend output download helper, drawer export controls, workspace export state/toast/error flow, and UI tests.
- Story 2.9 BMAD artifacts and sprint status changes.

## Findings Triage

### Patch Findings Resolved

1. Same-tenant cross-user export authorization gap.
   - Sources: Blind Hunter, Edge Case Hunter.
   - Location: `backend/src/modules/advisory/outputs/advisory-output-export.service.ts`.
   - Fix: export now validates both `session.actorId` and `output.actorId` against the current user and returns not found on mismatch. Added same-tenant actor rejection tests.

2. PDF renderer resource exhaustion risk.
   - Sources: Blind Hunter, Edge Case Hunter.
   - Location: `backend/src/modules/advisory/outputs/advisory-output-pdf-renderer.service.ts`.
   - Fix: added per-render timeout, render concurrency limit, queue limit, HTML size limit, and deterministic browser close cleanup.

3. Export memory pressure through Next proxy buffering.
   - Source: Blind Hunter.
   - Location: `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.ts`.
   - Fix: proxy now forwards `response.body` when available and falls back to `arrayBuffer()` only for tests/unsupported responses.

4. Markdown heading injection risk from report title/section heading.
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/outputs/advisory-output-export.service.ts`.
   - Fix: Markdown export normalizes title/section heading newlines and escapes heading control characters. Added regression test.

5. Stale async export result could update a newer workspace session.
   - Source: Edge Case Hunter.
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Fix: export handler now captures session id and request id, invalidates pending exports on session reset, and only writes toast/error/busy state for the current request/session.

6. Generic proxy failure lacked recoverable guidance.
   - Source: Edge Case Hunter.
   - Location: `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.ts`.
   - Fix: proxy catch now returns the Story 2.9 recoverable guidance message. Added route regression test.

7. Malformed `filename*` could break successful downloads.
   - Source: Edge Case Hunter.
   - Location: `frontend/lib/advisory/outputs.ts`.
   - Fix: `filename*` decode is now guarded and falls back to `filename=` or deterministic filename. Added regression test.

8. Blob URL was revoked immediately after click.
   - Source: Blind Hunter.
   - Location: `frontend/lib/advisory/outputs.ts`.
   - Fix: revocation is delayed to the next tick.

### Acceptance Auditor Note

- BMAD artifacts under `_bmad-output/` are gitignored and must be force-added before commit. This is not a code defect; it is a commit hygiene requirement.

## Validation After Fixes

- `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs src/modules/advisory/events --runInBand`: 92 passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`: 108 passed.
- `cd backend && npx tsc --noEmit`: passed.
- `cd frontend && npx tsc --noEmit`: passed.
- `git diff --check`: passed.

## Final Triage Summary

- `intent_gap`: 0
- `bad_spec`: 0
- `patch`: 8 found, 8 fixed
- `defer`: 0
- `reject/noise`: 0

## Conclusion

结论：**Pass after fixes**

Story 2.9 的 code-review 阻塞项已经修复，并通过 focused regression 与 TypeScript 检查。可进入 traceability gate。
