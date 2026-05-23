# Story 6.4: Feedback and Output Quality Analysis

Status: done

## Story

As a platform operator,
I want to analyze recommendation and report quality feedback,
so that I can identify where ThinkTank's guidance is not meeting user expectations.

## Acceptance Criteria

1. Given users rate recommendations or generated reports, when the operator opens the quality view, then ratings are aggregated by workflow, recommendation type, tenant, and time range, and optional text feedback can be reviewed only where permissions and privacy policy allow.
2. Given feedback indicates low quality for a workflow or recommendation category, when the operator reviews trends, then the dashboard highlights affected categories and trend direction, and the data can inform future prompt, workflow, or recommendation improvements.
3. Given a tenant administrator views tenant-level quality data, when the view loads, then only that tenant's aggregated data is shown, and cross-tenant data is not exposed.

## Tasks / Subtasks

- [x] Create RED acceptance coverage for quality feedback aggregation (AC: 1, 2, 3)
  - [x] Add backend service ATDD/spec coverage for recommendation and output rating aggregation by workflow, recommendation type, tenant, and date range.
  - [x] Add controller route coverage for guards, `tenantId=current`, foreign-tenant rejection before data reads, malformed filters, and unavailable data state.
  - [x] Add frontend library/proxy/page coverage for safe query forwarding, normalization, privacy sanitization, low-quality trend highlights, and tenant-scoped display.
  - [x] Extend the operations dashboard E2E mock to prove raw feedback/report/prompt/conversation sentinels are not rendered.
- [x] Implement backend quality aggregation under the existing advisory operations boundary (AC: 1, 2, 3)
  - [x] Add quality summary/read-model types in `backend/src/modules/advisory/operations/`.
  - [x] Query `recommendation_feedback` and `output_ratings` directly through tenant-scoped repositories/query builders; do not create duplicate rating tables.
  - [x] Aggregate recommendation feedback by `workflow_keys`, `primary_problem_type` or safe recommendation category, tenant, and period bucket.
  - [x] Aggregate output ratings by workflow metadata from associated session/output data where available; missing workflow metadata must become an instrumentation gap, not a silent unknown success.
  - [x] Return `summary`, grouped breakdowns, low-quality trends, `instrumentationGaps`, `freshness`, `generatedAt`, and `appliedFilters`.
  - [x] Treat datastore/query failures as `measurementStatus: unavailable` with null rates where appropriate; never render trustworthy zeroes for unavailable measurements.
