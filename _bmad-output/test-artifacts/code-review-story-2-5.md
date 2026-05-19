---
workflowType: code-review
storyId: '2.5'
storyKey: '2-5-workflow-selection-and-launch'
reviewMode: full
reviewDate: '2026-05-20T05:28:00+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: 'Blind Hunter and Edge Case Hunter ran in subagents; Acceptance Auditor ran in the main agent against the Story 2.5 spec.'
---

# Code Review - Story 2.5

## Scope

- Backend workflow session entity, migration, repository, service, controller, and tests.
- Frontend advisory workflow client, Next proxy routes, workspace launch UI, and tests.
- Story and sprint status artifacts for Story 2.5.

## Findings Raised And Resolved

### Patch Findings

1. **Runtime prompt/source leakage in launch response**
   - Source: Blind Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
   - Resolution: launch still validates the full runtime assembly path, but the API now returns only the first prompt source content plus safe source refs (`workflow:{key}`, `current-step:1`). Tests assert no `## Source`, `_bmad`, or internal agent content leaks in the response.

2. **Success audit failure could be reported as workflow launch failure**
   - Source: Blind Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
   - Resolution: success audit emission is best-effort after session creation and no longer falls into the workflow start failure path. A regression test covers audit-store failure after a successful launch.

3. **Duplicate active workflow launches**
   - Source: Blind Hunter + Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.repository.ts`, `backend/src/database/migrations/1772000000030-CreateAdvisoryWorkflowSessions.ts`, `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Resolution: backend checks for an active tenant/actor session before assembly, the migration/entity add a partial unique active-session index, and the frontend uses a synchronous in-flight ref plus active-session disable state.

4. **Existing session UI could be cleared by a later launch failure**
   - Source: Blind Hunter.
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
   - Resolution: launch failure no longer clears `activeLaunch`; after an active launch, controls remain disabled for Story 2.5’s one-active-workflow boundary.

5. **Workflow proxy routes relayed arbitrary Authorization headers without a NextAuth session**
   - Source: Blind Hunter.
   - Location: `frontend/app/api/advisory/workflows/route.ts`, `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.ts`.
   - Resolution: workflow proxy routes now require `getServerSession(...).accessToken`; tests assert caller-only Authorization headers return 401.

6. **Session update allowed create-only ownership fields**
   - Source: Blind Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.repository.ts`.
   - Resolution: repository strips `actorId`, `workflowKey`, `workflowDisplayName`, and `scenarioLabel` on update; tests codify the create-only behavior.

7. **Partial workflow catalog could silently render**
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.service.ts`, `frontend/lib/advisory/workflows.ts`.
   - Resolution: backend and frontend both validate that all eight MVP workflow keys are present before returning/rendering a ready catalog.

8. **Malformed workflow key handling was outside failure audit path**
   - Source: Edge Case Hunter.
   - Location: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
   - Resolution: workflow key validation now emits `thinktank.workflow.start_failed` with a safe `invalid-workflow` subject and returns a `BadRequestException` for malformed keys.

## Acceptance Auditor

No remaining acceptance blockers were found after the fixes:

- AC1/AC3: eight workflows are validated by catalog tests and parameterized backend launch tests.
- AC2: launch persists an active session, emits success audit best-effort, and returns the current first prompt plus current-step-only UI state.
- AC4: tenant scoping is enforced through `BaseRepository` patterns and repository tests.
- AC5: runtime failures emit `thinktank.workflow.start_failed` and do not create corrupted sessions.

## Verification After Fixes

- `cd backend && npm run test -- src/modules/advisory/sessions --runInBand` — 21 tests passed.
- `cd backend && npm run test -- src/modules/advisory/runtime src/modules/advisory/sessions --runInBand` — 51 tests passed.
- `cd backend && npm run test -- src/modules/advisory --runInBand` — 117 tests passed.
- `cd backend && npx tsc --noEmit` — passed.
- `cd backend && npm run orm:entities:parity` — passed.
- `cd backend && npm run orm:metadata:check` — passed.
- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx app/api/advisory/workflows --runInBand` — 23 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand` — 40 tests passed.
- `cd frontend && npx tsc --noEmit` — passed.

## Conclusion

Code review initially found blocking issues, all were fixed and reverified. Current conclusion: **Pass / no remaining blocking findings**.
