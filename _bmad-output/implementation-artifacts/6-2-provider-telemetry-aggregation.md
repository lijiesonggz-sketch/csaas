# Story 6.2: Provider Telemetry Aggregation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want provider telemetry to be aggregated into reliable operational metrics,
so that downstream dashboards can report cost, latency, and failures without recomputing raw events.

## Acceptance Criteria

1. Given AI provider calls emit telemetry, when aggregation jobs or queries process the events, then latency, error rate, timeout rate, estimated token usage, cache usage, and estimated cost are computed deterministically, and metrics are grouped by workflow, Quick Consult, and Party Mode where available.
2. Given provider telemetry is aggregated, when raw events are processed, then the aggregator accepts only versioned provider/cache telemetry events from the Story 1.4 registry, and malformed, unversioned, or privacy-unsafe events are rejected with traceable instrumentation errors.
3. Given provider telemetry is generated from fake providers in automated tests, when aggregation tests run, then expected cost, latency, cache, and failure summaries are computed deterministically, and no test requires live GLM calls.

## Tasks / Subtasks

- [x] Generate ATDD acceptance coverage before production implementation (AC: 1, 2, 3)
  - [x] Create Story 6.2 ATDD artifact under `_bmad-output/test-artifacts/`.
  - [x] Add backend RED acceptance tests for deterministic provider/cache aggregation, version filtering, malformed/privacy-unsafe gap reporting, grouping, and fake telemetry fixtures.
  - [x] Explicitly document that E2E/browser tests are not required in 6.2 unless a user-visible route is added; no live GLM/network test is allowed.

- [x] Create backend provider telemetry aggregation contract and read-model (AC: 1, 2)
  - [x] Add typed provider telemetry aggregation contracts under `backend/src/modules/advisory/operations/`.
  - [x] Aggregate only these registered Story 1.4 telemetry events: `thinktank.provider.call_completed`, `thinktank.provider.call_failed`, `thinktank.provider.call_retried`, `thinktank.prompt_cache.hit`, and `thinktank.prompt_cache.miss`.
  - [x] Compute call totals, success/failure/retry counts, error rate, timeout rate, latency average/P95, estimated tokens, input/output/total token totals, estimated cost, cache hit/miss/bypass counts, and cache hit rate.
  - [x] Group metrics by workflow, Quick Consult, and Party Mode when safe metadata is present; missing grouping metadata must be reported as an instrumentation gap instead of silently inferred.
  - [x] Count provider call cost/tokens from provider call events only; use prompt-cache events for cache usage, not for duplicate cost/token totals.

- [x] Reuse `audit_logs` as the telemetry source (AC: 1, 2)
  - [x] Extend `AuditLogService` with a focused provider telemetry query method similar to `findThinkTankUsageEvents`.
  - [x] Scope by `audit_logs.tenantId`, date window, and registered telemetry event names; do not trust `details.tenant_id` over the row-level tenant.
  - [x] Use `occurred_at` for successful measurements and `createdAt` only for candidate windowing/gap diagnosis.
  - [x] Do not add a new provider telemetry table, migration, BullMQ job, external analytics sink, or generic AI usage log dependency.

