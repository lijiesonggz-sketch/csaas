---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-22T00:43:00+08:00'
workflowType: testarch-trace
storyId: '4.7'
storyKey: 4-7-safe-exit-and-destructive-session-actions
storyTitle: Safe Exit and Destructive Session Actions
coverageMatrixFile: _bmad-output/test-artifacts/traceability-story-4-7-safe-exit-and-destructive-session-actions-phase1.json
inputDocuments:
  - .claude/claude.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad-output/implementation-artifacts/4-7-safe-exit-and-destructive-session-actions.md
  - _bmad-output/test-artifacts/atdd-checklist-4-7-safe-exit-and-destructive-session-actions.md
  - _bmad-output/test-artifacts/code-review-story-4-7-safe-exit-and-destructive-session-actions.md
  - _bmad-output/planning-artifacts/epics.md
knowledgeFragments:
  - test-priorities-matrix.md
  - risk-governance.md
  - probability-impact.md
  - test-quality.md
  - selective-testing.md
---

# Traceability Matrix & Gate Decision - Story 4.7

**Story:** Safe Exit and Destructive Session Actions  
**Date:** 2026-05-22  
**Evaluator:** GPT-5 Codex  
**Gate Decision:** PASS

## Step 1: Context Loaded

已加载 Story 4.7、ATDD checklist、三子代理 code-review 结论、Epic/PRD/architecture references、TEA index 和 mandatory knowledge fragments。验收标准完整，风险集中在 safe exit 的 recoverable lifecycle、destructive tombstone 的 tenant/actor/route scope、accessible confirmation 的取消路径、stale async/stream state prevention、以及 deletion audit metadata privacy。

## Step 2: Test Discovery

发现并纳入 trace 的测试层级如下：

| Level | Coverage Source | Relevant Tests |
| --- | --- | ---: |
| Unit/Repository | lifecycle state transitions, stale update races, tombstone parameter binding, history filters | 5 Story 4.7 declarations |
| Service/API | safe exit, paused resume, destructive tombstone commands, controller/proxy routes, audit events | 12 Story 4.7 declarations |
| Client/Component | lifecycle clients, accessible dialog, cancel/Escape/backdrop preservation, state sync, failure preservation | 12 Story 4.7 declarations |
| E2E-smoke | role/name selector smoke for safe exit and delete dialogs plus history-search regression | 2 specs / 3 Chromium tests |

Coverage heuristics inventory:

| Heuristic | Result |
| --- | --- |
| Endpoint coverage | Direct backend controller tests cover `POST /advisory/sessions/:sessionId/exit`, `DELETE /advisory/sessions/:sessionId`, and `DELETE /advisory/sessions/:sessionId/output/:outputId`; frontend proxy route tests cover token/encoded route-param forwarding. |
| Auth/authz negative paths | Service/repository tests cover tenant/actor/session scope, foreign/deleted NotFound semantics, and paused resume active-session conflict mapping. Proxy routes require NextAuth token for safe exit. |
| Error paths | Covered for safe-exit update race, stale output tombstone update, paused resume unique race, destructive API failure preserving UI state, and stale stream/result prevention after confirmed actions. |
| Happy-path-only criteria | None. Each AC has backend scope/error coverage and frontend cancellation/failure or stale-state coverage. |

## Step 3: Traceability Matrix

| AC | Priority | Coverage | Key Tests |
| --- | --- | --- | --- |
| AC1 safe exit confirms auto-save and defaults focus to safe cancel; backend preserves recoverable paused state | P0 | FULL | `4.7-BE-GREEN-001` safe-exit checkpoint + pause; `4.7-BE-GREEN-002` paused resume and uniqueness conflict; `4.7-BE-001` lost active-state race; `4.7-BE-GREEN-006/008` route contract; `4.7-FE-001/011/012` client/proxy contract; `4.7-FE-006/008` alertdialog focus and stale-stream prevention; `4.7-E2E-001` accessible smoke |
| AC2 destructive session/output actions use accessible alert dialog and all cancel/dismiss paths preserve state | P0 | FULL | `4.7-BE-GREEN-003/004/005` session/output tombstone and NotFound semantics; `4.7-BE-003/004` tombstone metadata binding and stale output guard; `4.7-FE-002/003/004/005/013/014` client/proxy delete contracts and failure envelopes; `4.7-FE-007/010` Escape/backdrop/cancel and failure-state preservation; `4.7-E2E-001` role/name smoke |
| AC3 confirmed destructive actions update list/detail consistently and emit tenant/actor scoped audit events | P0 | FULL | `4.7-BE-GREEN-003/004` privacy-safe `thinktank.session.deleted` / `thinktank.output.deleted`; `thinktank-event-contract.spec.ts` audit contract regression; `advisory-session.history.spec.ts` deleted-session exclusion; `advisory-session.outputs.spec.ts` output visibility; `4.7-FE-009` session/output UI state removal; full focused backend/frontend suites |

