# Story 6.3: Cost, Latency, and Failure Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want to monitor cost, latency, and provider failures in a dashboard,
so that I can keep ThinkTank reliable and economically sustainable.

## Acceptance Criteria

1. Given provider metrics have been aggregated, when the operator opens the monitoring view, then they can see latency, error rate, timeout rate, estimated token usage, cache usage, and estimated cost, and metrics are grouped by workflow, Quick Consult, and Party Mode where available.
2. Given a metric exceeds its configured warning threshold, when the dashboard displays the metric, then the threshold breach is visually and textually identified, and the operator can see the affected tenant, workflow type, and time window where permissions allow.
3. Given telemetry data is delayed or unavailable, when the dashboard loads, then the view shows a data freshness or unavailable-state message, and it does not display misleading zeros as successful measurements.

## Tasks / Subtasks

- [x] Generate ATDD acceptance coverage before production implementation (AC: 1, 2, 3)
  - [x] Create Story 6.3 ATDD artifact under `_bmad-output/test-artifacts/`.
  - [x] Add RED frontend client/proxy/component tests for provider telemetry loading, grouping, threshold breach labeling, freshness/unavailable states, and raw-content suppression.
  - [x] Add RED Playwright coverage for the operations dashboard monitoring view.
- [x] Add frontend provider telemetry data access and proxy (AC: 1, 2, 3)
  - [x] Extend `frontend/lib/advisory/operations.ts` with typed provider telemetry filters, normalized dashboard view, and threshold breach helpers.
  - [x] Add `frontend/app/api/advisory/admin/operations/provider-telemetry/route.ts` mirroring the 6.1 usage proxy: auth token resolution, query allowlist, duplicate query rejection, `tenantId=current` sentinel suppression, upstream status propagation.
  - [x] Do not expose actor-level, raw row, prompt, conversation, report, feedback, cache-key, or provider raw payload fields in frontend state.
- [x] Extend the operations dashboard monitoring UI (AC: 1, 2, 3)
  - [x] Reuse `frontend/app/admin/advisory/operations/page.tsx` rather than creating a separate marketing-style page.
  - [x] Show latency average/P95, error rate, timeout rate, estimated tokens, estimated cost, cache hit/miss/bypass usage, and cache hit rate.
  - [x] Show grouped views for workflow, Quick Consult, Party Mode, and provider where the 6.2 aggregate endpoint provides safe metadata.
  - [x] Show threshold breaches with text and icon/badge, not color alone; include affected tenant, workflow/experience/provider, and selected time window.
  - [x] Preserve delayed/unavailable messaging and avoid zero-valued metric cards when `measurementStatus` or `freshness.status` is `unavailable`.
- [x] Validate privacy, permissions, and regression requirements (AC: 1, 2, 3)
  - [x] Confirm the dashboard consumes only `GET /advisory/admin/operations/provider-telemetry`; no frontend raw audit recomputation.
  - [x] Confirm tenant/date/workflow filters are shared with the existing operations dashboard where appropriate.
  - [x] Run focused Jest, Playwright E2E, TypeScript/build checks, and relevant regression suites before review.

## Dev Notes

### Source Requirements

