# Story 6.5: Governance Review from Audit and Telemetry

Status: done

## Story

As a platform operator,
I want to review governance-relevant activity from prior events,
so that I can verify ThinkTank is operating within security and compliance expectations.

## Acceptance Criteria

1. Given audit events have been emitted for access, workflow, export, module configuration, and denied actions, when the operator opens the governance view, then they can filter and inspect event summaries by tenant, actor, event type, outcome, and date, and raw conversation content is excluded from the governance view by default.
2. Given AI-generated content labels and report metadata exist, when exported-output events are reviewed, then the system indicates whether AI labeling metadata was present, and missing labeling metadata is surfaced as a compliance issue.
3. Given governance data depends on events emitted by earlier epics, when an event type is missing, then the view shows an explicit instrumentation gap, and the gap can be traced to the owning feature area rather than silently ignored.
4. Given governance data depends on prior audit and telemetry events, when the governance view identifies a missing or malformed event, then the gap is mapped to the owning event name and feature story where possible, and raw conversation content remains excluded from governance views by default.

## Tasks / Subtasks

- [x] Create RED acceptance coverage for governance review (AC: 1, 2, 3, 4)
  - [x] Add backend service ATDD/spec coverage for tenant, actor, event type, outcome, date filtering, event summary aggregation, malformed event gaps, AI label compliance issues, source unavailable, and raw-content suppression.
  - [x] Add audit-log query coverage proving governance reads come from `audit_logs`, are row-tenant scoped, support `event_name`/`eventName` and `occurred_at`/`occurredAt`, and do not use unrelated persistence tables.
  - [x] Extend controller route coverage for `GET /advisory/admin/operations/governance`: guards, `tenantId=current`, foreign tenant rejection before service read, malformed filters, duplicate/invalid group filters, and unavailable body propagation.
  - [x] Add frontend client/proxy/page coverage for safe query forwarding, normalization, governance summary rendering, compliance issue display, instrumentation gaps, unavailable state, and privacy sentinels.
  - [x] Extend operations dashboard E2E mock to prove the governance section renders, filters are sent, compliance gaps are visible, and raw conversation/report/prompt/provider payload sentinels are never rendered.
- [x] Implement backend governance aggregation under the existing advisory operations boundary (AC: 1, 2, 3, 4)
  - [x] Add governance summary/read-model types in `backend/src/modules/advisory/operations/`.
  - [x] Add `AdvisoryGovernanceService` beside the existing operations services; follow the established `normalizeFilters -> query source -> normalizeRow -> aggregate -> freshness/gaps` pattern.
  - [x] Add `AuditLogService.findThinkTankGovernanceEvents(...)` using the existing TypeORM query-builder pattern over `audit_logs`.
  - [x] Consume existing ThinkTank event contract/registry names; do not add new event names unless a test proves a registered prior event cannot represent the requirement.
  - [x] Validate event contract fields: `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, `privacy_classification`.
  - [x] Treat wrong version, missing required fields, non-operational privacy classification, tenant mismatch, unknown event names, unsafe payload keys, and invalid dates as instrumentation gaps, not healthy zeroes.
  - [x] For `thinktank.output.exported`, report whether AI label metadata was present; missing metadata must produce a compliance issue.
  - [x] Return `generatedAt`, `appliedFilters`, `summary`, grouped event arrays, compliance issues, `instrumentationGaps`, and `freshness`.
  - [x] Treat audit source failures as `measurementStatus: unavailable`, null derived rates, empty grouped arrays, and an explicit `audit_logs` gap.
- [x] Add guarded backend operations API endpoint (AC: 1, 3, 4)
  - [x] Add `GET /advisory/admin/operations/governance` to `AdvisoryOperationsController`.
  - [x] Reuse `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, and `@Roles(UserRole.ADMIN)`.
  - [x] Reuse existing date-range validation, `tenantId=current`, and foreign-tenant rejection semantics.
  - [x] Support safe query filters: `tenantId`, `dateFrom`, `dateTo`, `workflowType`, `actorId`, `eventType`, `outcome`, and an allowlisted `groupBy`.
  - [x] Return the existing `{ data }` envelope shape.
- [x] Extend frontend operations data layer and proxy (AC: 1, 2, 3, 4)
  - [x] Add `fetchAdvisoryGovernanceReview` and normalized governance view types in `frontend/lib/advisory/operations.ts`.
  - [x] Add Next proxy route under `frontend/app/api/advisory/admin/operations/governance/route.ts`.
  - [x] Whitelist only safe query parameters and reject duplicate query parameters.
  - [x] Suppress `tenantId=current` before forwarding to backend.
  - [x] Forward auth and upstream status/body using the existing `cache: no-store` operations proxy pattern.