## Step 4: Gap Analysis

| Gap Type | Count |
| --- | ---: |
| Critical P0 gaps | 0 |
| High P1 gaps | 0 |
| Endpoint gaps | 0 |
| Auth/authz negative-path gaps | 0 |
| Happy-path-only criteria | 0 |
| Partial coverage items | 0 |
| Unit-only blocking items | 0 |

Coverage statistics:

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 3 | 3 | 100% | PASS |
| P1 | 0 | 0 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **3** | **3** | **100%** | **PASS** |

Non-blocking note: the original RED backend ATDD skeleton remains skipped as an intent artifact, while executable green backend lifecycle/controller/repository specs now carry the acceptance enforcement. Frontend ATDD client/component/E2E coverage is executable.

## Step 5: Gate Decision

**Decision:** PASS

Rationale: P0 coverage is 100%, effective P1 coverage is 100% because Story 4.7 has no P1 acceptance criteria, and overall coverage is 100%. No critical, high-priority, endpoint, auth/authz, happy-path-only, or partial-coverage gaps remain.

Gate criteria:

| Criterion | Threshold | Actual | Status |
| --- | --- | --- | --- |
| P0 requirements coverage | 100% | 100% | MET |
| P1 requirements coverage | >=90% for PASS, >=80% minimum | 100% effective | MET |
| Overall requirements coverage | >=80% | 100% | MET |

## Execution Evidence

| Command | Result |
| --- | --- |
| `cd backend && npx tsc --noEmit --pretty false` | PASS |
| `cd frontend && node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS |
| `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.lifecycle.spec.ts src/modules/advisory/sessions/advisory-session.controller.spec.ts src/modules/advisory/sessions/advisory-session.resume.spec.ts src/modules/advisory/sessions/advisory-session.history.spec.ts src/modules/advisory/sessions/advisory-session.outputs.spec.ts src/modules/advisory/events/thinktank-event-contract.spec.ts src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts src/modules/advisory/sessions/advisory-session.repository.spec.ts --runInBand` | PASS, 8 suites / 88 tests |
| `cd frontend && npm run test -- --runTestsByPath components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx components/advisory/AdvisoryWorkspaceShell.history-search.test.tsx components/advisory/AdvisoryWorkspaceShell.safe-exit-delete.atdd.test.tsx lib/advisory/sessions.test.ts lib/advisory/sessions.safe-exit-delete.atdd.test.ts lib/advisory/outputs.test.ts lib/advisory/outputs.delete.atdd.test.ts app/api/advisory/sessions/[sessionId]/exit/route.test.ts app/api/advisory/sessions/[sessionId]/route.test.ts app/api/advisory/sessions/[sessionId]/output/[outputId]/route.test.ts --runInBand` | PASS, 10 suites / 34 tests |
| `cd frontend && npm run test:e2e -- advisory-history-search.spec.ts advisory-safe-exit-destructive-actions.atdd.spec.ts --project=chromium` | PASS, 3 Chromium tests |
| `cd backend && npm run test -- --runInBand` | PASS, 320 suites passed / 19 skipped; 2814 tests passed / 112 skipped / 5 todo |

## Related Artifacts

- Phase 1 matrix: `_bmad-output/test-artifacts/traceability-story-4-7-safe-exit-and-destructive-session-actions-phase1.json`
- Gate YAML: `_bmad-output/test-artifacts/gate-decision-story-4-7-safe-exit-and-destructive-session-actions.yaml`
- Story file: `_bmad-output/implementation-artifacts/4-7-safe-exit-and-destructive-session-actions.md`
- ATDD checklist: `_bmad-output/test-artifacts/atdd-checklist-4-7-safe-exit-and-destructive-session-actions.md`
- Code review artifact: `_bmad-output/test-artifacts/code-review-story-4-7-safe-exit-and-destructive-session-actions.md`

## Gate Decision Summary

GATE DECISION: PASS

Coverage Analysis:

- P0 Coverage: 100% (Required: 100%) -> MET
- P1 Coverage: 100% effective (PASS target: 90%, minimum: 80%) -> MET
- Overall Coverage: 100% (Minimum: 80%) -> MET

Decision Rationale: P0 coverage is 100% and overall coverage is 100%. No P1 requirements detected.

Critical Gaps: 0

Recommended Actions:

- Re-run Story 4.7 focused lifecycle/client/component/E2E tests after any future session lifecycle, output history, or workspace shell state-machine change.
- Keep deletion audit metadata limited to ids/status/counts and reject raw advisory content keys when new metadata fields are added.

## Sign-Off

Phase 1 traceability assessment: PASS  
Phase 2 quality gate decision: PASS  
Overall status: PASS