- [x] Add guarded operations API endpoint (AC: 1, 3)
  - [x] Add `GET /advisory/admin/operations/quality-feedback` to `AdvisoryOperationsController`.
  - [x] Reuse `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, and `UserRole.ADMIN`.
  - [x] Reuse date-range validation and tenant filter semantics from usage/provider telemetry endpoints.
  - [x] Reject foreign tenant access before invoking the aggregation service.
  - [x] Return the existing `{ data }` envelope shape.
- [x] Extend frontend operations data layer and proxy (AC: 1, 2, 3)
  - [x] Add `fetchAdvisoryQualityFeedback` and normalization types in `frontend/lib/advisory/operations.ts`.
  - [x] Add Next proxy route under `frontend/app/api/advisory/admin/operations/quality-feedback/route.ts`.
  - [x] Whitelist only safe query parameters: date range, tenant, workflow/recommendation grouping filters, and time bucket if implemented.
  - [x] Reject duplicate query parameters and suppress `tenantId=current` before forwarding to the backend.
  - [x] Forward auth and upstream status/body using the existing usage/provider proxy pattern with `cache: no-store`.
- [x] Extend the existing operations dashboard UI (AC: 1, 2)
  - [x] Add a quality feedback section to `frontend/app/admin/advisory/operations/page.tsx`; do not create a new landing page.
  - [x] Show recommendation and report rating distribution, average rating, low-rating rate, sample size, trend direction, and affected categories.
  - [x] Show optional text feedback only as privacy-safe availability counts or withheld counts unless an explicit allowed policy is implemented and tested.
  - [x] Preserve existing usage/provider sections and shared filter behavior.
- [x] Verification and documentation (AC: 1, 2, 3)
  - [x] Run focused backend/frontend unit tests and operations E2E coverage.
  - [x] Run TypeScript checks for touched backend/frontend packages.
  - [x] Update this story file with implementation notes, file list, review results, and trace/gate artifacts.

## Dev Notes

### Source Requirements

- FR8 requires users to rate recommendation quality from 1 to 5 and persist feedback for continuous improvement. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` FR8]
- FR20 requires users to rate generated reports from 1 to 5. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` FR20]
- FR47 requires platform operators to view usage distribution, completion rate, and user rating summary. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` FR47]
- Epic 6 is the operations monitoring and quality feedback loop over telemetry, audit events, and feedback produced by prior epics. [Source: `_bmad-output/planning-artifacts/epics.md` Epic 6]
- UX requires the operator dashboard to include recommendation/report quality ratings, tenant/date/workflow filters, freshness/unavailable states, and no raw conversation content by default. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` Operator Usage Dashboard]

### Existing Data Sources to Reuse

- Recommendation feedback already exists from Story 3.5:
  - `backend/src/database/entities/advisory-recommendation-feedback.entity.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult-recommendation-feedback.repository.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult-recommendation-feedback.service.ts`
  - Table: `recommendation_feedback`
  - Useful fields: `tenant_id`, `actor_id`, `quick_consult_context_id`, `rating`, `feedback_text`, `problem_type_ids`, `primary_problem_type`, `recommendation_ids`, `workflow_keys`, `metadata`, `created_at`.
- Report/output ratings already exist from Story 4.4:
  - `backend/src/database/entities/advisory-output-rating.entity.ts`
  - `backend/src/modules/advisory/outputs/advisory-output-rating.repository.ts`
  - `backend/src/database/entities/advisory-workflow-output.entity.ts`
  - Table: `output_ratings`
  - Useful fields: `tenant_id`, `actor_id`, `output_id`, `session_id`, `rating`, `feedback_text`, `is_favorited`, `rated_at`, `metadata`.
- Do not introduce duplicate feedback/rating persistence. Story 6.4 is a read/aggregation surface over existing structured feedback.

### Backend Implementation Guidance

- Put the new read model under `backend/src/modules/advisory/operations/`, alongside:
  - `advisory-operations.service.ts`
  - `advisory-provider-telemetry.service.ts`
  - `advisory-operations.controller.ts`
- Match the existing operations response shape:
  - `generatedAt`
  - `appliedFilters`
  - `summary`
  - grouped arrays
  - `lowQualityTrends`
  - `instrumentationGaps`
  - `freshness`
- Tenant isolation is mandatory:
  - Application code uses `tenant_id + BaseRepository`/tenant-filtered query patterns as the MVP source of truth. [Source: `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md`]
  - If `tenantId` is omitted or `current`, aggregate only the guarded request tenant.
  - If a user requests another tenant, return `403` before data access.
  - Platform-wide cross-tenant rollups are not required for this story unless an existing explicit platform role check supports them.
- Date filtering:
  - Support `dateFrom`/`dateTo` using `created_at` for recommendation feedback and `rated_at`/`updated_at` fallback for output ratings.
  - Malformed dates must be rejected at the controller/proxy boundary.
- Low-quality trend:
  - Treat ratings `1` and `2` as low quality unless tests establish a different threshold.
  - Trend direction can compare the current half of the selected window against the previous half: `up`, `down`, `flat`, or `insufficient_data`.
  - Affected categories should include workflow key and recommendation type/problem category when available.
- Instrumentation gaps:
  - Missing workflow key, missing recommendation category, orphaned output rating, malformed metadata, out-of-range rating, and unsafe feedback text exposure attempts must be reported as gaps.
  - Gaps must not be silently folded into valid zero-count buckets.

### Privacy Guardrails

- Raw problem descriptions, normalized problems, prompts, conversations, report content, provider payloads, and raw feedback text must not appear in operations aggregates, telemetry metadata, frontend normalized view models, or E2E mock-visible UI.
- Optional text feedback can be represented by:
  - `feedbackTextPresentCount`
  - `feedbackTextWithheldCount`
  - `feedbackTextUnavailableReason`
  - safe length buckets if useful
- Do not display raw `feedback_text` in Story 6.4 unless there is an explicit policy/permission check plus focused tests proving only allowed users can see it.
- Existing privacy helpers reject raw-sensitive keys in operations normalization; extend those checks rather than bypassing them.

### Frontend Implementation Guidance

- Extend the existing operations admin surface:
  - `frontend/lib/advisory/operations.ts`
  - `frontend/app/api/advisory/admin/operations/quality-feedback/route.ts`
  - `frontend/app/admin/advisory/operations/page.tsx`
  - `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- Reuse shared filters and unavailable/freshness alert semantics from usage/provider telemetry.
- The UI should be dense and operational, not a marketing page:
  - compact metric cards
  - rating distribution
  - grouped table by workflow/category
  - trend label with text, not color alone
  - gaps/freshness panel
- The frontend normalizer must sanitize any server string that looks like raw content or feedback. Tests should include sentinel strings such as `PRIVATE_feedback`, `raw prompt`, `conversation`, and `report content`.

### Previous Story Intelligence

