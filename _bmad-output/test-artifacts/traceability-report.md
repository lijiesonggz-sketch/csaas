---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-21T04:15:00+08:00'
workflowType: testarch-trace
storyId: '3.7'
storyKey: 3-7-contextual-recommendations-with-csaas-data-fallback
storyTitle: Contextual Recommendations with CSAAS Data Fallback
coverageMatrixFile: _bmad-output/test-artifacts/tea-trace-coverage-matrix-3-7-2026-05-21T04-14-02+08-00.json
inputDocuments:
  - .claude/claude.md
  - _bmad/bmm/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad-output/implementation-artifacts/3-7-contextual-recommendations-with-csaas-data-fallback.md
  - _bmad-output/test-artifacts/atdd-checklist-3-7-contextual-recommendations-with-csaas-data-fallback.md
  - _bmad-output/planning-artifacts/epics.md
knowledgeFragments:
  - test-priorities-matrix.md
  - risk-governance.md
  - probability-impact.md
  - test-quality.md
  - selective-testing.md
---

# Traceability Matrix & Gate Decision - Story 3.7

**Story:** Contextual Recommendations with CSAAS Data Fallback
**Date:** 2026-05-21
**Evaluator:** TEA Trace Workflow

## Step 1: Load Context & Knowledge Base

### Acceptance Criteria

| AC | Requirement |
| --- | --- |
| AC1 | Given CSAAS IT maturity or compliance data is available within the response-time threshold, Quick Consult recommendations include available enterprise signals and users can see recommendations are using enterprise context. |
| AC2 | Given CSAAS data is unavailable, errors, or exceeds 2 seconds, recommendations fall back to generic mode and the UI clearly indicates enterprise data is temporarily unavailable. |
| AC3 | Given enterprise background completeness is low, recommendations show a non-blocking prompt to add missing context that improves recommendation precision. |

### Context Loaded

- Story implementation context with AC1-AC3, tasks, architecture constraints, and verification evidence.
- ATDD checklist with backend service/integration and frontend client/proxy/component coverage intent.
- Epic 3 planning excerpt for Story 3.7.
- TEA knowledge fragments for priority mapping, risk governance, probability-impact scoring, test quality, and selective execution.

### Testing Strategy Signals

- P0 coverage is required for tenant scoping, privacy-safe enterprise signal handling, generic fallback, and visible accessible UI warnings.
- P1 coverage is required for low-completeness prompt quality and non-blocking continuation.
- Gate criteria: no uncovered P0 ACs, no open score-9 risks, no unresolved HIGH/MEDIUM review findings.

## Step 2: Discover & Catalog Tests

### Relevant Test Inventory

| Level | Test File | Test IDs / Coverage Signals | Priority |
| --- | --- | --- | --- |
| Unit/API boundary | `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.spec.ts` | AC1 enterprise signals; AC2 no data/malformed/error/no org/timeout; AC1-AC2 tenant mismatch privacy | P0 |
| Backend service integration | `backend/src/modules/advisory/quick-consult/quick-consult.service.contextual-recommendations.spec.ts` | AC1 enterprise response context; AC2 generic fallback without failed consult; AC3 low-completeness prompt; AC1-AC2 metadata/audit markers only | P0/P1 |
| Backend recommendation unit | `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.contextual.spec.ts` | AC1 safe signal rationale/source refs; AC2 generic fallback and no CSAAS citation when no applied signals; AC3 missing-field prompt and inferred defaults | P0/P1 |
| Frontend client unit | `frontend/lib/advisory/quick-consult.contextual-recommendations.test.ts` | AC1-AC3 normalize recommendation/enterprise context; AC1-AC2 degrade malformed enterprise context with empty applied signals | P0 |
| Frontend proxy/API route | `frontend/app/api/advisory/quick-consult/start/route.contextual-recommendations.test.ts` | AC1-AC2 request whitelist; caller-supplied tenant/organization/signal/maturity/compliance fields not forwarded | P0 |
| Frontend component | `frontend/components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx` | AC1 visible enterprise `role="status"`; AC2 generic `role="alert"` and controls usable; AC3 non-blocking completion prompt and settings action | P0/P1 |
| Existing regression support | `backend/src/modules/advisory/quick-consult/*.spec.ts`, `frontend/lib/advisory/quick-consult.test.ts`, `frontend/app/api/advisory/quick-consult/start/route.test.ts` | Existing Quick Consult validation, classification, organization-context, proxy whitelist, recommendation cards, feedback, and telemetry regression | P0/P1 |

