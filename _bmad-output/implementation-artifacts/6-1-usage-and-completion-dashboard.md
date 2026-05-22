# Story 6.1: Usage and Completion Dashboard

Status: done

## Story

As a platform operator,
I want to see ThinkTank usage and completion metrics,
so that I can understand adoption and workflow health.

## Acceptance Criteria

1. Given workflow and consult events have been emitted by prior epics, when the operator opens the ThinkTank operations dashboard, then they see usage by workflow type, Quick Consult volume, structured workflow starts, completions, and incomplete sessions, and metrics can be filtered by tenant and date range according to operator permissions.
2. Given workflow and consult metrics are derived from prior events, when the dashboard computes usage or completion, then it uses the Story 1.4 versioned event contract and known event names, and unknown or malformed events are treated as instrumentation gaps rather than valid zero counts.
3. Given a workflow has low completion, when the operator reviews the dashboard, then the dashboard identifies the workflow and trend period, and the operator can drill into aggregated counts without seeing raw private conversation content.
4. Given telemetry data is delayed or unavailable, when the dashboard loads, then the UI shows a clear data freshness or unavailable state, and it does not display misleading zeros as successful measurements.

## Tasks / Subtasks

- [x] Create backend usage aggregation contract and tests (AC: 1, 2, 3, 4)
  - [x] Add ATDD coverage for versioned event filtering, malformed event gaps, tenant/date filters, low-completion detection, and freshness state.
  - [x] Add a focused operations service under `backend/src/modules/advisory/operations/` that consumes existing `audit_logs` rows rather than adding new instrumentation.
  - [x] Reuse `ThinkTankEventName`, `THINKTANK_EVENT_VERSION`, and `AuditLog` instead of redefining event names or reading raw conversation messages.
- [x] Expose operator API endpoint (AC: 1, 4)
  - [x] Add `GET /advisory/admin/operations/usage` guarded by `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, and `UserRole.ADMIN`.
  - [x] Support query parameters `tenantId`, `dateFrom`, and `dateTo`; default to the current tenant and a recent operational window when not supplied.
  - [x] Return `{ data }` in the existing ThinkTank API envelope style.
- [x] Add frontend data access and dashboard UI (AC: 1, 3, 4)
  - [x] Add a Next.js route handler proxy under `frontend/app/api/advisory/admin/operations/usage/route.ts`.
  - [x] Add `frontend/lib/advisory/operations.ts` with typed fetch helpers and no raw-content fields.
  - [x] Add `frontend/app/admin/advisory/operations/page.tsx` using existing shadcn/ui patterns, dense admin layout, filter controls, metric summaries, workflow table, aggregated drilldown, instrumentation gap messaging, and data freshness/unavailable states.
- [x] Validate privacy and regression requirements (AC: 1, 2, 3, 4)
  - [x] Ensure no raw conversation, prompt, report content, or feedback text is returned by the usage endpoint.
  - [x] Run backend unit/ATDD tests, frontend component/lib tests, TypeScript checks, and relevant regression tests before marking complete.

## Dev Notes

### Source Requirements

- Epic 6 exists to consume prior Epic events and create an operational quality loop. It must not backfill or invent missing instrumentation; missing event types must be surfaced as instrumentation gaps with the owning feature area. [Source: `_bmad-output/planning-artifacts/epics.md#Epic 6: 运营监控与质量反馈闭环`]
- Story 6.1 requires usage by workflow type, Quick Consult volume, structured workflow starts/completions, incomplete sessions, tenant/date filtering, low-completion drilldown, and clear delayed/unavailable data states. [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.1: Usage and Completion Dashboard`]
- Operator UX requires Quick Consult volume, workflow starts/completions, completion rate by workflow, Party Mode usage, freshness/unavailable handling, tenant/date/workflow filters, and privacy-first aggregated views. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md#Operator Usage Dashboard`]
- PRD Journey 4 frames the operator problem as usage, completion, quality, and cost monitoring; this story owns only usage/completion, leaving provider cost/latency to later stories. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md#Journey 4`]

### Architecture Guardrails