- [x] Extend the existing operations dashboard UI (AC: 1, 2, 3, 4)
  - [x] Add a governance review section to `frontend/app/admin/advisory/operations/page.tsx`; do not create a new landing page.
  - [x] Reuse the shared tenant/date/workflow filters and add compact controls for actor, event type, and outcome where practical.
  - [x] Show event summaries by event type/outcome/actor/workflow, exported-output AI label status, compliance issues, and instrumentation gaps.
  - [x] Preserve existing usage, provider telemetry, cost, and quality sections.
  - [x] Show delayed/unavailable states explicitly and never render unavailable data as successful zeroes.
- [x] Verification and documentation (AC: 1, 2, 3, 4)
  - [x] Run focused backend and frontend tests plus operations E2E coverage.
  - [x] Run backend and frontend TypeScript checks.
  - [x] Update this story file with implementation notes, file list, review results, and trace/gate artifacts.

## Dev Notes

### Source Requirements

- Story 6.5 belongs to Epic 6 operations monitoring and quality feedback. Epic 6 consumes prior audit and telemetry events; it must not go back and patch event emission in earlier stories. Missing events must be surfaced as instrumentation gaps and traced to the owning feature area. [Source: `_bmad-output/planning-artifacts/epics.md:414-422`]
- Story 1.4 defines the ThinkTank event contract and initial registry. Required fields are `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, and `privacy_classification`; raw sensitive conversation content is excluded by default. [Source: `_bmad-output/planning-artifacts/epics.md:516-551`]
- Story 6.5 requires governance review by tenant, actor, event type, outcome, and date; exported-output AI label evidence; explicit gaps for missing/malformed events; and no raw conversation content. [Source: `_bmad-output/planning-artifacts/epics.md:1508-1536`]
- FR33 requires explicit AI generated labels and metadata. FR48 requires full-chain audit logs. FR49 requires designated-region data processing. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md:637-664`]
- NFR9 requires auditability that conversation history is not used for model training. NFR10 requires `[AI Generated]` and JSON-LD metadata. NFR13 requires audit logs retained at least 180 days. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md:689-695`]
- Operations UX requires freshness/unavailable states, tenant/date/workflow filters, no raw conversation by default, textual summaries for tables/charts, and no misleading zero values when telemetry is missing. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md:1283-1339`]

### Existing Event and Data Sources to Reuse

- Event contract source of truth:
  - `backend/src/modules/advisory/events/thinktank-event-contract.ts`
  - `backend/src/modules/advisory/events/thinktank-event-registry.ts`
  - `THINKTANK_EVENT_VERSION = 1`
  - `assertNoRawSensitiveThinkTankKeys(...)`
- Governance-relevant audit events already registered:
  - `thinktank.access.opened`
  - `thinktank.access.denied`
  - `thinktank.module.enabled`
  - `thinktank.module.disabled`
  - `thinktank.role_access.updated`
  - `thinktank.workflow.started`
  - `thinktank.workflow.start_failed`
  - `thinktank.workflow.completed`
  - `thinktank.quick_consult.started`
  - `thinktank.quick_consult.completed`
  - `thinktank.quick_consult.failed`
  - `thinktank.output.exported`
  - `thinktank.session.deleted`
  - `thinktank.output.deleted`
- Audit source:
  - `backend/src/modules/audit/audit-log.service.ts`
  - Existing methods `findThinkTankUsageEvents(...)` and `findThinkTankProviderTelemetryEvents(...)` are the query-builder patterns to extend.
  - Keep authorization boundary on `audit_logs.tenant_id`; `details.tenant_id` is contract evidence and mismatch becomes a gap.
- AI label evidence:
  - Prefer metadata on `thinktank.output.exported`, especially fields equivalent to `ai_label_metadata_present`.
  - `backend/src/modules/advisory/outputs/advisory-output-export.service.ts` is the output export event source.
  - If output repository cross-checking is needed, never return `contentMarkdown`, `sections`, raw report content, prompt, conversation, or provider payload.

### Backend Implementation Guidance

- Put the new read model under `backend/src/modules/advisory/operations/`, alongside:
  - `advisory-operations.service.ts`
  - `advisory-provider-telemetry.service.ts`
  - `advisory-quality-feedback.service.ts`
  - `advisory-operations.controller.ts`
