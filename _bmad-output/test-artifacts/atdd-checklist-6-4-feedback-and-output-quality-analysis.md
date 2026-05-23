---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-23T19:11:35+08:00'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/6-4-feedback-and-output-quality-analysis.md
  - _bmad-output/implementation-artifacts/3-5-recommendation-feedback.md
  - _bmad-output/implementation-artifacts/4-4-report-rating-favorites-and-asset-state.md
  - _bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md
  - _bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md
  - _bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md
  - backend/src/modules/advisory/operations/advisory-operations.controller.ts
  - backend/src/database/entities/advisory-recommendation-feedback.entity.ts
  - backend/src/database/entities/advisory-output-rating.entity.ts
  - frontend/lib/advisory/operations.ts
  - frontend/app/admin/advisory/operations/page.tsx
  - frontend/e2e/advisory-operations-dashboard.atdd.spec.ts
---

# ATDD Checklist: Story 6.4 Feedback and Output Quality Analysis

## Step 1: Preflight & Context Loading

- Story: `_bmad-output/implementation-artifacts/6-4-feedback-and-output-quality-analysis.md`
- Detected stack: `fullstack`
- Primary implementation scope: backend read model/API, frontend operations client/proxy/page, and Playwright dashboard coverage.
- Existing data sources:
  - `recommendation_feedback` from Story 3.5.
  - `output_ratings` and `workflow_outputs` from Story 4.4.
- Test framework evidence:
  - Backend Jest specs under `backend/src/modules/advisory/**`.
  - Frontend Jest config: `frontend/jest.config.js`.
  - Playwright config: `frontend/playwright.config.ts`.

## Step 2: Generation Mode Selection

- Chosen mode: AI generation with subagent-assisted read-only design for API/backend and frontend/E2E slices.
- Browser recording: skipped. Existing operations dashboard selectors and mock route patterns are sufficient for RED coverage.
- CLI session cleanup: N/A; no browser recording session opened.
- Subagents were closed after returning read-only ATDD design output.

## Step 3: Test Strategy

| Test ID | Priority | Level | AC | Scenario |
| --- | --- | --- | --- | --- |
| 6.4-BE-001 | P0 | Backend service | AC1, AC3 | Aggregate recommendation feedback by workflow, recommendation type, tenant, and date range without raw text. |
| 6.4-BE-002 | P0 | Backend service | AC1, AC3 | Aggregate output ratings by workflow using existing `workflow_outputs` metadata. |
| 6.4-BE-003 | P0 | Backend service | AC2 | Highlight affected categories and low-quality trend direction. |
| 6.4-BE-004 | P1 | Backend service | AC1, AC2 | Report missing workflow/category/orphaned output/malformed rating as instrumentation gaps. |
| 6.4-BE-005 | P1 | Backend service | AC1, AC2 | Return unavailable state with null rates when feedback sources fail. |
| 6.4-BE-006 | P0 | Backend service | AC3 | Reject foreign tenant before reading quality rows. |
| 6.4-API-001 | P0 | Backend API | AC1, AC2, AC3 | Serve `GET /advisory/admin/operations/quality-feedback` with data envelope and current tenant normalization. |
| 6.4-API-002 | P0 | Backend/API proxy | AC3 | Reject foreign tenant and duplicate unsafe filters before backend/source reads. |
| 6.4-UNIT-001 | P1 | Frontend client | AC1 | Normalize quality aggregates by workflow, recommendation type, tenant, and date range. |
| 6.4-UNIT-002 | P1 | Frontend client | AC2 | Normalize rating distribution, low-quality categories, and trend direction. |
| 6.4-UNIT-004 | P0 | Frontend client | AC1, AC2 | Sanitize raw feedback/report/prompt/conversation strings from normalized view models. |
| 6.4-UNIT-006 | P1 | Frontend client | AC1, AC3 | Fetch through Next proxy with safe filters only and `tenantId=current` suppression. |
| 6.4-COMP-001 | P1 | Frontend page | AC1 | Render quality section in existing operations page. |
| 6.4-COMP-003 | P1 | Frontend page | AC2 | Render affected low-quality workflow/category rows with text trend direction. |
| 6.4-COMP-005 | P1 | Frontend page | AC3 | Tenant admin view shows only current-tenant aggregate rows. |
| 6.4-E2E-001 | P1 | E2E | AC1, AC2 | Dashboard renders metrics, distribution, trends, and gaps from mocked quality API. |
| 6.4-E2E-003 | P0 | E2E | AC3 | Cross-tenant rows are not exposed in tenant-level quality view. |
| 6.4-E2E-004 | P0 | E2E | AC1, AC2 | Raw feedback/report/prompt/conversation sentinel strings are never rendered. |