### Coverage Heuristics

- API endpoint inventory: Story exercises `POST /advisory/quick-consult/start` through backend service/controller coverage and frontend proxy route tests.
- Authentication/authorization inventory: frontend proxy requires NextAuth session token; backend controller/service tests use authenticated `user` and trusted route/current tenant context. Negative request-whitelist cases cover caller-supplied tenant/organization payload injection.
- Tenant/data privacy inventory: backend service and signal boundary tests prove tenant A does not receive or infer tenant B signal existence; metadata/audit tests assert raw reports, questionnaire answers, prompts, provider output, exception details, and raw problem text are not persisted.
- Error-path inventory: no data, malformed adapter result, missing organization id, thrown errors, timeout, tenant mismatch, malformed frontend enterprise context, missing/empty low-completeness fields, and unavailable optional organization context have deterministic tests.
- UI/a11y inventory: enterprise context uses `role="status"`, generic fallback uses `role="alert"`, low-completeness prompt uses a visible non-blocking action, and recommendation/manual browse controls remain enabled.

### Direct Gaps Found In Discovery

None for AC1-AC3. No E2E/browser test is present, but the behavior is deterministic service/client/component logic with existing Testing Library role/text coverage and no live CSAAS dependency; this is acceptable for this story.

## Step 3: Criteria-To-Test Traceability Matrix

| AC | Priority | Coverage | Test Mapping | Endpoint/Auth/Error Heuristics |
| --- | --- | --- | --- | --- |
| AC1: available CSAAS IT maturity/compliance data is included in recommendation context and visible as enterprise context | P0 | FULL | `csaas-enterprise-signals.service.spec.ts` AC1; `quick-consult.service.contextual-recommendations.spec.ts` AC1; `quick-consult-method-recommendation.service.contextual.spec.ts` AC1; `quick-consult.contextual-recommendations.test.ts` AC1; `route.contextual-recommendations.test.ts` AC1; `QuickConsultProblemIntake.contextual-recommendations.test.tsx` AC1 | Endpoint coverage present through Quick Consult start route/proxy and service orchestration. Auth/trusted context present through route token and server-side tenant/user context tests. Error path not required for happy-path AC, but tenant mismatch/privacy negative tests are present. |
| AC2: unavailable/error/>2s CSAAS data falls back to generic mode and UI warns clearly | P0 | FULL | `csaas-enterprise-signals.service.spec.ts` AC2; `quick-consult.service.contextual-recommendations.spec.ts` AC2; `quick-consult-method-recommendation.service.contextual.spec.ts` AC2; `quick-consult.contextual-recommendations.test.ts` AC2 malformed frontend context; `route.contextual-recommendations.test.ts` AC2 whitelist; `QuickConsultProblemIntake.contextual-recommendations.test.tsx` AC2 | Endpoint coverage present. Error paths present for no data, malformed, error, no organization, timeout, tenant mismatch, and malformed frontend context. Auth/negative path present through no-session proxy test and caller-supplied tenant/signal stripping. |
| AC3: low enterprise background completeness prompts for missing context without blocking continuation | P1 | FULL | `quick-consult.service.contextual-recommendations.spec.ts` AC3; `quick-consult-method-recommendation.service.contextual.spec.ts` AC3 including empty missingFields inference; `quick-consult.contextual-recommendations.test.ts` AC3 context prompt normalization; `QuickConsultProblemIntake.contextual-recommendations.test.tsx` AC3 visible prompt/action plus accept/manual browse usability | Endpoint coverage present through Quick Consult response contract. Auth/authz not central to AC3 but inherited from Quick Consult start path. Error-path coverage present for empty missing fields and optional organization context degradation. |