- [x] Add an operator-safe backend query endpoint if needed by downstream dashboards (AC: 1, 2)
  - [x] Prefer extending `AdvisoryOperationsController` with `GET /advisory/admin/operations/provider-telemetry`.
  - [x] Guard the endpoint with `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, and `UserRole.ADMIN`, matching Story 6.1 operations route behavior.
  - [x] Support `tenantId`, `dateFrom`, `dateTo`, `workflowType`, and optional grouping filters without exposing actor-level or raw event details.
  - [x] Return `{ data }` with aggregate-only fields, freshness, and instrumentation gaps; leave charts/dashboard UI to Story 6.3.

- [x] Reject malformed, unversioned, wrong-version, unknown, and privacy-unsafe events traceably (AC: 2)
  - [x] Reuse `THINKTANK_EVENT_VERSION`, `ThinkTankEventName`, `getThinkTankEventKind`, and `assertNoRawSensitiveThinkTankKeys`.
  - [x] Treat missing `event_name`, missing/wrong `event_version`, invalid `occurred_at`, future dates, non-operational privacy classification, missing required fields, unknown event names, and raw sensitive keys as `instrumentationGaps`.
  - [x] Do not include raw prompt, message, conversation, report, document, enterprise context, feedback text, cache key detail beyond safe hashed identifiers, or provider raw payloads in the response.

- [x] Validate with focused and regression tests before review (AC: 1, 2, 3)
  - [x] Service tests cover deterministic fake telemetry aggregation, grouping, latency/cost/token/cache math, retry/failure/timeout semantics, gap reporting, freshness/unavailable states, tenant/date filtering, and privacy suppression.
  - [x] Controller/route tests cover `tenantId=current`, foreign tenant denial, date validation, source unavailable pass-through, and aggregate-only response shape if the endpoint is added.
  - [x] Run focused backend tests for advisory operations/provider telemetry/events/audit, backend TypeScript/build checks, and relevant regression suites.

## Dev Notes

### Source Requirements

- Epic 6 consumes prior Epic telemetry and audit events to create an operational monitoring and feedback loop. It must not invent or backfill missing instrumentation; gaps must be surfaced with an owning feature area. [Source: `_bmad-output/planning-artifacts/epics.md#Epic 6: 运营监控与质量反馈闭环`]
- Story 6.2 owns provider telemetry aggregation only. Story 6.3 owns the operator-facing cost/latency/failure dashboard, threshold warnings, and visual presentation. [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.2: Provider Telemetry Aggregation`; `_bmad-output/planning-artifacts/epics.md#Story 6.3: Cost, Latency, and Failure Dashboard`]
- PRD Journey 4 requires cost monitoring, cost distribution by Party Mode and Quick Consult, failure/timeout visibility, and operational decision support. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md#Journey 4`]
- UX requires provider latency, failure, timeout, token, cache, estimated cost metrics, freshness state, and no misleading zeroes when telemetry is delayed or missing. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md#Operator Usage Dashboard`]

### Architecture Guardrails

- Keep implementation in the existing ThinkTank advisory module under `backend/src/modules/advisory/operations/`, registered from `AdvisoryModule`. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md#Complete Project Directory Structure`]
- Use the existing NestJS service/controller pattern. Controller code should authorize, normalize query inputs, and call a service; aggregation logic belongs in a service.
- Use PostgreSQL `audit_logs` via `AuditLogService`; do not introduce new storage or cross-region telemetry export for this story.
- Tenant isolation must use the guarded tenant/current tenant and `audit_logs.tenantId`. Treat `details.tenant_id` as contract evidence only, not an authorization boundary.
- No package upgrade or new dependency is required. Use repo-locked NestJS, TypeORM, Jest, and TypeScript.

### Event Contract and Telemetry Source

- Story 1.4 event contract is canonical. Required fields include `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, and `privacy_classification`. [Source: `backend/src/modules/advisory/events/thinktank-event-contract.ts`]
- `THINKTANK_EVENT_VERSION` is currently `1`; unversioned or wrong-version events are instrumentation gaps, not valid zero counts.
- Accept only these provider/cache telemetry events:
  - `thinktank.provider.call_completed`
  - `thinktank.provider.call_failed`
  - `thinktank.provider.call_retried`
  - `thinktank.prompt_cache.hit`
  - `thinktank.prompt_cache.miss`
- Provider call events contain safe call metrics such as `provider`, `latency_ms`, `estimated_tokens`, `estimated_cost`, `error_category`, `input_tokens`, `output_tokens`, `total_tokens`, `retry_attempt`, `max_attempts`, `retryable`, and `error_code`. [Source: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`]
- Prompt-cache events contain safe cache metrics such as `cache_status`, `cache_strategy`, `cache_key` hash, `cache_bypass_reason`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `cached_input_tokens`, and `cache_eligible_input_tokens`. [Source: `backend/src/modules/advisory/provider-gateway/thinktank-prompt-cache-policy.ts`; `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts`]

