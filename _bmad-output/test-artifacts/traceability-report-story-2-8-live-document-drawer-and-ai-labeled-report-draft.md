---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-20T10:32:00+08:00'
workflowType: testarch-trace
storyId: '2.8'
storyKey: 2-8-live-document-drawer-and-ai-labeled-report-draft
storyTitle: Live Document Drawer and AI-Labeled Report Draft
---

# Traceability Matrix & Gate Decision - Story 2.8 Live Document Drawer and AI-Labeled Report Draft

## Gate Decision: PASS

Rationale: P0 coverage is 100%, P1 coverage is 100%, and overall coverage is 100% (minimum: 80%). No critical or high coverage gaps remain after code-review fixes.

## Context Loaded

- Story file: `_bmad-output/implementation-artifacts/2-8-live-document-drawer-and-ai-labeled-report-draft.md`
- ATDD artifact: `_bmad-output/test-artifacts/atdd-checklist-2-8-live-document-drawer-and-ai-labeled-report-draft.md`
- Planning context: ThinkTank PRD FR16/FR19/FR33/NFR10, Epic 2 UX-DR11/UX-DR12/UX-DR22, architecture tenant isolation addendum.
- Knowledge fragments: `test-priorities-matrix.md`, `risk-governance.md`, `probability-impact.md`, `test-quality.md`, `selective-testing.md`.

## Coverage Summary

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 3 | 3 | 100% | PASS |
| P1 | 3 | 3 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **6** | **6** | **100%** | **PASS** |

## Traceability Matrix

| AC | Priority | Coverage | Tests | Heuristics |
| --- | --- | --- | --- | --- |
| AC1 - Completed workflow steps append live report sections with visible AI label and machine-readable metadata | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts:163`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:289`; `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts:124`; `frontend/lib/advisory/outputs.test.ts:96`; `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts:67`; `frontend/app/advisory/__tests__/page.test.tsx:1399`; `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:200` | Endpoint: present; auth: present; error paths: present |
| AC2 - `workflow_outputs` records stay tenant-scoped and cross-tenant direct-id access leaks no metadata | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts:86`; `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts:126`; `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts:250`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:253`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:348`; `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts:87`; `frontend/lib/advisory/outputs.test.ts:63`; `frontend/lib/advisory/outputs.test.ts:96`; `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts:52`; `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts:63`; `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts:97`; `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts:54`; `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts:67` | Endpoint: present; auth/authz negative paths: present; error paths: present |
| AC3 - Collapsed document trigger shows a new-content hint after appended sections and opens latest section | P1 | FULL | `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:171`; `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:200`; `frontend/app/advisory/__tests__/page.test.tsx:1355`; `frontend/app/advisory/__tests__/page.test.tsx:1399` | Endpoint: n/a; auth: n/a; error paths: present |
| AC4 - Open drawer scrolls to appended content, preserves input focus, supports Escape/Ctrl+D, and clamps resize width | P1 | FULL | `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:232`; `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:272`; `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:290`; `frontend/app/advisory/__tests__/page.test.tsx:1543`; `frontend/app/advisory/__tests__/page.test.tsx:1608` | Endpoint: n/a; auth: n/a; error paths: present |
| AC5 - Appended report content and workflow completion feedback restore focus and announce completed steps accessibly | P1 | FULL | `frontend/app/advisory/__tests__/page.test.tsx:1399`; `frontend/app/advisory/__tests__/page.test.tsx:1464`; `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx:232`; `frontend/lib/advisory/outputs.test.ts:190`; `frontend/lib/advisory/outputs.test.ts:206` | Endpoint: present for append/complete; auth: present; error paths: present |
| AC6 - Final workflow completion emits privacy-safe `thinktank.workflow.completed` audit with tenant, actor, session, workflow type, output id, outcome, and AI-label metadata presence | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts:215`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:407`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:481`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:513`; `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts:553`; `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts:170`; `frontend/lib/advisory/outputs.test.ts:155`; `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts:54`; `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts:67`; `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts:117`; `frontend/app/advisory/__tests__/page.test.tsx:1464` | Endpoint: present; auth: present; error paths: present |

## Coverage Heuristics

- Endpoints without direct tests: 0.
- Auth/authz negative-path gaps: 0.
- Happy-path-only criteria: 0.
- API-impacting AC1/AC2/AC5/AC6 have backend service/controller tests, Next proxy tests, frontend client tests, validation/error-path tests, and tenant-field stripping tests.
- Frontend-only AC3/AC4 have component-level and route-level RTL coverage for collapsed, open, resize, keyboard, scroll, hint, and focus behavior.

## Quality Notes

- Warning, non-blocking: `frontend/app/advisory/__tests__/page.test.tsx` is an aggregated advisory route suite over 300 lines. Story 2.8 adds route-level integration coverage there to preserve existing Epic 2 regression context; split it later if maintainability degrades.
- Deterministic coverage: no test requires live LLM/network availability. Provider output, workflow output APIs, SSE completion events, and drawer behavior are mocked or exercised through local service/controller/proxy boundaries.
- No production `data-testid` attributes were introduced; frontend assertions use role, label, status, text, title, semantic structure, and accessibility names.

## Verification Evidence

- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/advisory/AdvisoryDocumentDrawer.test.tsx --runInBand` - 39 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand` - 91 tests passed.
- `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs --runInBand` - 59 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd frontend && npx tsc --noEmit` - passed.
- `cd backend && npm run orm:entities:parity` - passed.
- `cd backend && npm run orm:metadata:check` - passed.
- `cd backend && npm run migration:check:fresh` - passed.
- `git diff --check` - passed.

## Recommendations

- LOW: split the aggregated advisory route test suite later if subsequent Epic 2 stories make it difficult to maintain.

## Gate Summary

GATE DECISION: PASS

- P0 Coverage: 100% (required: 100%) - MET.
- P1 Coverage: 100% (pass target: 90%, minimum: 80%) - MET.
- Overall Coverage: 100% (minimum: 80%) - MET.
- Critical gaps: 0.
- Release status for this story: approved; no traceability blocker remains.