- Story 6.1 established the usage dashboard pattern: guarded operations endpoint, audit-derived aggregation, freshness/unavailable handling, Next proxy whitelist, frontend normalization, and operations page sectioning.
- Story 6.2 established provider telemetry aggregation: deterministic grouping, privacy-unsafe event rejection, malformed event gaps, and no live provider dependency in tests.
- Story 6.3 extended the operations dashboard for cost/latency/failure: threshold warnings, shared filters, `Promise.allSettled` loading, proxy duplicate-query rejection, and no misleading zeroes when telemetry is unavailable.
- Story 3.5 created the recommendation feedback persistence and telemetry contract. Do not change its submission semantics unless directly required and tested.
- Story 4.4 created report output rating/favorite state. Story 6.4 consumes `output_ratings`; it does not change user-facing report rating controls unless a regression is found.

### Testing Requirements

- Backend focused tests:
  - quality aggregation by recommendation workflow/type/tenant/date range
  - output rating aggregation by workflow/tenant/date range
  - low-quality trend direction and affected categories
  - missing metadata as instrumentation gaps
  - repository/query failure returns unavailable state
  - foreign tenant is rejected before data access
  - raw text is never returned
- Frontend focused tests:
  - `frontend/lib/advisory/operations.test.ts` normalization, query shape, unavailable state, and privacy sanitization
  - Next proxy tests for whitelist, duplicate rejection, `tenantId=current`, auth forwarding, and upstream status propagation
  - operations page tests for rendering quality metrics, trends, gaps, and no raw sentinel strings
- E2E:
  - Extend `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts` with mocked quality-feedback API responses.
  - Verify tenant/date filters are sent, quality section renders, low-quality categories are visible, and raw feedback/report/prompt/conversation sentinel strings are absent.

### Suggested Commands

- Backend:
  - `cd backend; npm test -- --runInBand src/modules/advisory/operations/advisory-quality-feedback.service.spec.ts src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts`
  - `cd backend; npx tsc --noEmit`
- Frontend:
  - `cd frontend; npm test -- lib/advisory/operations.test.ts app/api/advisory/admin/operations/quality-feedback/route.test.ts app/admin/advisory/operations/page.test.tsx`
  - `cd frontend; npx tsc --noEmit`
  - `cd frontend; npx playwright test e2e/advisory-operations-dashboard.atdd.spec.ts`

## Project Structure Notes

- Backend stays inside the existing NestJS advisory module. Register any new quality service in `backend/src/modules/advisory/advisory.module.ts`.
- Do not add global dependencies for charting or date libraries unless the existing frontend already uses them in the touched surface.
- Keep API query parameters camelCase and database columns snake_case.
- Keep `_bmad-output` artifacts synchronized after implementation, review, and trace.

## References

- `_bmad-output/planning-artifacts/epics.md` - Epic 6 and Story 6.4 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR8, FR20, FR47.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Operator Usage Dashboard requirements and privacy rules.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - tenant filtering, source tree, and API conventions.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - tenant_id + BaseRepository source of truth.
- `_bmad-output/implementation-artifacts/3-5-recommendation-feedback.md` - recommendation feedback persistence and privacy-safe telemetry.
- `_bmad-output/implementation-artifacts/4-4-report-rating-favorites-and-asset-state.md` - output ratings and feedback state.
- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md` - usage operations dashboard pattern.
- `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md` - provider aggregation pattern.
- `_bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md` - frontend dashboard and proxy pattern.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `_bmad-output/test-artifacts/atdd-checklist-6-4-feedback-and-output-quality-analysis.md`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `npm --workspace backend test -- advisory-quality-feedback.atdd.spec.ts advisory-operations.controller.routes.spec.ts --runInBand`
- `npm --workspace frontend test -- lib/advisory/operations.test.ts app/api/advisory/admin/operations/quality-feedback/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand`
- `npm --workspace backend exec -- npx tsc --noEmit`
- `npm --workspace frontend exec -- npx tsc --noEmit`
- `npm --workspace frontend exec -- npx playwright test e2e/advisory-operations-dashboard.atdd.spec.ts --project=chromium`
- `_bmad-output/test-artifacts/traceability-report-story-6-4-feedback-and-output-quality-analysis.md`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-54-38+08-00.json`
- `_bmad-output/test-artifacts/gate-decision-story-6-4-feedback-and-output-quality-analysis.yaml`

### Completion Notes List