- Backend code belongs in the existing ThinkTank module, currently under `backend/src/modules/advisory/`, and should be registered from `AdvisoryModule`. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md#Complete Project Directory Structure`]
- Use existing NestJS controller/service/provider style and module registration. NestJS official guidance keeps controllers responsible for routing requests to providers; do not put aggregation logic in the controller. [Source: `https://docs.nestjs.com/controllers`]
- Use NestJS testing utilities and mocked repositories/services for deterministic unit tests. [Source: `https://docs.nestjs.com/fundamentals/testing`]
- Frontend code uses the Next.js App Router already present in `frontend/app`. Route handlers are the correct App Router location for server-side proxy endpoints. [Source: `https://nextjs.org/docs/14/app`]
- Existing admin pages use shadcn/ui components and `lucide-react`; match `frontend/app/admin/advisory/page.tsx` styling density and avoid marketing-style layout.
- If charts are used, `recharts` is already installed; make chart containers stable because `ResponsiveContainer` depends on parent dimensions. [Source: `https://recharts.github.io/en-US/api/ResponsiveContainer/`]

### Event Contract and Privacy

- Consume only registered Story 1.4 event names from `backend/src/modules/advisory/events/thinktank-event-registry.ts` and `ThinkTankEventName` enum:
  - `thinktank.workflow.started`
  - `thinktank.workflow.start_failed`
  - `thinktank.workflow.completed`
  - `thinktank.quick_consult.started`
  - `thinktank.quick_consult.completed`
  - `thinktank.quick_consult.failed`
  - `thinktank.party_mode.budget_exceeded`
  - `thinktank.party_mode.advisor_failed`
- `audit_logs.details` is the source of normalized ThinkTank event data. Required fields include `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, and `privacy_classification`.
- `THINKTANK_EVENT_VERSION` is currently `1`; unversioned or wrong-version rows are instrumentation gaps.
- `assertNoRawSensitiveThinkTankKeys` rejects raw sensitive keys during event creation. The operations endpoint must preserve that privacy boundary and return only counts, rates, trend windows, event names, and aggregate workflow labels.
- Treat malformed rows as data quality gaps. Do not coerce them into zero-count successful measurements.

### Implementation Shape

- Recommended backend files:
  - `backend/src/modules/advisory/operations/advisory-operations.types.ts`
  - `backend/src/modules/advisory/operations/advisory-operations.service.ts`
  - `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
  - `backend/src/modules/advisory/operations/advisory-operations.service.spec.ts`
  - `backend/src/modules/advisory/operations/advisory-operations.usage.atdd.spec.ts`
- Recommended frontend files:
  - `frontend/lib/advisory/operations.ts`
  - `frontend/lib/advisory/operations.test.ts`
  - `frontend/app/api/advisory/admin/operations/usage/route.ts`
  - `frontend/app/api/advisory/admin/operations/usage/route.test.ts`
  - `frontend/app/admin/advisory/operations/page.tsx`
  - `frontend/app/admin/advisory/operations/page.test.tsx`
- Avoid adding database tables for this story. The event source already exists in `audit_logs`; later stories may add derived provider metric contracts if needed.
- Date filters should use event `occurred_at` when valid and fall back to `createdAt` only for gap reporting, not for successful measurement.
- Completion rate should be `completed / started` for each workflow key. If starts are zero but completion events exist, surface a gap instead of producing a misleading rate.
- Low-completion threshold can be conservative and local to the service for now, e.g. `< 50%` with at least one start, unless config already exists.

### Previous Story Intelligence

- Story 5.5 completed Party Mode resource/failure controls and registered telemetry for budget exceeded and advisor failures. Story 6.1 should count those as operational context only; detailed provider failure/cost handling belongs to Stories 6.2 and 6.3.
- Recent Epic 5 commits used the current BMAD checkpoint pattern and should not be rewritten. Continue local story commits after each completed story.

### Testing Requirements

- Backend tests must cover:
  - known versioned events are counted;
  - unknown event names become gaps;
  - missing/wrong `event_version` becomes gaps;
  - tenant and date filters scope results;
  - raw sensitive fields are not returned;
  - delayed/unavailable source returns freshness status rather than zero-only data.
- Frontend tests must cover:
  - loading, error/unavailable, and data freshness states;
  - tenant/date filter rendering;
  - usage metrics and low-completion workflow table;
  - instrumentation gap messaging;
  - no raw conversation content rendered.