- Register any new service in `backend/src/modules/advisory/advisory.module.ts`.
- Match the existing operations response contract:
  - `generatedAt`
  - `appliedFilters`
  - `summary.measurementStatus`
  - grouped arrays
  - `complianceIssues`
  - `instrumentationGaps`
  - `freshness`
- Suggested safe grouping model:
  - `byEventType`: event name/category, count, success/failure/denied/blocked/partial counts, latest event, owning feature area.
  - `byOutcome`: outcome, count, latest event.
  - `byActor`: redacted or operational actor identifier, count, denied count, exported-output count; never include actor email, raw user profile, or free-text metadata.
  - `exportedOutputs`: output id or summary id, event time, workflow key if present, `aiLabelMetadataPresent`, compliance status.
- Suggested summary model:
  - `totalEvents`
  - `trustedEvents`
  - `malformedEvents`
  - `deniedActions`
  - `exportedOutputs`
  - `exportsMissingAiLabelMetadata`
  - `complianceIssueCount`
  - `measurementStatus: fresh | delayed | unavailable`
- Missing expected event families should become instrumentation gaps only when there is evidence the family is expected for the selected operational window. Do not fabricate a failure from an empty audit window unless another trusted source proves activity occurred.
- Use 48-hour stale threshold and 90-day max query window consistent with Stories 6.1-6.4.

### Tenant, Security, and Privacy Guardrails

- Tenant isolation uses `tenant_id + BaseRepository` or tenant-filtered service queries as the MVP source of truth. Do not treat PostgreSQL RLS as an MVP prerequisite. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:428-438`, `_bmad-output/planning-artifacts/architecture-thinktank.md:1097-1099`]
- Controller must reject foreign tenant access before invoking the service.
- Service must still validate `currentTenantId` or actor tenant and reject mismatches defensively.
- Audit query must filter by row `audit.tenantId`.
- Governance output must not contain raw conversation, prompt, message, report content, feedback text, provider raw payload, cache key, or full user profile.
- Use the existing raw-sensitive event key assertion and frontend sanitizer patterns; extend them rather than bypassing them.
- If diagnostic values are unsafe, replace with a safe generic value such as `unregistered_thinktank_event` or `redacted`.

### Frontend Implementation Guidance

- Extend the existing operations admin surface:
  - `frontend/lib/advisory/operations.ts`
  - `frontend/app/api/advisory/admin/operations/governance/route.ts`
  - `frontend/app/admin/advisory/operations/page.tsx`
  - `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- Follow the existing client pattern: `fetchXxx -> unwrapAdvisoryEnvelope -> normalizeXxx -> UI-safe view model`.
- Follow the existing proxy pattern: `dynamic = 'force-dynamic'`, `getServerSession(authOptions)`, auth header forwarding, `cache: 'no-store'`, duplicate query rejection, allowlisted query forwarding, and upstream body/status pass-through.
- The page should remain a dense operational dashboard: compact metric cards, tables, alerts, badges, and dialogs are appropriate; do not add a marketing/landing page.
- All status and threshold states need visible text, not color alone.
- `unavailable` must show a destructive/explicit alert and hide metrics/group rows that would otherwise imply trusted zeroes.

### Previous Story Intelligence

- Story 6.1 established the usage dashboard pattern: guarded operations endpoint, audit-derived aggregation, freshness/unavailable handling, Next proxy whitelist, frontend normalization, operations page sectioning, and E2E privacy sentinels.
- Story 6.2 established provider telemetry aggregation: deterministic grouping, privacy-unsafe event rejection, malformed event gaps, wrong-version handling, and no live provider dependency in tests.
- Story 6.3 extended the operations dashboard for cost/latency/failure: threshold warnings, shared filters, `Promise.allSettled` loading, proxy duplicate-query rejection, and no misleading zeroes when telemetry is unavailable.
- Story 6.4 extended quality feedback: direct reuse of existing persistence, quality trend summaries, feedback text withholding, service/query failure unavailable contract, code-review fixes for tenant fallback, auth precedence, malformed metadata gaps, and E2E unavailable alignment.
- Recent commits confirm Epic 6 stories are checkpointed one story at a time: `6f8d13f`, `88e2237`, `50528e4`, `252867f`.

### Testing Requirements