### Coverage Logic Validation

- P0 AC1/AC2 have backend boundary, backend orchestration, frontend client/proxy, and component coverage.
- P1 AC3 has backend service/recommendation and frontend component coverage, including non-blocking interaction assertions.
- Duplicate coverage is intentional: backend tests own trusted tenant/fallback/privacy behavior; frontend tests own normalization, proxy whitelist, and visible accessibility states.
- AC2 is not happy-path-only; timeout/error/no-data/malformed/no-organization/tenant-mismatch paths are covered.
- API-impacting ACs include endpoint/proxy checks and authenticated session denial for the frontend proxy.

## Step 4: Coverage Gap Analysis & Matrix Generation

### Execution Mode

- User permitted subagents for the overall pipeline.
- Step 4 was executed sequentially because the remaining work was deterministic report synthesis and did not need parallel delegation.

### Gap Analysis

| Gap Category | Count | Requirements |
| --- | ---: | --- |
| Critical P0 uncovered | 0 | None |
| High P1 uncovered | 0 | None |
| Medium P2 uncovered | 0 | None |
| Low P3 uncovered | 0 | None |
| Partial coverage | 0 | None |
| Unit-only coverage | 0 | None |

### Coverage Heuristics

| Heuristic | Count | Result |
| --- | ---: | --- |
| Endpoints without tests | 0 | Quick Consult start route/proxy and backend service paths covered. |
| Auth negative-path gaps | 0 | Proxy no-session and caller-supplied tenant/signal stripping are covered; backend uses trusted tenant/user context. |
| Happy-path-only criteria | 0 | AC2 includes no-data, malformed, error, missing organization, timeout, tenant mismatch, and malformed frontend context tests. |

### Coverage Statistics

| Priority | Covered | Total | Coverage |
| --- | ---: | ---: | ---: |
| P0 | 2 | 2 | 100% |
| P1 | 1 | 1 | 100% |
| P2 | 0 | 0 | 100% |
| P3 | 0 | 0 | 100% |

Overall coverage: 3/3 fully covered (100%).

### Recommendations

- LOW: Run `bmad-testarch-test-review` if an additional non-blocking test-quality audit is desired.
- LOW: When a real CSAAS adapter replaces the deterministic no-data adapter, add adapter-level contract tests for the external integration boundary.

### Phase 1 Output

Coverage matrix saved to `_bmad-output/test-artifacts/tea-trace-coverage-matrix-3-7-2026-05-21T04-14-02+08-00.json`.

Phase 1 is complete and ready for Step 5 gate decision.

## Step 5: Gate Decision

### Gate Decision: PASS

**Rationale:** P0 coverage is 100%, P1 coverage is 100% (target: 90%), and overall coverage is 100% (minimum: 80%).

### Gate Criteria

| Criterion | Required / Target | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% required | 100% | MET |
| P1 coverage | 90% pass target, 80% minimum | 100% | MET |
| Overall coverage | 80% minimum | 100% | MET |

### Coverage Analysis

- Total requirements: 3
- Fully covered: 3
- Partially covered: 0
- Uncovered: 0
- Critical gaps: 0
- High gaps: 0

### Uncovered Requirements

None.

### Recommended Actions

- LOW: Run `bmad-testarch-test-review` if an additional non-blocking test-quality audit is desired.
- LOW: When a real CSAAS adapter replaces the deterministic no-data adapter, add adapter-level contract tests for the external integration boundary.

### Gate Summary

GATE: PASS - Release approved for Story 3.7 traceability. Coverage meets the deterministic TEA criteria with no blocking P0/P1 gaps.