- Run at least:
  - `npm --workspace backend run test -- advisory-operations`
  - `npm --workspace frontend run test -- operations`
  - `npm --workspace backend run build`
  - `npm --workspace frontend run build` or targeted `npx tsc --noEmit` if build is too broad but TypeScript changed.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm --workspace backend run test -- advisory-operations --runInBand` - passed, 4 suites / 15 tests.
- `npm --workspace frontend run test -- operations --runInBand` - passed, 3 suites / 8 tests.
- `npm --workspace backend run build` - passed.
- `npx tsc --noEmit` from `frontend/` - passed. `npm --workspace frontend run build` was blocked by the repository clean guard because an existing Next dev server was already running on localhost:3001.
- `npm --workspace backend run test -- --runInBand` - passed, 328 suites / 2876 tests.
- `npm --workspace frontend run test -- --runInBand` - passed, 180 suites / 1535 tests.
- `npm --workspace frontend run test:e2e -- advisory-operations-dashboard.atdd.spec.ts --project=chromium` - passed, 6 Playwright tests.
- `npm --workspace backend run test -- advisory-operations.controller.routes --runInBand` - passed, 1 suite / 7 tests.
- `npm --workspace backend run test -- advisory-operations --runInBand` - passed, 5 suites / 28 tests.
- `npm --workspace frontend run test -- app/api/advisory/admin/operations/usage/route.test.ts --runInBand` - passed, 1 suite / 4 tests.
- `npm --workspace frontend run test -- operations app/api/advisory/admin/operations/usage/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand` - passed, 3 suites / 11 tests.
- `npm --workspace backend run test -- --runInBand` - passed after trace hardening, 331 suites / 2898 tests.
- `npm --workspace frontend run test -- --runInBand` - passed after trace hardening, 180 suites / 1538 tests.

### Completion Notes List

- Story context created from Epic 6 planning, ThinkTank architecture, PRD Journey 4, UX operator dashboard guidance, and Story 1.4 event contract.
- Implemented a privacy-safe advisory operations backend service that aggregates known Story 1.4 ThinkTank usage events from `audit_logs`, reports malformed/unknown rows as instrumentation gaps, identifies low-completion workflows, and surfaces delayed/unavailable freshness states without trusted zero-only metrics.
- Added the guarded `GET /advisory/admin/operations/usage` API and a whitelisted Next.js proxy route that does not trust client actor scope.
- Added a dense shadcn/ui operations dashboard with tenant/date/workflow filters, usage metrics, workflow completion table, aggregate drilldown, instrumentation gap messaging, freshness warnings, unavailable state, and raw-content suppression in normalization/rendering.
- Updated one stale existing Party Mode test assertion from `返回工作流` to `返回原工作流`, matching the existing production UI and adjacent tests.
- Completed `bmad-testarch-trace` with a PASS gate: AC1-AC4 are fully covered, P0 coverage is 100%, P1 coverage is 100%, and no endpoint/auth/error-path trace gaps remain.
- Hardened trace gaps by adding route-level tests for `tenantId=current`, foreign tenant denial, malformed/inverted date windows, API response raw-content suppression, unavailable freshness pass-through, and frontend proxy upstream 403 propagation.

### File List

- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/atdd-checklist-6-1.md`
- `_bmad-output/implementation-artifacts/tests/tea-atdd-api-tests-2026-05-22T16-12-12.json`
- `_bmad-output/implementation-artifacts/tests/tea-atdd-e2e-tests-2026-05-22T16-12-12.json`
- `_bmad-output/implementation-artifacts/tests/tea-atdd-summary-2026-05-22T16-12-12.json`
- `_bmad-output/implementation-artifacts/tests/tea-trace-coverage-matrix-2026-05-22T17-22-31+08-00.json`
- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard-trace.md`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
- `backend/src/modules/advisory/operations/advisory-operations.service.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.service.ts`
- `backend/src/modules/advisory/operations/advisory-operations.types.ts`
- `backend/src/modules/advisory/operations/advisory-operations.usage.atdd.spec.ts`
- `backend/src/modules/audit/audit-log.service.ts`
- `frontend/app/admin/advisory/operations/page.test.tsx`
- `frontend/app/admin/advisory/operations/page.tsx`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/admin/operations/usage/route.test.ts`
- `frontend/app/api/advisory/admin/operations/usage/route.ts`
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- `frontend/lib/advisory/operations.test.ts`
- `frontend/lib/advisory/operations.ts`
- `tests/api/advisory-operations-usage.spec.ts`
- `tests/fixtures/advisory-operations-usage-test-data.ts`

### Change Log

- 2026-05-22: Implemented Story 6.1 usage/completion dashboard backend, API, frontend dashboard, ATDD/unit/component/E2E coverage, and regression validation.
- 2026-05-22: Completed trace gate hardening and marked Story 6.1 done.
