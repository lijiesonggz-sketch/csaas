---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-20T11:39:04+08:00'
workflowType: testarch-trace
storyId: '2.9'
storyKey: 2-9-report-viewing-and-export
storyTitle: Report Viewing and Export
inputDocuments:
  - _bmad-output/implementation-artifacts/2-9-report-viewing-and-export.md
  - _bmad-output/test-artifacts/atdd-checklist-2-9-report-viewing-and-export.md
  - _bmad-output/test-artifacts/code-review-story-2-9-report-viewing-and-export.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/selective-testing.md
---

# Traceability Matrix & Gate Decision - Story 2.9 Report Viewing and Export

## Gate Decision: PASS

Rationale: P0 coverage is 100%, P1 coverage is 100%, and overall coverage is 100% (minimum: 80%). No critical or high coverage gaps remain after code-review fixes.

## Context Loaded

- Story file: `_bmad-output/implementation-artifacts/2-9-report-viewing-and-export.md`
- ATDD artifact: `_bmad-output/test-artifacts/atdd-checklist-2-9-report-viewing-and-export.md`
- Code review artifact: `_bmad-output/test-artifacts/code-review-story-2-9-report-viewing-and-export.md`
- Planning context: ThinkTank PRD FR19/FR21/FR33/NFR10, Epic 2 UX-DR12/UX-DR23, architecture addendum MVP export scope.
- Knowledge fragments: `test-priorities-matrix.md`, `risk-governance.md`, `probability-impact.md`, `test-quality.md`, `selective-testing.md`.

## Coverage Summary

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 6 | 6 | 100% | PASS |
| P1 | 2 | 2 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **8** | **8** | **100%** | **PASS** |

## Traceability Matrix

| AC | Priority | Coverage | Tests | Heuristics |
| --- | --- | --- | --- | --- |
| AC1 - Document drawer/report view renders the current report as structured Markdown with title, sections, visible AI label, and generation metadata | P0 | FULL | `frontend/app/advisory/__tests__/page.test.tsx:1378`; `frontend/app/advisory/__tests__/page.test.tsx:1414`; `frontend/app/advisory/__tests__/page.test.tsx:1418`; `frontend/app/advisory/__tests__/page.test.tsx:1420`; `frontend/app/advisory/__tests__/page.test.tsx:1421`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:128`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:136` | Endpoint: n/a; auth: n/a; error paths: present |
| AC2 - Export reads the server-side current output snapshot, supports active draft/latest completed output without workflow completion, and rejects empty or unlabeled output | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:150`; `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:162`; `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:189`; `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:222`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:139` | Endpoint: present; auth: present; error paths: present |
| AC3 - Markdown export preserves visible report structure, AI label, generation metadata, machine-readable JSON-LD metadata, and non-blocking success feedback | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:162`; `frontend/lib/advisory/outputs.export.test.ts:48`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:95`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:155`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:177`; `frontend/app/advisory/__tests__/page.test.tsx:1686`; `frontend/app/advisory/__tests__/page.test.tsx:1701` | Endpoint: present; auth: present; error paths: present |
| AC4 - Guarded backend export route, Next proxy, and frontend helper use only session id plus format, preserve download headers, and do not accept or send tenant/output/report/audit body data | P0 | FULL | `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:71`; `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:84`; `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:111`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:78`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:84`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:95`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:128`; `frontend/lib/advisory/outputs.export.test.ts:48`; `frontend/lib/advisory/outputs.export.test.ts:76`; `frontend/lib/advisory/outputs.export.test.ts:95`; `frontend/lib/advisory/outputs.export.test.ts:132` | Endpoint: present; auth: present; error paths: present |
| AC5 - Successful export emits privacy-safe `thinktank.output.exported` audit with output id, format, tenant, actor, workflow, section count, and AI-label metadata presence; audit failures fail export | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:259`; `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:297`; `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:111` | Endpoint: present; auth: present; error paths: present |
| AC6 - Tenant and actor scoping hide cross-tenant and same-tenant different-actor export attempts without leaking report metadata | P0 | FULL | `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:297`; `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:313`; `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:111`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:84` | Endpoint: present; auth/authz negative paths: present; error paths: present |
| AC7 - PDF export produces binary PDF with CJK-capable fonts, preserves AI labeling, escapes AI-generated content, and uses resource guards | P1 | FULL | `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts:236`; `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts:134`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:128`; `frontend/lib/advisory/outputs.export.test.ts:76`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:128` | Endpoint: present; auth: present; error paths: present |
| AC8 - Export failures surface as persistent recoverable guidance, stale async export results do not affect a new session, and drawer/workflow focus and decision state remain intact | P1 | FULL | `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:152`; `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts:179`; `frontend/lib/advisory/outputs.export.test.ts:111`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:155`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:168`; `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx:177`; `frontend/app/advisory/__tests__/page.test.tsx:1686` | Endpoint: present; auth: present; error paths: present |

## Coverage Heuristics

- Endpoints without direct tests: 0.
- Auth/authz negative-path gaps: 0.
- Happy-path-only criteria: 0.
- API-impacting AC2/AC3/AC4/AC5/AC6/AC7/AC8 have backend service/controller coverage, Next proxy coverage, frontend client coverage, and error-path coverage.
- Tenant and actor enforcement is covered for cross-tenant, same-tenant different actor, and caller-supplied metadata rejection.
- Export error handling is covered at PDF renderer/service, proxy fallback, frontend client, drawer alert, and workspace focus/state boundaries.

## Quality Notes

- Warning, non-blocking: `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts` is 335 lines, slightly above the 300-line target. It is still focused on the export service contract and can be split later if it becomes harder to maintain.
- Warning, non-blocking: `frontend/app/advisory/__tests__/page.test.tsx` is an aggregated advisory route suite over 300 lines. Story 2.9 adds route-level workflow continuity coverage there to preserve existing Epic 2 regression context.
- Deterministic coverage: no test requires live LLM/network availability. PDF rendering, proxy responses, auth tokens, Blob downloads, and drawer behavior are mocked or exercised through local service/controller/proxy boundaries.
- No production `data-testid` attributes were introduced in Story 2.9 production files; frontend assertions use role, label, title, text, alert, status, and semantic structure.

## Verification Evidence

- `cd backend && npm run test -- src/modules/advisory/outputs/advisory-output-export.service.spec.ts src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts --runInBand` - 13 tests passed.
- `cd frontend && npx jest --runTestsByPath "lib/advisory/outputs.export.test.ts" "app/api/advisory/sessions/[sessionId]/output/export/route.test.ts" "components/advisory/AdvisoryDocumentDrawer.export.test.tsx" "app/advisory/__tests__/page.test.tsx" --runInBand` - 49 tests passed.
- `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs src/modules/advisory/events --runInBand` - 92 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand` - 108 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd frontend && npx tsc --noEmit` - passed.
- `git diff --check` - passed.
- Code review: `_bmad-output/test-artifacts/code-review-story-2-9-report-viewing-and-export.md` concluded pass after fixes with 8 patch findings fixed and no deferred blockers.

## Recommendations

- LOW: split the aggregated advisory route suite and export service spec later if subsequent Epic 2 stories make them harder to maintain.

## Gate Summary

GATE DECISION: PASS

- P0 Coverage: 100% (required: 100%) - MET.
- P1 Coverage: 100% (pass target: 90%, minimum: 80%) - MET.
- Overall Coverage: 100% (minimum: 80%) - MET.
- Critical gaps: 0.
- Release status for this story: approved; no traceability blocker remains.
