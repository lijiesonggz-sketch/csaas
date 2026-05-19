---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-20T05:30:24+08:00'
workflowType: testarch-trace
storyId: '2.5'
storyKey: 2-5-workflow-selection-and-launch
storyTitle: Workflow Selection and Launch
inputDocuments:
  - _bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md
  - _bmad-output/test-artifacts/atdd-checklist-2-5-workflow-selection-and-launch.md
  - _bmad-output/test-artifacts/code-review-story-2-5.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/selective-testing.md
---

# Traceability Matrix & Gate Decision - Story 2.5

**Story:** Workflow Selection and Launch
**Date:** 2026-05-20
**Evaluator:** TEA Trace Workflow

Note: This trace replaces the previous `traceability-report-story-2-5.md`, which belonged to an older KG story and was not valid evidence for the current ThinkTank Epic 2 Story 2.5.

## Step 1: Context Summary

- Story file loaded: `_bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md`
- ATDD artifact loaded: `_bmad-output/test-artifacts/atdd-checklist-2-5-workflow-selection-and-launch.md`
- Code review artifact loaded: `_bmad-output/test-artifacts/code-review-story-2-5.md`
- Knowledge fragments loaded: test priorities, risk governance, probability-impact, test quality, selective testing.
- Acceptance criteria extracted: 5 ACs covering eight-workflow catalog, shared runtime launch, first prompt/current step UI, launch audit, tenant-scoped `workflow_sessions`, and recoverable start failures.

## Step 2: Test Discovery

### Relevant Test Catalog

| Test File | Level | Relevant Coverage |
| --- | --- | --- |
| `backend/src/modules/advisory/sessions/advisory-session.service.spec.ts` | Unit / integration boundary | Workflow catalog, eight-key parameterized launch, shared assembler/session path, audit success/failure, duplicate active launch, no corrupted failed session |
| `backend/src/modules/advisory/sessions/advisory-session.repository.spec.ts` | Unit | Tenant-scoped create/read/update/delete and create-only field stripping |
| `backend/src/modules/advisory/sessions/advisory-session.controller.spec.ts` | API/controller | Guarded controller envelope and route-param launch contract |
| `backend/src/modules/advisory/runtime/workflow-registry.service.spec.ts` | Unit / runtime integration | Eight MVP workflows discovered from runtime assets, runtime catalog rows without workflow-specific overrides |
| `backend/src/modules/advisory/runtime/prompt-assembler.service.spec.ts` | Unit / runtime integration | Provider/parser/assembler path, invalid workflow key, malformed method library handling |
| `backend/src/modules/advisory/runtime/runtime-file-provider.service.spec.ts` | Unit | Approved-root file provider, missing/unsupported/empty file operational errors |
| `frontend/app/advisory/__tests__/page.test.tsx` | Component / RTL | Catalog UI, accessible launch controls, pending duplicate guard, first prompt rendering, current-step-only stepper, failure recovery |
| `frontend/app/api/advisory/workflows/route.test.ts` | API proxy | NextAuth session-token boundary for catalog proxy |
| `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.test.ts` | API proxy | NextAuth session-token boundary for launch proxy |

### Coverage Heuristics Inventory

- **Endpoints referenced:** `GET /advisory/workflows`, `POST /advisory/workflows/:workflowKey/launch`, frontend proxies under `/api/advisory/workflows`.
- **Endpoint coverage:** controller specs cover backend route contracts; proxy route tests cover NextAuth token forwarding; service specs cover business behavior under the endpoints.
- **Auth/authz coverage:** backend controller uses `JwtAuthGuard` and `TenantGuard`; frontend proxy tests verify caller-only `Authorization` headers are rejected without a NextAuth session token.
- **Tenant isolation coverage:** repository tests verify tenant id injection and scoped read/update/delete without cross-tenant inference.
- **Error-path coverage:** incomplete catalog, blank/malformed workflow key, runtime assembly failure, audit-store failure after successful launch, duplicate active launch, frontend launch failure, and proxy unauthenticated paths are covered.

## Step 3: Criteria-To-Test Mapping

