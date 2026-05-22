---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-22T16:12:12+08:00'
inputDocuments:
  - _bmad/bmm/config.yaml
  - _bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md
  - frontend/playwright.config.ts
  - frontend/jest.config.js
  - backend/package.json
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/ci-burn-in.md
  - _bmad/tea/testarch/knowledge/playwright-cli.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
---

# ATDD Preflight: Story 6.1

## Detected Stack

fullstack

## Prerequisites

- Story file has clear acceptance criteria.
- Frontend test framework exists through `frontend/playwright.config.ts` and `frontend/jest.config.js`.
- Backend test framework exists through `backend/package.json` Jest configuration.
- Development environment and workspaces are available.

## Loaded Context Summary

- Story under test: `6-1-usage-and-completion-dashboard`.
- Primary backend target: `backend/src/modules/advisory/operations/`.
- Primary frontend target: `frontend/app/admin/advisory/operations/page.tsx`.
- Existing event source: `audit_logs.details` normalized by Story 1.4 event contract.
- Required risk posture: P1/P0-adjacent because this story guards operational visibility, tenant scoping, and privacy-safe aggregation.

## ATDD Focus

- Known versioned ThinkTank events are counted.
- Unknown, unversioned, wrong-version, or malformed rows are surfaced as instrumentation gaps.
- Tenant/date filters scope metrics.
- Low-completion workflow trends are identified from aggregate counts.
- Delayed or unavailable telemetry shows freshness/unavailable states rather than misleading zero success metrics.
- Raw private conversation, prompt, report, and feedback content never appears in API or UI results.

## Generation Mode

Mode: AI generation.

Reason: Story 6.1 has clear API and UI acceptance criteria, the primary risk is deterministic aggregation over existing events, and the target page does not exist yet. Browser recording is deferred until after the page exists; frontend tests will use React Testing Library selectors by role/text and API route mocks.

## Test Strategy

| ID | AC | Priority | Level | Scenario | Red Phase Expectation |
| --- | --- | --- | --- | --- | --- |
| 6.1-UNIT-001 | AC1, AC2 | P0 | Backend unit | Counts versioned workflow/Quick Consult events by workflow type and tenant/date scope | Fails because `AdvisoryOperationsService` does not exist |
| 6.1-UNIT-002 | AC2 | P0 | Backend unit | Records unknown event names, missing/wrong event_version, invalid occurred_at, and missing workflow identifiers as instrumentation gaps | Fails because gap model does not exist |
| 6.1-UNIT-003 | AC3 | P1 | Backend unit | Flags low-completion workflows and exposes aggregate drilldown without raw private fields | Fails because low-completion calculation does not exist |
| 6.1-UNIT-004 | AC4 | P1 | Backend unit | Returns delayed/unavailable freshness status instead of misleading zero success metrics | Fails because freshness contract does not exist |
| 6.1-API-001 | AC1, AC4 | P1 | Backend controller | `GET /advisory/admin/operations/usage` delegates tenant/date filters and returns `{ data }` | Fails because controller route does not exist |
| 6.1-FE-001 | AC1, AC3, AC4 | P1 | Frontend lib/component | Fetch helper unwraps `{ data }`, page renders filters, summary metrics, workflow table, gap and freshness states | Fails because frontend operations API/page does not exist |
| 6.1-FE-002 | AC3 | P1 | Frontend component | Raw private strings in API fixture are not rendered; only aggregate drilldown appears | Fails because component does not exist |

Duplicate coverage guard: backend unit tests own aggregation correctness; controller tests own request/response wiring; frontend tests own rendering and privacy display. No browser E2E is required until the route exists and auth setup can be reused reliably.

## TDD Red Phase Aggregation

Generated files:

- `backend/src/modules/advisory/operations/advisory-operations.usage.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.atdd.spec.ts`
- `tests/api/advisory-operations-usage.spec.ts`
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- `tests/fixtures/advisory-operations-usage-test-data.ts`

Validation:

- API/backend tests: 11
- Frontend/E2E tests: 6
- All generated RED phase tests use `test.skip()`.
- No placeholder assertions were found.
- Summary saved to `D:\tmp\tea-atdd-summary-2026-05-22T16-12-12.json`.
- Temp JSON artifacts copied into `_bmad-output/implementation-artifacts/tests/`.

Green phase instruction: after implementation, remove `test.skip()` from the generated ATDD files in the relevant execution scope and run the targeted backend/frontend suites until green.

## Validate and Complete

Prerequisites and framework checks passed for fullstack delivery. Generated tests were validated for `test.skip()` RED phase compliance, no placeholder assertions, no hard waits, and no brittle CSS/XPath selectors. Playwright CLI was not used for recording, so there are no browser sessions to clean up.

Key assumptions:

- RED phase tests stay skipped until implementation work removes skips for the targeted suite.
- Service and component tests created during dev-story will be executable immediately and will carry the active green-phase signal.
- Root `tests/api` is an ATDD contract artifact; backend Jest and frontend Jest/Playwright remain the primary runnable suites for this repo.