- Epic 6 consumes prior Epic telemetry and audit events for operational monitoring. It must not add or backfill instrumentation; missing provider metrics must surface as instrumentation gaps with an owning area. [Source: `_bmad-output/planning-artifacts/epics.md#Epic 6: 运营监控与质量反馈闭环`]
- Story 6.3 owns the operator-facing cost/latency/failure dashboard. Story 6.2 already owns provider telemetry aggregation and exposes the aggregate read model. [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.2: Provider Telemetry Aggregation`; `_bmad-output/planning-artifacts/epics.md#Story 6.3: Cost, Latency, and Failure Dashboard`]
- PRD Journey 4 requires cost distribution, anomaly detection, failure/timeout visibility, and operational decisions about Party Mode and low-completion workflows. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md#Journey 4: 赵刚 — 平台运营的质量与成本监控`]
- Technical success targets include Quick Consult API cost under 2, full workflow API cost under 10, first-token latency P95 under 3 seconds, system availability above 99.5%, and API cost under 30% of revenue. Use these as threshold context; do not hardcode business billing behavior beyond dashboard warnings. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md#Technical Success`; `_bmad-output/planning-artifacts/thinktank-prd.md#Performance`]
- UX requires provider latency, failure, timeout, token, cache, estimated cost metrics, freshness/unavailable handling, textual chart summaries, and threshold breach indicators by text and icon, not color alone. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md#Operator Usage Dashboard`]

### Architecture Guardrails

- Frontend implementation belongs in the existing Next.js App Router operations surface:
  - `frontend/lib/advisory/operations.ts`
  - `frontend/app/api/advisory/admin/operations/provider-telemetry/route.ts`
  - `frontend/app/admin/advisory/operations/page.tsx`
  - tests beside those files plus the existing operations Playwright spec.
- Backend provider telemetry is already implemented under `backend/src/modules/advisory/operations/` and guarded by `GET /advisory/admin/operations/provider-telemetry`. Do not add tables, migrations, BullMQ jobs, external analytics sinks, or live GLM calls for this dashboard.
- The Next.js App Router route handler pattern is already used by the 6.1 usage proxy. Follow that structure and keep `cache: 'no-store'` for operational telemetry. [Source: `https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers`]
- NestJS controller/service separation from 6.2 remains the backend source of truth. If a backend gap is discovered, fix it in the existing controller/service with tests; do not move aggregation logic into frontend or controller glue. [Source: `https://docs.nestjs.com/controllers`]
- Use existing shadcn/ui, Tailwind, and `lucide-react` patterns. The page should stay dense and operational, consistent with Story 6.1, not a hero/marketing layout.

### Provider Telemetry Contract to Consume

- Endpoint: `GET /advisory/admin/operations/provider-telemetry`.
- Query filters: `tenantId`, `dateFrom`, `dateTo`, `workflowType`, optional `groupBy`.
- Guarding: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, `UserRole.ADMIN`.
- Response envelope: `{ data }`.
- Aggregate-only response fields:
  - `generatedAt`
  - `appliedFilters`
  - `summary`
  - `byWorkflow`
  - `byExperience`
  - `byProvider`
  - `cache`
  - `instrumentationGaps`
  - `freshness`
- Summary metrics available from 6.2:
  - `terminalCalls`, `successfulCalls`, `failedCalls`, `retryEvents`
  - `errorRate`, `timeoutRate`
  - `estimatedTokens`, `estimatedCost`
  - `latency.averageMs`, `latency.p95Ms`
  - `tokens.input`, `tokens.output`, `tokens.total`, `tokens.estimated`
  - `measurementStatus`
- Group rows include summary metrics plus `cacheHits`, `cacheMisses`, and `cacheBypasses`.
- Do not require `groupBy` for normal rendering; the backend returns all groups when `groupBy` is empty. Use `groupBy=workflow,experience,provider` only if explicitness improves tests/proxy behavior.

### Threshold Guidance

- Add a small local dashboard threshold config unless an existing central config is discovered:
  - average latency warning: `3000ms`
  - P95 latency warning: `5000ms`
  - error rate warning: `5%`
  - timeout rate warning: `2%`
  - cache hit rate warning: below `80%` when cache lookups exist
  - estimated cost per terminal call warning: Quick Consult `2`, workflow/Party Mode `10`, in the same unit emitted by telemetry
- Breach detection should be derived from normalized aggregate metrics only. It may calculate rates and per-call averages from group totals, but it must not fetch raw audit events.
- Breach text must name the metric, threshold, actual value, affected tenant, affected workflow/experience/provider, and selected time window where permissions allow.
- If a metric is `null`, `measurementStatus` is `unavailable`, or freshness is `unavailable`, render unavailable messaging instead of warning or healthy zero values.

### Previous Story Intelligence

- Story 6.1 established the operations page, filters, usage proxy, frontend normalization, freshness/unavailable UI, instrumentation gap messaging, raw-content suppression, and Playwright route mocking. Extend those files instead of creating a parallel dashboard shell. [Source: `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md`]
- Story 6.2 established provider telemetry aggregation, the backend API, strict query validation, tenant scoping, 90-day date window, invalid/repeated query rejection, HTTP 408 timeout handling, cache event/status mismatch gaps, and route-level negative-path coverage. Do not weaken those contracts. [Source: `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md`]
- 6.2 deliberately left dashboard UI, charts, proxy, and threshold breach visualization out of scope for 6.3. The dashboard must consume 6.2 aggregates and not duplicate backend aggregation logic in React.
- Prior commit pattern for Epic 6 uses story checkpoint commits:
  - `6f8d13f feat: complete story 6-1-usage-and-completion-dashboard`
  - `88e2237 feat: complete story 6-2-provider-telemetry-aggregation`

### Testing Requirements

- Follow TDD: create ATDD/RED coverage before production implementation.
- Required frontend client tests:
  - provider telemetry aggregate normalization;
  - threshold breach derivation and human-readable breach text;
  - unavailable/delayed freshness does not render misleading zeros;
  - raw sensitive fields are removed from normalized output;
  - `tenantId=current` is not forwarded as a backend tenant id.
- Required proxy route tests:
  - forwards only whitelisted filters to `/advisory/admin/operations/provider-telemetry`;
  - rejects duplicate whitelisted query params with `400`;
  - returns `401` without request/session token;
  - propagates upstream `403` and unavailable bodies without rewriting;
  - does not forward unsupported actor/raw filters.
- Required component tests:
  - renders provider monitoring metrics and groups;
  - marks threshold breaches with visible text and icon/badge;
  - shows affected tenant/workflow/time window;
  - shows delayed/unavailable provider telemetry states without zero cards;
  - raw private strings never appear in the page or drilldown/details.
- Required E2E coverage:
  - operations dashboard loads provider monitoring view from the proxy;
  - grouped workflow/Quick Consult/Party Mode metrics are visible;
  - breach indicators and freshness warnings are visible;
  - filters are included in provider telemetry requests;
  - unavailable provider telemetry does not show successful zero measurements.
- Suggested validation commands:
  - `npm --workspace frontend run test -- operations app/api/advisory/admin/operations/provider-telemetry/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand`
  - `npm --workspace frontend run test:e2e -- advisory-operations-dashboard.atdd.spec.ts --project=chromium`
  - `cd frontend; npx tsc --noEmit`
  - `npm --workspace backend run test -- advisory-provider-telemetry advisory-operations.controller.routes --runInBand` if backend is touched
  - `npm --workspace backend run build` if backend is touched

### Scope Boundaries

- In scope: frontend provider telemetry client/proxy, operations monitoring UI, threshold warning model, freshness/unavailable states, privacy-safe rendering, frontend unit/component/E2E coverage, and trace/gate artifacts.
- Out of scope: new backend storage, new telemetry event emission, provider gateway behavior changes, live GLM calls, billing/subscription enforcement, user-level anomaly detection, recommendation/report quality feedback aggregation, governance review UI, and raw audit drilldown.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 6.3: Cost, Latency, and Failure Dashboard`
- `_bmad-output/planning-artifacts/thinktank-prd.md#Journey 4: 赵刚 — 平台运营的质量与成本监控`
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md#Operator Usage Dashboard`
- `_bmad-output/planning-artifacts/architecture-thinktank.md#Complete Project Directory Structure`
- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md`
- `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md`
- `backend/src/modules/advisory/operations/advisory-provider-telemetry.types.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
- `frontend/lib/advisory/operations.ts`
- `frontend/app/api/advisory/admin/operations/usage/route.ts`
- `frontend/app/admin/advisory/operations/page.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-23: Story context created from Epic 6 Story 6.3, PRD Journey 4, UX operator dashboard requirements, Story 6.1 dashboard patterns, Story 6.2 provider telemetry aggregate contract, and current frontend/backend code.
- 2026-05-23: ATDD RED coverage generated for frontend client, Next proxy, operations dashboard component, and Playwright dashboard flows before production implementation.
- 2026-05-23: Implemented frontend provider telemetry normalization/proxy/dashboard UI and validated with focused Jest, Playwright E2E, TypeScript, and backend provider telemetry regression suites.
- 2026-05-23: Code review completed with Blind Hunter, Edge Case Hunter, and Acceptance Auditor layers. Patch findings were fixed before trace:
  - synchronized initial provider telemetry filters with usage-selected filters;
  - sanitized upstream error messages, provider group keys/labels, and instrumentation gap reasons;
  - suppressed delayed zero provider metrics;
  - rendered workflow type in threshold breach details;
  - rendered provider telemetry instrumentation gaps;
  - mocked provider telemetry in existing Story 6.1 E2E tests to avoid unmocked proxy dependency.
- 2026-05-23: Traceability matrix and deterministic quality gate completed. Gate decision: PASS with 3/3 P1 acceptance criteria fully covered and no critical/high coverage gaps.

### Completion Notes List

- Story context created and marked ready for development.
- Created ATDD checklist and turned Story 6.3 RED tests green for client, proxy, component, and E2E coverage.
- Added provider telemetry client normalization with threshold breach derivation, safe filter construction, unavailable-state handling, and raw sensitive text suppression.
- Added Next provider telemetry proxy with auth resolution, allowlisted query forwarding, duplicate filter rejection, `tenantId=current` suppression, and upstream status/body propagation.
- Extended the existing operations dashboard with provider metrics, workflow/experience/provider group table, textual/icon threshold warnings, freshness/unavailable messages, and shared filter refresh behavior.
- Code review fixes completed for privacy sanitization, delayed zero metrics, provider gap surfacing, threshold workflow-type visibility, and E2E mock stability.
- Traceability and quality gate artifacts completed; Story 6.3 approved to move from review to done.
- Validation passed:
  - `npm --workspace frontend run test -- operations app/api/advisory/admin/operations/provider-telemetry/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand`
  - `cd frontend; npx tsc --noEmit`
  - `npm --workspace frontend run test:e2e -- advisory-operations-dashboard.atdd.spec.ts --project=chromium`
  - `npm --workspace backend run test -- advisory-provider-telemetry advisory-operations.controller.routes --runInBand`
- Trace gate passed:
  - `_bmad-output/test-artifacts/traceability-report-story-6-3-cost-latency-and-failure-dashboard.md`
  - `_bmad-output/test-artifacts/gate-decision-story-6-3-cost-latency-and-failure-dashboard.yaml`
  - `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-3-cost-latency-and-failure-dashboard-2026-05-23T11-01-17+08-00.json`

### File List

- `_bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-6-3-cost-latency-and-failure-dashboard.md`
- `frontend/lib/advisory/operations.ts`
- `frontend/lib/advisory/operations.test.ts`
- `frontend/app/api/advisory/admin/operations/provider-telemetry/route.ts`
- `frontend/app/api/advisory/admin/operations/provider-telemetry/route.test.ts`
- `frontend/app/admin/advisory/operations/page.tsx`
- `frontend/app/admin/advisory/operations/page.test.tsx`
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- `_bmad-output/implementation-artifacts/review-story-6-3.diff`
- `_bmad-output/test-artifacts/traceability-report-story-6-3-cost-latency-and-failure-dashboard.md`
- `_bmad-output/test-artifacts/gate-decision-story-6-3-cost-latency-and-failure-dashboard.yaml`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-3-cost-latency-and-failure-dashboard-2026-05-23T11-01-17+08-00.json`

### Change Log

- 2026-05-23: Created Story 6.3 implementation context and marked ready for development.
- 2026-05-23: Added ATDD coverage and implemented the provider cost, latency, cache, failure, threshold breach, and freshness dashboard on the existing operations page.
- 2026-05-23: Addressed code review findings and reran frontend/backend focused validation.
- 2026-05-23: Completed traceability/gate with PASS and marked story done.

## Senior Developer Review (AI)

### Review Date

2026-05-23

### Review Outcome

Approve after fixes.

### Review Layers

- Blind Hunter: raised 1 Medium patch finding that provider telemetry instrumentation gaps were normalized but not rendered.
- Edge Case Hunter: raised 4 patch findings around initial filter consistency, raw error-message leakage, missing `measurementStatus` fallback, and unsanitized gap reasons.
- Acceptance Auditor: raised 3 patch findings around workflow type omission in threshold breach UI, raw-sensitive group identifiers, and delayed zero metrics.

### Action Items

- [x] [Medium] Render provider telemetry instrumentation gaps on the operations dashboard.
- [x] [Medium] Align initial provider telemetry request filters with the usage-selected tenant/date/workflow filters.
- [x] [Medium] Sanitize upstream provider telemetry error messages before rendering.
- [x] [Medium] Treat missing provider `measurementStatus` as the freshness status instead of defaulting to unavailable.
- [x] [Medium] Sanitize provider group keys/labels and instrumentation gap reasons before storing frontend state.
- [x] [Medium] Suppress delayed zero provider telemetry metrics rather than rendering successful zero cards.
- [x] [Medium] Include workflow type in threshold breach text/UI and tests.
- [x] [Low] Mock provider telemetry in existing operations E2E tests to keep Story 6.1 flows deterministic.