| AC | Requirement Summary | Priority | Tests / Evidence | Coverage | Rationale |
| --- | --- | --- | --- | --- | --- |
| AC1 | Advisory workspace lists all eight MVP workflows by scenario label and canonical name, using the shared file-driven runtime launch path without workflow-specific branching. | P0 | `advisory-session.service.spec.ts:156`, `advisory-session.service.spec.ts:172`, `workflow-registry.service.spec.ts:22`, `workflow-registry.service.spec.ts:242`, `frontend/app/advisory/__tests__/page.test.tsx:435` | FULL | Backend rejects partial catalog and runtime registry proves eight keys from source assets; UI renders eight launch controls with display/scenario labels and removes legacy placeholders. |
| AC2 | Launch shows first runtime prompt, horizontal current-step-only stepper, and emits `thinktank.workflow.started` with tenant/actor/session/workflow/outcome. | P0 | `advisory-session.service.spec.ts:180`, `advisory-session.service.spec.ts:211`, `advisory-session.service.spec.ts:257`, `frontend/app/advisory/__tests__/page.test.tsx:467` | FULL | Parameterized launch validates session creation, safe first prompt, safe source refs, success audit metadata, best-effort audit behavior, UI first prompt, and one-step stepper. |
| AC3 | Parameterized tests prove each of the eight workflows uses the same file provider, parser/assembler, brand mapper, session creation, and launch path. | P0 | `advisory-session.service.spec.ts:180`, `prompt-assembler.service.spec.ts`, `runtime-file-provider.service.spec.ts`, `workflow-registry.service.spec.ts:22`, `workflow-registry.service.spec.ts:242` | FULL | `it.each(workflowKeys)` launches all eight keys through the same service dependencies, while runtime tests validate file provider, registry, parser/assembler, and no code-level workflow overrides. |
| AC4 | `workflow_sessions` records are tenant-scoped through shared tenant context/BaseRepository; tenant A cannot read/update/delete/infer tenant B records. | P0 | `advisory-session.repository.spec.ts:59`, `advisory-session.repository.spec.ts:85`, `advisory-session.repository.spec.ts:97`, `advisory-session.repository.spec.ts:113`, `advisory-session.repository.spec.ts:141`, `1772000000030-CreateAdvisoryWorkflowSessions.ts` | FULL | Repository tests prove tenant id stripping, tenant-scoped reads/active lookup/update/delete, and cross-tenant not-found behavior; migration/entity require `tenant_id` and add active-session indexes. |
| AC5 | Runtime/provider unavailable or malformed launch returns a clear recovery message, emits `thinktank.workflow.start_failed`, and creates no corrupted session. | P0 | `advisory-session.service.spec.ts:298`, `advisory-session.service.spec.ts:337`, `runtime-file-provider.service.spec.ts:87`, `prompt-assembler.service.spec.ts:58`, `prompt-assembler.service.spec.ts:113`, `frontend/app/advisory/__tests__/page.test.tsx:541` | FULL | Service tests cover runtime assembly failure and blank key failure with start_failed audit and no session creation; runtime tests cover provider/assembler failure modes; UI shows retryable alert without fake active prompt. |

## Step 4: Gap Analysis

### Coverage Statistics

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 5 | 5 | 100% | PASS |
| P1 | 0 | 0 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **5** | **5** | **100%** | **PASS** |

### Gap Counts

- Critical gaps (P0): 0
- High gaps (P1): 0
- Medium gaps (P2): 0
- Low gaps (P3): 0
- Endpoint coverage gaps: 0
- Auth/authz negative-path gaps: 0
- Happy-path-only criteria: 0

### Quality Assessment

- BLOCKER issues: 0
- WARNING issues: 1
  - `frontend/app/advisory/__tests__/page.test.tsx` is an aggregated advisory route suite over 300 lines. The Story 2.5 assertions are focused and deterministic, so this is a maintainability warning rather than a gate blocker. Split the broader advisory route suite later if it continues to grow.
- INFO issues: 0

### Duplicate Coverage Analysis

- AC1/AC3 intentionally have backend runtime/service and frontend component overlap. This is acceptable defense-in-depth because backend validates registry/runtime behavior while frontend validates user-visible catalog and controls.
- AC5 intentionally has runtime unit, service error, and UI recovery overlap. This is acceptable because provider failure, audit behavior, and user recovery message are separate failure surfaces.

### Phase 1 Summary

- Total Requirements: 5
- Fully Covered: 5 (100%)
- Partially Covered: 0
- Uncovered: 0
- Recommendations: no blocking test additions required before marking Story 2.5 done.

Phase 1 coverage matrix saved to `_bmad-output/test-artifacts/traceability-story-2-5-workflow-selection-and-launch-phase1.json`.

## Step 5: Gate Decision

### Decision Criteria Evaluation

| Criterion | Threshold | Actual | Status |
| --- | --- | --- | --- |
| P0 Coverage | 100% | 100% | MET |
| P0 Test Pass Rate | 100% | 100% | MET |
| P1 Coverage | >=90% for PASS | 100% effective; no P1 ACs | MET |
| Overall Coverage | >=80% | 100% | MET |
| Security Issues | 0 unresolved | 0 | MET |
| Critical NFR Failures | 0 unresolved | 0 | MET |
| Flaky Tests | 0 known | 0 known | MET |

### Evidence Summary

Local verification evidence recorded in the code review artifact:

- `cd backend && npm run test -- src/modules/advisory/sessions --runInBand` - 21 tests passed.
- `cd backend && npm run test -- src/modules/advisory/runtime src/modules/advisory/sessions --runInBand` - 51 tests passed.
- `cd backend && npm run test -- src/modules/advisory --runInBand` - 117 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd backend && npm run orm:entities:parity` - passed.
- `cd backend && npm run orm:metadata:check` - passed.
- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx app/api/advisory/workflows --runInBand` - 23 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand` - 40 tests passed.
- `cd frontend && npx tsc --noEmit` - passed.

### GATE DECISION: PASS

**Rationale:** P0 coverage is 100%, overall requirements coverage is 100%, all Story 2.5 ACs have direct backend and/or frontend automated evidence, no critical gaps remain after code review fixes, and the recorded regression/type/ORM checks are green.

### Gate Recommendations

1. Mark Story 2.5 as `done` after updating sprint/story status.
2. Keep the frontend route test file-size warning as non-blocking technical debt; split only if future advisory UI work makes the suite harder to maintain.
3. Continue Epic 2 with Story 2.6 after committing Story 2.5.

## Sign-Off

- Phase 1 - Traceability Assessment: PASS
- Phase 2 - Gate Decision: PASS
- Overall Status: PASS

Generated: 2026-05-20T05:30:24+08:00
Workflow: bmad-testarch-trace