## Step 4: RED Tests Generated

Generated and intentionally skipped RED coverage:

- `backend/src/modules/advisory/operations/advisory-quality-feedback.atdd.spec.ts`
  - Service/read-model aggregation, trend, instrumentation gap, unavailable, and tenant-scope coverage.
- `backend/src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts`
  - Parking route coverage for guarded quality endpoint, tenant rejection, malformed filters, unavailable body, anonymous, and role-denied paths.
- `frontend/lib/advisory/operations.test.ts`
  - Parking client normalization/fetch/privacy/unavailable tests for quality feedback.
- `frontend/app/api/advisory/admin/operations/quality-feedback/route.test.ts`
  - Parking Next proxy whitelist, duplicate rejection, `tenantId=current`, auth, upstream status propagation, and unsafe-query omission tests.
- `frontend/app/admin/advisory/operations/page.test.tsx`
  - Parking component/page assertions for quality metrics, trends, feedback text counts, tenant scope, filters, unavailable state, and raw sentinel suppression.
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
  - Parking E2E journey for quality feedback dashboard behavior with mocked API responses.

TDD RED compliance:

- All Story 6.4 generated tests use `describe.skip()` or `it.skip()`.
- Tests assert expected behavior and are ready to unskip during green implementation.
- Tests are designed to fail because `AdvisoryQualityFeedbackService`, `quality-feedback` endpoint/proxy, and frontend quality view do not exist yet.
- The tests do not require live GLM/provider calls.

## Acceptance Criteria Coverage

- AC1: Covered by backend aggregation, frontend normalization, proxy whitelisting, page rendering, and E2E quality metrics tests.
- AC2: Covered by backend trend computation, frontend trend normalization/page rendering, unavailable handling, and E2E affected category tests.
- AC3: Covered by service-level tenant rejection, controller/proxy tenant rules, page tenant-scope assertions, and E2E cross-tenant suppression.

## Green Phase Commands

```bash
cd backend
npm test -- --runInBand src/modules/advisory/operations/advisory-quality-feedback.atdd.spec.ts src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts
npx tsc --noEmit

cd frontend
npm test -- lib/advisory/operations.test.ts app/api/advisory/admin/operations/quality-feedback/route.test.ts app/admin/advisory/operations/page.test.tsx
npx tsc --noEmit
npx playwright test e2e/advisory-operations-dashboard.atdd.spec.ts --project=chromium
```

## Implementation Checklist

- [ ] Add `AdvisoryQualityFeedbackService` and types under `backend/src/modules/advisory/operations/`.
- [ ] Add tenant-scoped read methods over `recommendation_feedback` and `output_ratings`/`workflow_outputs`.
- [ ] Add `GET /advisory/admin/operations/quality-feedback` with existing guards and `{ data }` envelope.
- [ ] Add frontend quality feedback client normalizer and fetcher in `frontend/lib/advisory/operations.ts`.
- [ ] Add Next proxy route `frontend/app/api/advisory/admin/operations/quality-feedback/route.ts`.
- [ ] Extend `frontend/app/admin/advisory/operations/page.tsx` in place.
- [ ] Unskip Story 6.4 RED tests and make them pass.
- [ ] Verify raw feedback/report/prompt/conversation strings are not returned or rendered.

## Step 5: Validate & Complete

- Checklist validation: complete for Story 6.4 ATDD scope.
- Temp artifacts: generated under `_bmad-output/test-artifacts/tmp/`.
- Browser sessions: none opened.
- Key assumption: Story 6.4 is an aggregate quality view and should not expose raw optional text feedback without explicit policy and tests.