- Backend focused tests:
  - governance aggregation by tenant, actor, event type, outcome, workflow, and date range
  - exported-output AI label metadata present/missing compliance issues
  - malformed, wrong-version, missing-field, tenant-mismatch, privacy-unsafe, and unknown event gaps
  - source unavailable returns unavailable freshness and no trusted zeroes
  - raw-sensitive fields are not returned
  - foreign tenant is rejected before service reads
- Audit query tests:
  - filters by `audit_logs.tenant_id`
  - supports snake/camel event and occurred-at fields
  - falls back to `createdAt` for candidate window matching
  - orders deterministically
- Frontend focused tests:
  - `frontend/lib/advisory/operations.test.ts` governance normalizer, query shape, unavailable state, and privacy sanitization
  - Next proxy tests for whitelist, duplicate rejection, `tenantId=current`, auth forwarding, and upstream status propagation
  - operations page tests for governance summary, compliance issues, gaps, and no raw sentinel strings
- E2E:
  - Extend `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`.
  - Verify tenant/date/workflow filters plus actor/event/outcome filters where implemented.
  - Verify governance section renders with event summaries, compliance issues, gaps, and unavailable state.
  - Verify raw sentinels such as `PRIVATE_CONVERSATION_DO_NOT_RENDER`, `raw prompt`, `report content`, `provider payload`, and `cache key` are absent.

### Suggested Commands

- Backend:
  - `npm --workspace backend test -- advisory-governance.atdd.spec.ts audit-log-governance.atdd.spec.ts advisory-operations.controller.routes.spec.ts --runInBand`
  - `npm --workspace backend exec -- npx tsc --noEmit`
- Frontend:
  - `npm --workspace frontend test -- lib/advisory/operations.test.ts app/api/advisory/admin/operations/governance/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand`
  - `npm --workspace frontend exec -- npx tsc --noEmit`
  - `npm --workspace frontend exec -- npx playwright test e2e/advisory-operations-dashboard.atdd.spec.ts --project=chromium`

### Latest Technical Information

- No dependency upgrade is required for this story. Use the repository's locked NestJS, TypeORM, Next.js, React, Jest, Testing Library, and Playwright versions.
- Do not introduce new charting, date, validation, or table libraries. Existing language/platform APIs and local helpers are sufficient.

## Project Structure Notes