### Aggregation Rules

- Terminal call counts:
  - `provider.call_completed` counts as a successful provider call.
  - `provider.call_failed` counts as a failed provider call; timeout rate is the share where `error_category` or status indicates timeout.
  - `provider.call_retried` counts as retry activity, not as a terminal failure.
- Cost and token totals must come from provider call events to avoid double-counting with prompt-cache events.
- Cache usage must come from prompt-cache hit/miss events and safe cache status fields. A provider completed event with `cache_status` may enrich grouping but must not duplicate cache event counts when a prompt-cache event exists for the same provider call/correlation.
- Latency metrics should be deterministic and stable: average and P95 are enough for 6.2; use sorted finite non-negative `latency_ms` values and round consistently.
- Grouping priority:
  - Workflow: `workflow_type` or safe metadata `workflow_key`.
  - Quick Consult: explicit `subject_type=quick_consult`, event metadata, or safe workflow key that already identifies Quick Consult; do not infer from raw text.
  - Party Mode: explicit safe metadata such as `party_mode_message`, `party_mode_integration`, or Party Mode workflow key; do not infer from persona text or message content.
- Missing grouping metadata should create an instrumentation gap with an owner such as `provider_gateway`, `quick_consult_telemetry`, or `party_mode_telemetry`.
- Freshness and unavailable behavior should follow Story 6.1: delayed telemetry shows `freshness.status = delayed`; source failures return `unavailable` with a gap instead of trusted zero-only metrics.

### Implementation Shape

- Recommended backend files:
  - `backend/src/modules/advisory/operations/advisory-provider-telemetry.types.ts`
  - `backend/src/modules/advisory/operations/advisory-provider-telemetry.service.ts`
  - `backend/src/modules/advisory/operations/advisory-provider-telemetry.service.spec.ts`
  - `backend/src/modules/advisory/operations/advisory-provider-telemetry.atdd.spec.ts`
  - update `backend/src/modules/advisory/operations/advisory-operations.controller.ts` if an API route is added
  - update `backend/src/modules/audit/audit-log.service.ts`
  - update `backend/src/modules/advisory/advisory.module.ts`
- Response contract should be aggregate-only and dashboard-ready:
  - `generatedAt`
  - `appliedFilters`
  - `summary`
  - `byWorkflow`
  - `byExperience` for Quick Consult / Party Mode / unknown
  - `byProvider`
  - `cache`
  - `instrumentationGaps`
  - `freshness`
- Keep raw event rows, actor identifiers, raw metadata, and prompt/cache raw payloads out of the response.

### Previous Story Intelligence

- Story 6.1 established the operations aggregation pattern: `normalizeFilters -> query audit_logs -> normalizeRow -> aggregateRows -> freshness/gaps`. Reuse this shape rather than moving aggregation into the controller. [Source: `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md`]
- Story 6.1 added `AdvisoryOperationsService`, `AdvisoryOperationsController`, `findThinkTankUsageEvents`, tenant/date validation, `tenantId=current`, forbidden foreign tenant handling, raw-content suppression, and trace coverage. Extend these patterns.
- Story 1.5 established provider gateway telemetry and deterministic fake provider behavior. Do not call GLM or instantiate provider SDKs in Story 6.2 tests. [Source: `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md`]
- Story 2.10 established prompt-cache hit/miss telemetry and cache metadata. Use those events to calculate cache usage, but avoid double-counting cost/tokens. [Source: `_bmad-output/implementation-artifacts/2-10-prompt-caching-and-cost-aware-workflow-calls.md`]
- Recent code-review/trace hardening from Story 6.1 specifically added route tests for foreign tenant denial, date validation, source unavailable pass-through, proxy 403 propagation, and raw-content suppression; carry the same backend route discipline into 6.2 if an endpoint is added.

### Testing Requirements

