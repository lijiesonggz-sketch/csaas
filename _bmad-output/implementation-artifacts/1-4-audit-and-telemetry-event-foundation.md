# Story 1.4: Audit and Telemetry Event Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want critical ThinkTank actions to emit consistent audit and telemetry events,
so that security, compliance, and future operations views can rely on trustworthy data.

## Acceptance Criteria

1. Given a user opens, starts, completes, exports, configures, rates, deletes, or is denied access to ThinkTank, when the action occurs, then the system emits a structured event using the versioned ThinkTank event contract with required fields: `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, and `privacy_classification`; optional fields are used where applicable: `session_id`, `output_id`, `workflow_type`, `provider`, `latency_ms`, `estimated_tokens`, `estimated_cost`, `cache_status`, and `error_category`; raw sensitive conversation content is excluded unless explicitly required and classified.
2. Given an advisory backend story introduces a new user-visible workflow action, when that action is implemented, then it uses the shared event contract from this story and tests verify both success and failure event emission.
3. Given a feature story emits audit or telemetry events, when its implementation begins, then the story lists the event names it owns from the ThinkTank event registry and tests verify success/failure emissions include tenant scoping, correlation id, version, outcome, privacy classification, and no raw conversation content by default.
4. Given audit logs are retained, when logs are stored, then retention defaults to at least 180 days for audit records and production storage respects data-localization requirements.

## Tasks / Subtasks

- [x] Establish the shared ThinkTank event contract and registry (AC: 1, 2, 3)
  - [x] Review existing audit primitives before adding new abstractions: `backend/src/modules/audit/audit-log.service.ts`, `backend/src/database/entities/audit-log.entity.ts`, `backend/src/common/interceptors/audit.interceptor.ts`, and current advisory access/admin event calls.
  - [x] Add a ThinkTank-owned event contract module under `backend/src/modules/advisory/events/` or the nearest existing advisory shared location.
  - [x] Define typed enums/consts for event names, event kind (`audit` / `telemetry`), event version, subject type, outcome, privacy classification, cache status, and error category where needed.
  - [x] Encode the initial registry exactly: Audit events `thinktank.access.opened`, `thinktank.access.denied`, `thinktank.module.enabled`, `thinktank.module.disabled`, `thinktank.role_access.updated`, `thinktank.workflow.started`, `thinktank.workflow.start_failed`, `thinktank.workflow.completed`, `thinktank.quick_consult.started`, `thinktank.quick_consult.completed`, `thinktank.quick_consult.failed`, `thinktank.output.exported`, `thinktank.session.deleted`, `thinktank.output.deleted`; Telemetry events `thinktank.provider.call_completed`, `thinktank.provider.call_failed`, `thinktank.provider.call_retried`, `thinktank.prompt_cache.hit`, `thinktank.prompt_cache.miss`, `thinktank.recommendation.feedback_submitted`, `thinktank.output.rating_submitted`, `thinktank.output.favorite_updated`, `thinktank.context_compression.executed`, `thinktank.context_compression.deferred`, `thinktank.party_mode.budget_exceeded`, `thinktank.party_mode.advisor_failed`.
  - [x] Provide validation/normalization helpers that reject unknown event names, missing required fields, invalid event kind/name pairing, and raw sensitive payload keys by default.

- [x] Add an advisory event emitter that reuses the existing audit log pipeline (AC: 1, 4)
  - [x] Introduce a narrow service such as `AdvisoryEventService` that accepts typed ThinkTank event input, normalizes it to contract fields, and persists audit-class events through `AuditLogService`.
  - [x] Keep existing `audit_logs` storage unless a codebase constraint proves a separate telemetry store already exists and should be reused; do not create future workflow/session/output tables in this story.
  - [x] Store canonical snake_case contract fields in `AuditLog.details` while preserving existing entity columns (`tenantId`, `userId`, `entityType`, `entityId`, `action`) for query compatibility.
  - [x] Map contract fields to legacy summary compatibility where needed, but new ThinkTank tests must assert canonical names such as `event_name`, `event_version`, `tenant_id`, `actor_id`, `occurred_at`, and `privacy_classification`.
  - [x] Implement a correlation-id policy: accept an explicit correlation id from guarded callers/request context when present; otherwise generate a UUID per emitted event.
  - [x] Keep audit writes fail-safe for access/opened/denied events but strict for module configuration changes that already call `logStrict`, unless business behavior requires otherwise.

- [x] Retrofit current Epic 1 ThinkTank events to the shared contract (AC: 1, 2, 3)
  - [x] Update `AdvisoryAccessService.recordAccessOpened()` to emit `thinktank.access.opened` through the shared contract.
  - [x] Update `AdvisoryAccessService.recordAccessDenied()` to emit `thinktank.access.denied` through the shared contract.
  - [x] Update `AdvisoryAdminService.logConfigChange()` to emit `thinktank.module.enabled`, `thinktank.module.disabled`, and `thinktank.role_access.updated` through the shared contract.
  - [x] Preserve Story 1.1/1.2 behavior: access decisions, disabled-module messaging, latest audit summary, tenant scoping, role validation, and admin config update behavior must not regress.
  - [x] Do not emit runtime events for workflows, Quick Consult, outputs, ratings, deletion, provider calls, prompt cache, context compression, or Party Mode until the owning first-use stories implement those actions.

- [x] Define retention and data-localization evidence for audit/telemetry storage (AC: 4)
  - [x] Add a single exported constant/config default for ThinkTank audit retention that is at least 180 days; prefer aligning with existing `AuditLogService.archiveOldLogs(365)` rather than reducing retention.
  - [x] If `archiveOldLogs()` remains the cleanup path, add tests proving retention lower than 180 days is rejected or normalized upward for ThinkTank audit cleanup.
  - [x] Document in code/story evidence that production audit storage uses the existing CSAAS regional PostgreSQL deployment; do not introduce cross-region sinks or external analytics calls in this story.
  - [x] Ensure telemetry-class registry entries can be validated even if their runtime persistence is first used by later stories.

- [x] Add contract, privacy, and regression tests (AC: 1-4)
  - [x] Add RED tests before implementation for event contract validation, registry ownership, required fields, correlation id generation/passthrough, privacy classification, optional fields, and unknown-event rejection.
  - [x] Update advisory access/admin service tests to assert canonical contract fields, version, tenant id, actor id, subject type/id, outcome, correlation id, privacy classification, and absence of raw sensitive keys.
  - [x] Add tests proving current event payloads do not include raw conversation/report/enterprise context/prompt/message/content fields by default.
  - [x] Add tests proving retention defaults satisfy NFR13 (`>= 180` days) and do not weaken existing 365-day audit behavior.
  - [x] Confirm existing Story 1.2/1.3 focused tests still pass after refactor.

- [x] Automated verification (AC: 1-4)
  - [x] Run focused backend tests for advisory events, advisory access/admin, audit log, and entity parity where affected.
  - [x] Run `cd backend && npm run orm:entities:parity`.
  - [x] Run `cd backend && npx tsc --noEmit`.
  - [x] Run broader backend regression where feasible; document unrelated existing failures exactly.
  - [x] Frontend tests are not expected unless frontend behavior changes; document this if no frontend code changes.

## Dev Notes

### Source Requirements

- Epic 1 owns ThinkTank's security and governance foundation: access, module enablement, tenant isolation, auditability, provider gateway boundaries, and minimal telemetry hooks. Story 1.4 owns the shared audit/telemetry event contract and registry. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.4]
- FR48 requires full-chain audit logs for critical ThinkTank operations such as workflow start, completion, and output access. FR49 requires data storage and processing in the designated region. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR48/FR49]
- NFR9 requires API-call auditability to prove conversation history is not used for model training; event payloads must not copy raw conversation content by default. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR9]
- NFR10 requires AI-generated output labeling and metadata in later output stories; this story only defines event support for later governance checks and must not claim output-label implementation. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR10; `_bmad-output/planning-artifacts/epics.md` - Story 6.5]
- NFR13 requires critical audit logs and retention of at least 180 days. Existing `AuditLogService.archiveOldLogs()` defaults to 365 days; preserve or formalize that stronger retention for ThinkTank audit cleanup. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR13; `backend/src/modules/audit/audit-log.service.ts`]

### Scope Boundaries

This is an event foundation story, not an operations dashboard or runtime feature story.

Do not implement these runtime actions here:

| Event family | Owning future story |
| --- | --- |
| `thinktank.workflow.started`, `thinktank.workflow.start_failed`, `thinktank.workflow.completed` | Story 2.5 and later workflow stories |
| `thinktank.quick_consult.started`, `thinktank.quick_consult.completed`, `thinktank.quick_consult.failed`, `thinktank.recommendation.feedback_submitted` | Epic 3 stories |
| `thinktank.output.exported`, `thinktank.output.rating_submitted`, `thinktank.output.favorite_updated`, `thinktank.output.deleted` | Epic 2/4 output stories |
| `thinktank.provider.call_completed`, `thinktank.provider.call_failed`, `thinktank.provider.call_retried` | Story 1.5 provider gateway |
| `thinktank.prompt_cache.hit`, `thinktank.prompt_cache.miss` | Story 2.10 |
| `thinktank.context_compression.executed`, `thinktank.context_compression.deferred` | Story 4.6 |
| `thinktank.party_mode.budget_exceeded`, `thinktank.party_mode.advisor_failed` | Story 5.5 |

This story should make those names available in the registry and validation layer, then retrofit only the current Epic 1 events already emitted by Story 1.1/1.2.

### Previous Story Intelligence

- Story 1.1 introduced the ThinkTank navigation/access path and emits access opened/denied audit-like records through `AdvisoryAccessService`.
- Story 1.2 introduced tenant module config, role binding, strict module configuration audit writes, latest audit summary, and tests for `thinktank.module.enabled`, `thinktank.module.disabled`, and `thinktank.role_access.updated`.
- Story 1.3 hardened tenant isolation through `BaseRepository`, introduced `AdvisoryModuleConfigRepository`, and moved `AdvisoryAdminService` data access behind a tenant-scoped repository wrapper.
- Current access/admin tests assert `details.eventName` camelCase. Story 1.4 must migrate tests to canonical snake_case contract fields while preserving any compatibility reads needed by `findRecentByEventNames()` and latest audit summaries.
- Full backend regression had unrelated existing taxonomy-domain-gate failures after Story 1.3; do not mask or "fix" those unless directly affected by this story.

### Existing Patterns To Reuse

- Audit persistence: `backend/src/modules/audit/audit-log.service.ts`, `backend/src/database/entities/audit-log.entity.ts`, `backend/src/modules/audit/audit.module.ts`.
- Current ThinkTank event emitters: `backend/src/modules/advisory/access/advisory-access.service.ts`, `backend/src/modules/advisory/admin/advisory-admin.service.ts`.
- Existing access/admin tests: `backend/src/modules/advisory/access/advisory-access.service.spec.ts`, `backend/src/modules/advisory/access/advisory-access.controller.spec.ts`, `backend/src/modules/advisory/admin/advisory-admin.service.spec.ts`.
- Tenant and actor context: `TenantGuard`, `@CurrentTenant()`, existing user objects with `id`, `tenantId`, `organizationId`, and CSAAS `UserRole`.
- Repository/tenant hardening from Story 1.3 remains in place; do not bypass it when touching module config behavior.

### Backend Implementation Guidance

- Prefer a small contract layer over broad schema churn:
  - `backend/src/modules/advisory/events/thinktank-event-contract.ts`
  - `backend/src/modules/advisory/events/thinktank-event-registry.ts`
  - `backend/src/modules/advisory/events/advisory-event.service.ts`
  - colocated `*.spec.ts`
- Use `crypto.randomUUID()` from Node for generated correlation ids unless the repo already exposes a request-correlation helper during implementation review.
- Suggested canonical payload shape in `AuditLog.details`:
  - `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, `privacy_classification`
  - optional: `session_id`, `output_id`, `workflow_type`, `provider`, `latency_ms`, `estimated_tokens`, `estimated_cost`, `cache_status`, `error_category`
  - operational metadata may be included only if it is structured and non-raw, such as `module`, `changed_setting`, `old_value`, `new_value`, or `reason`.