- ThinkTank backend code stays inside the existing `advisory` module boundary. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:981-1015`]
- Story 6.5 is the Advisory/ThinkTank governance review story. Do not reuse the unrelated KG taxonomy story file `_bmad-output/implementation-artifacts/6-5-domain-rollout-policy-dual-path-precedence-gate-control-plane.md`.
- Keep API query parameters camelCase and database columns snake_case.
- Keep `_bmad-output` artifacts synchronized after ATDD, implementation, review, and trace.

## References

- `_bmad-output/planning-artifacts/epics.md:414-422` - Epic 6 objectives, dependencies, and instrumentation-gap boundary.
- `_bmad-output/planning-artifacts/epics.md:516-551` - Story 1.4 event contract and registry foundation.
- `_bmad-output/planning-artifacts/epics.md:1508-1536` - Story 6.5 user story and acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md:637-664` - FR33, FR48, FR49.
- `_bmad-output/planning-artifacts/thinktank-prd.md:689-695` - NFR9, NFR10, NFR13.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md:1283-1339` - Admin/Ops dashboard UX, privacy, freshness, and no-misleading-zero behavior.
- `_bmad-output/planning-artifacts/architecture-thinktank.md:428-438` - tenant filtering and BaseRepository isolation.
- `_bmad-output/planning-artifacts/architecture-thinktank.md:981-1015` - advisory module organization.
- `_bmad-output/planning-artifacts/architecture-thinktank.md:1097-1099` - MVP tenant isolation source of truth.
- `_bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md` - usage operations dashboard pattern.
- `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md` - provider aggregation and malformed event gap pattern.
- `_bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md` - shared filters, thresholds, proxy, and unavailable behavior.
- `_bmad-output/implementation-artifacts/6-4-feedback-and-output-quality-analysis.md` - quality feedback aggregation, review fixes, and trace/gate pattern.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-23: Backend focused ATDD passed: `npm --workspace backend test -- advisory-governance.atdd.spec.ts audit-log-governance.atdd.spec.ts advisory-operations-governance.controller.atdd.spec.ts --runInBand` (13 tests).
- 2026-05-23: Frontend focused ATDD passed: `npm --workspace frontend test -- lib/advisory/operations-governance.atdd.spec.ts app/api/advisory/admin/operations/governance/route.atdd.spec.ts app/admin/advisory/operations/page-governance.atdd.spec.tsx --runInBand` (6 tests).
- 2026-05-23: Existing operations page unit regression passed after adding governance fetch mock: `npm --workspace frontend test -- app/admin/advisory/operations/page.test.tsx app/admin/advisory/operations/page-governance.atdd.spec.tsx --runInBand` (17 tests).
- 2026-05-23: TypeScript checks passed: `npm --workspace backend exec -- npx tsc --noEmit`; `npm --workspace frontend exec -- npx tsc --noEmit`.
- 2026-05-23: Operations dashboard E2E passed: `npm --workspace frontend exec -- npx playwright test e2e/advisory-operations-dashboard.atdd.spec.ts --project=chromium` (17 tests).
- 2026-05-23: Code review completed in two iterations; all HIGH/MEDIUM findings were fixed and focused backend/frontend tests plus TypeScript checks passed after fixes.
- 2026-05-23: Trace/gate passed: `_bmad-output/test-artifacts/traceability-report-story-6-5-governance-review-from-audit-and-telemetry.md` (Gate Decision: PASS; P0/P1/overall coverage 100%).
- 2026-05-23: Full workspace Jest first run found an unrelated flaky `frontend/app/admin/failure-modes/page.test.tsx` failure; isolated rerun passed: `npm --workspace frontend test -- app/admin/failure-modes/page.test.tsx --runInBand` (15 tests).
- 2026-05-23: Full workspace Jest regression passed on rerun: `npm test --workspaces -- --runInBand` (backend: 338 suites passed, 2951 tests passed; frontend: 185 suites passed, 1582 tests passed).

### Completion Notes List

- 2026-05-23: Story context created from Epic 6.5, Story 1.4 event contract, PRD governance requirements, operations UX guidance, architecture tenant isolation guidance, previous Epic 6 story learnings, and current code patterns.
- 2026-05-23: Implemented audit-log-derived governance aggregation with tenant row boundary, event contract validation, AI label compliance issue reporting, explicit instrumentation gaps, and unavailable source handling.
- 2026-05-23: Added guarded backend `GET /advisory/admin/operations/governance` endpoint and registered `AdvisoryGovernanceService` in the advisory module.
- 2026-05-23: Extended operations frontend data layer, Next proxy, and dashboard UI with governance metrics, grouped summaries, exported-output AI label evidence, compliance issues, instrumentation gaps, and actor/event/outcome filters.
- 2026-05-23: Preserved privacy guardrails by suppressing raw conversation, prompt, message, report content, feedback text, provider payload, cache key, and full-profile sentinels in backend and frontend outputs.
- 2026-05-24: Completed review fixes, traceability gate, full workspace regression, and moved Story 6.5 to done.

### Change Log

- 2026-05-23: Created Story 6.5 governance review implementation context and marked story ready for dev.
- 2026-05-23: Completed Story 6.5 governance review implementation and moved story to review.
- 2026-05-24: Completed code-review fixes, trace/gate PASS, full workspace regression, and moved story to done.

### File List

- `_bmad-output/implementation-artifacts/6-5-governance-review-from-audit-and-telemetry.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/traceability-report-story-6-5-governance-review-from-audit-and-telemetry.md`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-6-5-governance-review-from-audit-and-telemetry-2026-05-23T21-57-26+08-00.json`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/operations/advisory-governance.atdd.spec.ts`
- `backend/src/modules/advisory/events/thinktank-governance-events.ts`
- `backend/src/modules/advisory/operations/advisory-governance.service.ts`
- `backend/src/modules/advisory/operations/advisory-governance.types.ts`
- `backend/src/modules/advisory/operations/advisory-operations-governance.controller.atdd.spec.ts`
- `backend/src/modules/advisory/operations/advisory-operations.controller.ts`
- `backend/src/modules/audit/audit-log-governance.atdd.spec.ts`
- `backend/src/modules/audit/audit-log.service.ts`
- `frontend/app/admin/advisory/operations/page-governance.atdd.spec.tsx`
- `frontend/app/admin/advisory/operations/page.test.tsx`
- `frontend/app/admin/advisory/operations/page.tsx`
- `frontend/app/api/advisory/admin/operations/governance/route.atdd.spec.ts`
- `frontend/app/api/advisory/admin/operations/governance/route.ts`
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
- `frontend/lib/advisory/operations-governance.atdd.spec.ts`
- `frontend/lib/advisory/operations.ts`