- Follow TDD: ATDD/RED tests first, then production implementation.
- Required backend coverage:
  - deterministic aggregation from fake provider/cache telemetry fixtures;
  - completed/failed/retried event semantics, including retries not being terminal failures;
  - timeout rate based on timeout error category/status;
  - token/cost totals from provider calls only;
  - cache hit/miss/bypass usage from prompt-cache events;
  - workflow, Quick Consult, Party Mode, provider grouping where safe metadata exists;
  - missing grouping metadata, malformed rows, unknown names, missing/wrong version, invalid dates, and raw sensitive keys reported as instrumentation gaps;
  - tenant/date scoping and no cross-tenant leakage;
  - source unavailable/freshness behavior.
- Suggested focused commands:
  - `npm --workspace backend run test -- advisory-provider-telemetry advisory-operations advisory-event thinktank-event audit-log --runInBand`
  - `npm --workspace backend run build`
  - `npm --workspace backend run test -- --runInBand`
- Frontend and Playwright E2E are not required for 6.2 unless a frontend route/UI is changed. Story 6.3 will own dashboard UI and browser coverage.

### Scope Boundaries

- In scope: backend read-model/service, audit query method, aggregate contract, optional backend API endpoint, ATDD/unit/controller tests, traceability artifact.
- Out of scope: 6.3 dashboard UI/charts/proxy, threshold breach visualization, live GLM calls, provider gateway behavior changes, new telemetry events, new persistence tables, backfill jobs, external analytics, quality feedback/rating aggregation, governance review UI.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 6.2: Provider Telemetry Aggregation`
- `_bmad-output/planning-artifacts/epics.md#Story 6.3: Cost, Latency, and Failure Dashboard`
- `_bmad-output/planning-artifacts/thinktank-prd.md#Journey 4`
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md#Operator Usage Dashboard`
- `_bmad-output/planning-artifacts/architecture-thinktank.md#Complete Project Directory Structure`
- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md`
- `_bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md`
- `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md`
- `_bmad-output/implementation-artifacts/2-10-prompt-caching-and-cost-aware-workflow-calls.md`
- `backend/src/modules/advisory/events/thinktank-event-contract.ts`
- `backend/src/modules/advisory/events/thinktank-event-registry.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
- `backend/src/modules/advisory/operations/advisory-operations.service.ts`
- `backend/src/modules/audit/audit-log.service.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: Story context created from Epic 6 Story 6.2, ThinkTank PRD Journey 4, UX operator dashboard requirements, architecture module boundaries, Story 1.4 event contract, Story 1.5 provider telemetry, Story 2.10 prompt-cache telemetry, and Story 6.1 operations aggregation patterns.
- 2026-05-22: ATDD RED coverage created and validated with 3 skipped backend suites / 11 skipped tests.
- 2026-05-22: Implemented provider telemetry contracts/service, audit log source query, admin operations endpoint, and route/ATDD coverage. Validation commands passed:
  - `npm --workspace backend run test -- advisory-provider-telemetry audit-log-provider-telemetry operations-provider-telemetry --runInBand`
  - `npm --workspace backend run test -- advisory-provider-telemetry audit-log-provider-telemetry operations-provider-telemetry advisory-operations.controller.routes --runInBand`
  - `npm --workspace backend run test -- advisory-operations advisory-event thinktank-event audit-log --runInBand`
  - `npm --workspace backend run build`
  - `npm --workspace backend run test -- --runInBand`
- 2026-05-22: Code review completed with three review layers. Acceptance Auditor passed; Blind Hunter and Edge Case Hunter findings were triaged as patch items and fixed before trace:
  - sanitized malformed `event_version` diagnostics and unsafe provider/workflow values before response emission;
  - enforced service-level tenant scope and `details.tenant_id` consistency;
  - rejected invalid/repeated query values and invalid date-only values with `400`;
  - capped provider telemetry date windows at 90 days;
  - counted HTTP 408/timeout-like provider failures in `timeoutRate`;
  - rejected inconsistent prompt-cache event/cache-status telemetry as instrumentation gaps;
  - rejected invalid `groupBy` values and added provider-only grouping regression coverage.
- 2026-05-22: Trace workflow completed with PASS gate after adding route-level provider telemetry negative-path coverage:
  - anonymous provider telemetry requests return `401`;
  - role-denied provider telemetry requests return `403`;
  - foreign tenant provider telemetry filters return `403`;
  - malformed, repeated, inverted, oversized, and invalid `groupBy` filters return `400`;
  - unavailable audit-log source is surfaced as aggregate-only unavailable freshness.

### Completion Notes List

- Story context created.
- ATDD RED coverage completed before production implementation.
- Added `AdvisoryProviderTelemetryService` and typed aggregate-only response contract for provider/cost/latency/cache telemetry.
- Extended `AuditLogService` with `findThinkTankProviderTelemetryEvents()` using `audit_logs` row tenant/date/event filtering only; no new storage or queue was added.
- Added `GET /advisory/admin/operations/provider-telemetry` with admin guards, `tenantId=current`, date validation, groupBy parsing, and raw payload suppression.
- Converted the 11 Story 6.2 ATDD specs to active green tests, added focused review-regression coverage, and added a real HTTP route regression for aggregate-only provider telemetry.
- Completed traceability and quality gate with PASS: P0 coverage 3/3, overall coverage 100%, no critical/high/medium/low gaps.

### File List

- `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-6-2-provider-telemetry-aggregation.md`
- `backend/src/modules/advisory/operations/advisory-provider-telemetry.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations-provider-telemetry.controller.atdd.spec.ts`
- `backend/src/modules/audit/audit-log-provider-telemetry.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-provider-telemetry.types.ts`
- `backend/src/modules/advisory/operations/advisory-provider-telemetry.service.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.routes.spec.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/audit/audit-log.service.ts`
- `_bmad-output/implementation-artifacts/review-story-6-2.diff`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-2-provider-telemetry-aggregation-2026-05-22T18-45-00+08-00.json`
- `_bmad-output/test-artifacts/traceability-story-6-2-provider-telemetry-aggregation-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-6-2-provider-telemetry-aggregation.md`
- `_bmad-output/test-artifacts/gate-decision-story-6-2-provider-telemetry-aggregation.yaml`