- Outcome values should be explicit and stable, for example `success`, `failure`, `denied`, `blocked`, `partial`, or a narrower enum if implementation chooses one. Tests must cover both success and failure/denied paths for current emitters.
- Privacy classifications should be explicit. Use a small enum such as `operational`, `personal_data`, `sensitive_business`, `restricted` if no project enum exists; current Epic 1 events should default to `operational`.
- Raw sensitive keys to reject/exclude by default include at least `conversation`, `message`, `messages`, `prompt`, `content`, `rawContent`, `report`, `document`, `enterpriseContext`, and `attachments`.
- `AuditLog.entityId` is nullable and typed UUID. For non-entity access events keep it `null`; put the contract `subject_id` in details when the subject has no UUID, such as `thinktank` module access.
- `AuditLogService.findRecentByEventNames()` currently filters `details ->> 'eventName'`. Update it to support canonical `event_name` without breaking historical rows.
- `AdvisoryAdminService.toAuditSummary()` should read canonical snake_case details first, then fall back to the previous camelCase keys if needed.

### Security / Compliance Guidance

- Tenant id must come from guarded backend context or service scope, never from event payload supplied by the frontend.
- Actor id must be the authenticated CSAAS user id. If future system actors are needed, they must be explicit and tested; do not infer them from untrusted payloads.
- Correlation id is required on every event so future governance/ops views can trace a request without storing raw user content.
- Data-localization acceptance should be evidenced by reusing existing PostgreSQL audit storage and not adding external telemetry/export sinks. If environment variables for region/storage are found, document them; otherwise record the assumption as inherited CSAAS deployment configuration.
- Event contract validation must fail closed for unknown event names and missing required fields so future stories cannot silently create malformed instrumentation.