- 2026-05-23: Story context created from Epic 6.4, prior story artifacts, operations dashboard code patterns, and feedback/rating entity reuse analysis.
- 2026-05-23: ATDD Step 2 completed. Parking RED coverage was added for backend quality aggregation, guarded API route behavior, frontend quality client/proxy/page behavior, E2E dashboard rendering, tenant isolation, unavailable state, low-quality trends, and raw feedback/report/prompt/conversation suppression.
- 2026-05-23: Implemented privacy-safe quality feedback aggregation over existing `recommendation_feedback` and `output_ratings`, including workflow/category/tenant/period groupings, low-quality trends, instrumentation gaps, freshness, unavailable-source handling, and distinct summary counts for multi-workflow recommendation feedback.
- 2026-05-23: Added guarded backend `GET /advisory/admin/operations/quality-feedback` endpoint with current-tenant normalization, foreign tenant rejection before service reads, date/group/time-bucket validation, and `{ data }` response envelope.
- 2026-05-23: Added frontend quality feedback client, Next proxy, dashboard sections, shared filter reload behavior, tenant-scoped quality rows, rating distribution, low-quality trends, quality gaps, and raw feedback/report/prompt/conversation suppression.
- 2026-05-23: Verification passed: backend focused tests, frontend focused tests, backend TypeScript, frontend TypeScript, and Chromium Playwright operations dashboard E2E.
- 2026-05-23: Code review completed with Blind Hunter, Edge Case Hunter, and Acceptance Auditor. Resolved findings for service tenant fallback, session-token precedence, favorite-only output rows, report/output low-quality trends, grouped instrumentation gaps, malformed metadata gaps, `groupBy` gating, sanitizer overreach, and unavailable E2E contract alignment.
- 2026-05-23: Traceability and quality gate completed. Gate decision PASS with 3/3 acceptance criteria fully covered, P0 coverage 100%, P1 coverage 100%, and no endpoint/auth/error-path coverage gaps.

### Change Log

- 2026-05-23: Added Story 6.4 quality feedback backend/API/frontend/E2E implementation and moved story status to review.
- 2026-05-23: Addressed code review findings for tenant isolation, output rating edge cases, quality trend coverage, gap privacy, metadata validation, and proxy auth precedence.
- 2026-05-23: Added traceability report, coverage matrix, gate decision, and moved story status to done.

## Senior Developer Review (AI)

### Review Date

2026-05-23

### Review Outcome

Approve after fixes

### Review Layers

- Blind Hunter: raised tenant scope, proxy auth precedence, source-unavailable contract, raw text loading, gap privacy, date window, groupBy, output trends, no-data state, sanitizer overreach.
- Edge Case Hunter: confirmed tenant fallback, favorite-only rows, output trends, groupBy, strict datetime, unavailable mock divergence.
- Acceptance Auditor: raised favorite-only output rows, report/output trend coverage, and malformed metadata gap coverage.

### Resolution Summary

- Fixed tenant scope to require `currentTenantId` or actor tenant and reject any explicit foreign tenant before repository reads.
- Removed raw feedback text from repository aggregation projections; only privacy-safe `feedbackTextPresent` booleans flow through aggregation.
- Ignored favorite-only output rows, added malformed metadata gaps, aggregated instrumentation gaps without record IDs, and narrowed raw-content detection to sentinel/raw content patterns.
- Added report/output ratings to low-quality trends and retained affected categories even when direction is flat/down if current low-quality rate breaches threshold.
- Implemented `groupBy` response gating and aligned quality E2E unavailable mock with the backend's `{ data, freshness.status: unavailable }` contract.

### File List

- `_bmad-output/implementation-artifacts/6-4-feedback-and-output-quality-analysis.md`
- `_bmad-output/test-artifacts/atdd-checklist-6-4-feedback-and-output-quality-analysis.md`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-11-35+08-00.json`
- `backend/src/modules/advisory/operations/advisory-quality-feedback.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-quality-feedback.service.ts`
- `backend/src/modules/advisory/operations/advisory-quality-feedback.types.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/outputs/advisory-output-rating.repository.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult-recommendation-feedback.repository.ts`
- `frontend/lib/advisory/operations.ts`
- `frontend/lib/advisory/operations.test.ts`
- `frontend/app/api/advisory/admin/operations/quality-feedback/route.ts`
- `frontend/app/api/advisory/admin/operations/quality-feedback/route.test.ts`
- `frontend/app/admin/advisory/operations/page.tsx`
- `frontend/app/admin/advisory/operations/page.test.tsx`
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- `_bmad-output/test-artifacts/traceability-report-story-6-4-feedback-and-output-quality-analysis.md`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-54-38+08-00.json`
- `_bmad-output/test-artifacts/gate-decision-story-6-4-feedback-and-output-quality-analysis.yaml`

## Traceability and Gate

- Traceability report: `_bmad-output/test-artifacts/traceability-report-story-6-4-feedback-and-output-quality-analysis.md`
- Coverage matrix: `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-4-feedback-and-output-quality-analysis-2026-05-23T19-54-38+08-00.json`
- Gate decision: `_bmad-output/test-artifacts/gate-decision-story-6-4-feedback-and-output-quality-analysis.yaml`
- Gate outcome: PASS
- Coverage: 3/3 acceptance criteria fully covered; P0 100%, P1 100%, overall 100%.