### Change Log

- 2026-05-22: Created Story 6.2 implementation context and marked ready for development.
- 2026-05-22: Added and validated Story 6.2 ATDD RED tests.
- 2026-05-22: Implemented provider telemetry aggregation backend and marked story ready for review.
- 2026-05-22: Completed code-review fix pass for all High/Medium findings; focused, regression, build, and full backend Jest pass.
- 2026-05-22: Completed trace/gate workflow, added provider telemetry route negative-path tests, and marked story done.

## Senior Developer Review (AI)

### Review Date

2026-05-22

### Review Outcome

Approve after fixes.

### Review Layers

- Blind Hunter: raised 7 High/Medium patch findings around diagnostic raw-value leakage, unbounded query windows, service-level tenant scope, tenant-id mismatch, unsafe provider/workflow values, invalid `groupBy`, and repeated query values.
- Edge Case Hunter: raised 1 blocking/P0 and 4 P1/P2 patch findings around malformed telemetry raw-value leakage, strict date/query parsing, HTTP 408 timeout accounting, invalid `groupBy`, and cache event/cache-status mismatch.
- Acceptance Auditor: PASS, no blocking AC/spec gaps.

### Action Items

- [x] [High] Prevent malformed `event_version` / provider / workflow values from leaking raw payload content.
- [x] [High] Cap provider telemetry query windows at 90 days before reading audit rows.
- [x] [Medium] Enforce service-level tenant scope and reject event `tenant_id` mismatch.
- [x] [Medium] Reject invalid/repeated query parameters and invalid date-only values with `BadRequestException`.
- [x] [Medium] Count HTTP 408 / timeout-like provider failures in `timeoutRate`.
- [x] [Medium] Reject inconsistent prompt-cache event/cache-status telemetry as an instrumentation gap.
- [x] [Low] Add `groupBy=['provider']` regression coverage.