### Testing Requirements

- Follow TDD: add failing tests before implementation.
- Focused backend commands:
  - `cd backend && npm run test -- advisory-event advisory-access advisory-admin audit-log --runInBand`
  - `cd backend && npm run orm:entities:parity`
  - `cd backend && npx tsc --noEmit`
- Broader regression command:
  - `cd backend && npm test -- --runInBand`
- Do not mark tasks complete unless tests exist and pass, or an unrelated existing failure is documented with exact suite/test names.

### Latest Technical Notes

- No web/package research or dependency upgrade is required. Use the repo-locked NestJS/TypeORM/Jest stack and Node standard library.
- TypeORM JSONB queries against `details` already exist in `findRecentByEventNames()`; preserve PostgreSQL compatibility and avoid ad hoc string parsing for stored events.

### Project Structure Notes

- Keep ThinkTank-specific event contract code inside `backend/src/modules/advisory/` rather than modifying unrelated modules broadly.
- Keep shared audit persistence unchanged unless necessary for retention/config; avoid migration/schema churn unless implementation finds a real blocker.
- Keep tests colocated with source files as `*.spec.ts`, matching backend convention.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.4 acceptance criteria and initial event registry.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR48, FR49, NFR9, NFR10, NFR13.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - module boundaries, audit/governance, TypeScript/NestJS/TypeORM testing patterns.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - tenant isolation and first-use entity ownership boundaries.
- `_bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md` - previous story implementation notes and known regression status.
- `backend/src/modules/audit/audit-log.service.ts` - existing audit persistence and retention cleanup.
- `backend/src/database/entities/audit-log.entity.ts` - current audit storage columns and indexes.
- `backend/src/modules/advisory/access/advisory-access.service.ts` - current access opened/denied emitters.
- `backend/src/modules/advisory/admin/advisory-admin.service.ts` - current module config audit emitters and latest audit summary.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 1 Story 1.4, PRD FR48/FR49 and NFR9/NFR10/NFR13, architecture audit/governance constraints, existing audit persistence, and previous Story 1.3 tenant-isolation work.
- 2026-05-19: ATDD RED artifacts generated for contract, registry, privacy guard, advisory event emitter, current access/admin event retrofit, and audit retention coverage; E2E marked not applicable because this story adds backend event infrastructure only.
- 2026-05-19: Story implementation started; sprint/story status updated to in-progress.
- 2026-05-19: Confirmed RED with focused Jest: missing event contract/registry/emitter/retention modules failed before implementation.
- 2026-05-19: Focused backend verification passed: `npm run test -- advisory-event thinktank-event thinktank-audit-retention advisory-access advisory-admin audit-log --runInBand` (11 suites, 57 tests).
- 2026-05-19: Static/ORM checks passed: `npx tsc --noEmit`; `npm run orm:entities:parity` (1 suite, 3 tests).
- 2026-05-19: Code review found and fixed metadata reserved-field override risk; added subject-type enum coverage and regression test.
- 2026-05-19: Full backend regression run completed after review fix with unrelated existing taxonomy-domain-gate failures only: `[P0][6.5-AUTO-003]`, `[P0][6.5-AUTO-007]`, `[8.2-SVC-003][P1]`.
- 2026-05-19: Traceability matrix generated with 100% AC coverage and PASS gate decision; sprint/story status updated to done.

### Implementation Plan

- Add a narrow ThinkTank event contract, registry, and advisory event service.
- Retrofit current access and module-config events through the contract.
- Formalize retention/data-localization evidence without introducing future runtime tables or dashboard behavior.
- Add focused contract/privacy/regression tests before implementation.

### Completion Notes List

- Added ThinkTank event registry and versioned event contract normalization with required snake_case fields, generated/passthrough correlation ids, optional telemetry metadata normalization, kind/name validation, unknown event rejection, and raw sensitive key blocking by default.
- Added `AdvisoryEventService` as the narrow emitter over existing `AuditLogService`, preserving fail-safe access events and strict module configuration writes while keeping the existing `audit_logs` table unchanged.
- Retrofitted current Epic 1 runtime events only: `thinktank.access.opened`, `thinktank.access.denied`, `thinktank.module.enabled`, `thinktank.module.disabled`, and `thinktank.role_access.updated`.
- Added ThinkTank audit retention helper/default at 365 days with a hard lower bound of 180 days; cleanup continues through existing PostgreSQL audit storage and introduces no cross-region or external telemetry sink.
- Updated audit summary/query compatibility to read canonical `event_name`/snake_case fields first while preserving legacy `eventName` rows.
- Hardened event metadata so callers cannot override reserved canonical contract fields such as `tenant_id`, `actor_id`, `event_name`, or `privacy_classification`.
- Frontend/E2E tests were not added because this story changes backend event infrastructure only and introduces no UI flow.

### File List

- `_bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md`
- `_bmad-output/test-artifacts/atdd-checklist-1-4.md`
- `_bmad-output/test-artifacts/atdd-story-1-4-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-4-fixtures.ts`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-4-2026-05-19T04-18-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-4-2026-05-19T04-18-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-4-2026-05-19T04-18-00+08-00.json`
- `_bmad-output/test-artifacts/code-review-story-1-4.md`
- `_bmad-output/test-artifacts/gate-decision-story-1-4.yaml`
- `_bmad-output/test-artifacts/traceability-report-story-1-4.md`
- `_bmad-output/test-artifacts/traceability-report.md`
- `_bmad-output/test-artifacts/traceability-story-1-4-phase1.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/access/advisory-access.controller.spec.ts`
- `backend/src/modules/advisory/access/advisory-access.service.ts`
- `backend/src/modules/advisory/access/advisory-access.service.spec.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.spec.ts`
- `backend/src/modules/advisory/events/advisory-event.service.ts`
- `backend/src/modules/advisory/events/advisory-event.service.spec.ts`
- `backend/src/modules/advisory/events/thinktank-audit-retention.ts`
- `backend/src/modules/advisory/events/thinktank-audit-retention.spec.ts`
- `backend/src/modules/advisory/events/thinktank-event-contract.ts`
- `backend/src/modules/advisory/events/thinktank-event-contract.spec.ts`
- `backend/src/modules/advisory/events/thinktank-event-registry.ts`
- `backend/src/modules/advisory/events/thinktank-event-registry.spec.ts`
- `backend/src/modules/audit/audit-log.service.ts`
- `backend/src/modules/audit/audit-log.service.spec.ts`

## Change Log

- 2026-05-19: Story context created for audit and telemetry event foundation.
- 2026-05-19: Generated Story 1.4 ATDD RED coverage artifacts.
- 2026-05-19: Implemented ThinkTank event contract/registry/emitter, retrofitted current access/admin audit events, added retention guardrails, and completed backend verification.
- 2026-05-19: Completed code review remediation, traceability PASS gate, and story pipeline post-processing.
