# Story 1.3: Tenant Isolation Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant security owner,
I want ThinkTank data access to be automatically scoped to my tenant,
so that one tenant cannot access another tenant's sessions, outputs, context, or telemetry.

## Acceptance Criteria

1. Given a request enters the advisory backend with tenant and user context, when advisory repositories read or write tenant-scoped records, then `tenantId` is automatically applied through the shared BaseRepository pattern and repository APIs do not allow callers to mutate `tenantId`.
2. Given tenant-scoped advisory records exist for the data surfaces introduced by this epic, when tenant A queries or mutates those records, then only tenant A records are returned or changed and automated tests prove cross-tenant reads, updates, and deletes are rejected for each data surface introduced in this epic.
3. Given Story 1.3 establishes the shared tenant isolation contract, when later first-use stories introduce tenant-scoped entities, then those later stories own entity-specific cross-tenant isolation tests and Story 1.3 completion is not blocked by entities that have not yet been introduced.
4. Given advisory data moves between browser, backend, cache, and database, when production security configuration is applied, then data in transit uses TLS 1.2+ requirements inherited from CSAAS infrastructure and persisted sensitive advisory data follows the configured AES-256-at-rest encryption policy.
5. Given the PRD mentions RLS and architecture selects `tenant_id + BaseRepository`, when this story is completed, then the MVP implementation decision is documented in story evidence and any future RLS upgrade is marked as post-MVP rather than an implicit blocker.

## Tasks / Subtasks

- [x] Harden the shared tenant repository contract (AC: 1, 2, 5)
  - [x] Review `backend/src/database/repositories/base.repository.ts` and existing tenant repository helpers before adding any new abstraction.
  - [x] Reuse or harden the existing `BaseRepository<T extends TenantEntity>` instead of creating a duplicate ThinkTank-only base class.
  - [x] Ensure create/save paths always overwrite caller-supplied `tenantId` with the current tenant scope.
  - [x] Ensure update paths strip or ignore caller-supplied `tenantId` so an entity cannot be moved across tenants.
  - [x] Ensure delete/update operations always include tenant ownership in their criteria and report no cross-tenant mutation when the scoped row is not found.
  - [x] Support TypeORM `where` arrays without losing tenant filtering.

- [x] Bring the advisory module config data surface under the shared contract (AC: 1, 2)
  - [x] Treat `advisory_module_configs` from Story 1.2 as the only tenant-scoped advisory table currently introduced by Epic 1.
  - [x] Introduce a small `AdvisoryModuleConfigRepository` or equivalent shared-repository wrapper under `backend/src/modules/advisory/admin/` or `backend/src/database/repositories/`.
  - [x] Update `AdvisoryAdminService` to use the shared repository contract for reads, create, update, and access checks.
  - [x] Keep controllers using `@CurrentTenant()` and `TenantGuard`; never accept tenant id from request body, query string, or route params.
  - [x] Preserve Story 1.2 behavior: default disabled config, role binding validation, strict audit events, latest audit summary, and disabled access messages.

- [x] Add cross-tenant isolation tests for current Epic 1 data surfaces (AC: 1, 2)
  - [x] Extend `backend/src/database/repositories/base.repository.spec.ts` or add focused specs proving tenant filters are injected for find, findOne, count, array-where queries, update, and delete.
  - [x] Add tests proving update payloads cannot mutate `tenantId`.
  - [x] Add advisory config service/repository tests proving tenant A cannot read, update, delete, or overwrite tenant B's `advisory_module_configs` row.
  - [x] Add regression tests proving a malicious `tenantId` in the admin update payload is ignored and cannot alter another tenant's config.
  - [x] Confirm Story 1.2 advisory access/admin tests still pass after moving service reads/writes behind the repository wrapper.

- [x] Document security and scope evidence without front-loading future entities (AC: 3, 4, 5)
  - [x] Record in the Dev Agent Record that MVP source of truth is `tenantId + BaseRepository`; PostgreSQL RLS is post-MVP hardening and not a Story 1.3 blocker.
  - [x] Record that future first-use stories own cross-tenant tests for `workflow_sessions`, `conversation_messages`, `workflow_outputs`, `workflow_checkpoints`, `output_ratings`, and `organization_context`.
  - [x] Do not create the six future advisory runtime tables in this story.
  - [x] Document TLS 1.2+ and AES-256-at-rest as inherited production infrastructure requirements; add code/config checks only if existing repo config exposes them locally.
  - [x] Verify current advisory module config indexes support tenant-scoped lookup (`tenantId`, `moduleKey`) and no session-history partition work is required before session tables exist.

- [x] Automated verification (AC: 1-5)
  - [x] Run focused backend tests for repository and advisory admin/access behavior.
  - [x] Run `cd backend && npm run orm:entities:parity`.
  - [x] Run `cd backend && npx tsc --noEmit`.
  - [x] Run broader backend regression where feasible; document any unrelated existing failures exactly.
  - [x] Run frontend tests only if frontend advisory behavior changes; otherwise document why Story 1.3 is backend/security-infrastructure only.

## Dev Notes

### Source Requirements

- Epic 1 owns the security and governance foundation for ThinkTank: authentication reuse, RBAC, tenant isolation, auditability, provider gateway boundaries, and minimal telemetry hooks. Story 1.3 specifically owns tenant isolation foundation. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 1]
- Story 1.3 covers FR49 and NFR7/NFR8/NFR11/NFR16. The practical implementation decision is tenant-scoped application-layer filtering, not immediate PostgreSQL RLS. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.3; `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md`]
- PRD NFR7 still says RLS, but the architecture correct-course addendum overrides that for MVP: `tenant_id + BaseRepository` is the source of truth; RLS is post-MVP enterprise hardening. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR7; `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md`]
- NFR8 requires TLS 1.2+ in transit and AES-256 at rest. This story should document inherited infrastructure evidence rather than inventing app-level crypto unless existing configuration makes a local code check appropriate. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR8]
- NFR11 enterprise background isolation is owned by the first story that introduces `organization_context` (Story 3.6), not by this foundation story. [Source: `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md`]
- NFR16 session history partitioning cannot be completed before session-history tables exist; this story should prove tenant-indexed lookup for current tables and document later ownership. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR16; architecture addendum entity ownership]

### Scope Boundaries

This story is a shared tenant-isolation infrastructure and evidence story. It must not implement Quick Consult, workflow runtime, conversation messages, session history, output generation, checkpoint persistence, rating/favorites, enterprise background capture, provider gateway, telemetry dashboard, or a new frontend experience.

Do not create these future advisory tables in Story 1.3:

| Entity | First-use story |
| --- | --- |
| `workflow_sessions` | Story 2.5 |
| `conversation_messages` | Story 2.6 |
| `workflow_outputs` | Story 2.8 |
| `workflow_checkpoints` | Story 4.1 |
| `output_ratings` | Story 4.4 |
| `organization_context` | Story 3.6 |

The only tenant-scoped advisory table currently introduced by Epic 1 is `advisory_module_configs` from Story 1.2. Story 1.3 should harden that surface and the shared repository base so later first-use stories can reuse the same contract.

### Previous Story Intelligence

- Story 1.2 added `backend/src/database/entities/advisory-module-config.entity.ts`, migration `1772000000029-CreateAdvisoryModuleConfigs.ts`, admin API, config service, access service integration, audit logging, and frontend admin screen.
- Story 1.2 deliberately did not add workflow/session/output/checkpoint/rating/context tables. Preserve that boundary.
- `AdvisoryAdminService` currently uses `Repository<AdvisoryModuleConfig>` directly with explicit `{ tenantId, moduleKey }` filters. Story 1.3 should move this data surface behind the shared tenant repository contract without changing the public admin/access behavior.
- Story 1.2 code review fixed frontend global response-envelope handling and Sidebar access gating. Avoid unrelated frontend churn.
- Story 1.2 validation passed focused advisory tests, entity parity, backend TypeScript, frontend TypeScript, and full frontend regression. Full backend regression still had unrelated taxonomy-domain-gate failures.

### Existing Patterns To Reuse

- Tenant context: `backend/src/modules/organizations/guards/tenant.guard.ts`, `backend/src/modules/organizations/decorators/current-tenant.decorator.ts`.
- Tenant entity contract: `backend/src/database/interfaces/tenant-entity.interface.ts`.
- Shared repository base: `backend/src/database/repositories/base.repository.ts` and tests in `base.repository.spec.ts`.
- Legacy tenant repository helper used by other modules: `backend/src/database/repositories/base-tenant.repository.ts`. Do not migrate unrelated modules unless required; avoid broad behavioral churn.
- Advisory config entity/service/tests: `backend/src/database/entities/advisory-module-config.entity.ts`, `backend/src/modules/advisory/admin/advisory-admin.service.ts`, `backend/src/modules/advisory/admin/advisory-admin.service.spec.ts`.
- TypeORM registration: `backend/src/config/typeorm.entities.ts`, `backend/src/database/entities/index.ts`, `backend/src/modules/advisory/advisory.module.ts`.

### Backend Implementation Guidance

- Use codebase naming style: entity property is `tenantId` mapped to database column `tenant_id`.
- Prefer a narrow repository wrapper for `AdvisoryModuleConfig` with methods such as `findByModuleKey(tenantId, moduleKey)`, `createForTenant(...)`, and `updateForTenant(...)`. Keep `AdvisoryAdminService` focused on business rules and audit emission.
- `BaseRepository.update()` must not pass caller data containing `tenantId` into TypeORM `update()`. Strip `tenantId` before mutation and return the scoped row after update.
- `BaseRepository.create()` should continue to overwrite caller-supplied `tenantId` with the method argument.
- If supporting array `where` options, inject `tenantId` into every branch. TypeORM OR arrays without tenant injection are a common cross-tenant leak.
- Be careful with TypeORM query builder patterns: calling `.where()` after a helper has already applied a tenant predicate can replace the tenant predicate. Prefer `.andWhere()` after base tenant scoping or avoid query builder in this story unless tested.
- Do not use raw repositories in advisory code unless a test proves tenant isolation is applied manually. `getRawRepository()` remains exceptional.

### Security / Compliance Guidance

- Tenant id must come from `TenantGuard`/`@CurrentTenant()` or explicit service method scope supplied by a guarded caller. It must not be accepted from frontend payloads.
- Story evidence should explicitly state that MVP uses application-layer tenant filtering and that historical RLS references are deferred to post-MVP hardening.
- Sensitive advisory content does not exist yet in Epic 1. Do not invent encryption of prompts/conversations before those entities exist.
- For current data, prove that `advisory_module_configs` has tenant-scoped lookup indexes and unique `(tenantId, moduleKey)` behavior from existing metadata/migration tests.

### Testing Requirements

- Follow TDD: add failing tests before implementation.
- Focused backend commands:
  - `cd backend && npm run test -- base.repository advisory --runInBand`
  - `cd backend && npm run orm:entities:parity`
  - `cd backend && npx tsc --noEmit`
- Broader regression command:
  - `cd backend && npm test -- --runInBand`
- Frontend validation is not expected unless frontend code changes. If unchanged, record that Story 1.3 is backend/security-infrastructure only.
- Do not mark tasks complete unless the tests actually exist and pass or an unrelated existing failure is documented with exact suite names.

### Latest Technical Notes

- No new external package or framework upgrade is required. Use the repo-locked stack and local TypeORM/NestJS APIs already in use.
- Local source of truth: NestJS 10.x, TypeORM 0.3.x, PostgreSQL, existing Jest setup. Do not redesign around new framework APIs.

### Project Structure Notes

- Keep shared database helpers under `backend/src/database/repositories/`.
- Keep advisory-specific repository/service changes under `backend/src/modules/advisory/admin/` unless the repo's existing database repository pattern is a better fit.
- Keep tests colocated with source files using `*.spec.ts`, matching existing backend style.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.3 acceptance criteria and implementation notes.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR49, NFR7, NFR8, NFR11, NFR16.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - tenant_id + BaseRepository decision, repository enforcement, naming and testing patterns.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - MVP tenant isolation source of truth and first-use entity ownership.
- `_bmad-output/planning-artifacts/base-repository.ts` - architecture reference implementation; adapt to current repo style rather than copying blindly.
- `_bmad-output/implementation-artifacts/1-2-tenant-module-enablement-and-role-permissions.md` - previous story behavior, files, tests, and known regression notes.
- `backend/src/database/repositories/base.repository.ts` - current shared repository base to harden.
- `backend/src/database/interfaces/tenant-entity.interface.ts` - tenant entity contract.
- `backend/src/modules/advisory/admin/advisory-admin.service.ts` - current advisory config data access to bring under shared contract.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 1 Story 1.3, architecture tenant isolation decision, correct-course addendum, PRD NFRs, Story 1.2 implementation, and current repository patterns.
- 2026-05-19: RED tests added and confirmed failing for `BaseRepository` array `where` tenant injection, update payload `tenantId` stripping, and missing `AdvisoryModuleConfigRepository`.
- 2026-05-19: GREEN implementation hardened `BaseRepository`, introduced `AdvisoryModuleConfigRepository`, and moved `AdvisoryAdminService` reads/create/update behind the shared tenant repository contract.
- 2026-05-19: Verification commands run: `npm run test -- base.repository advisory-module-config.repository advisory-admin.service --runInBand` (initial RED failed as expected, later passed), `npm run test -- base.repository advisory --runInBand`, `npm run orm:entities:parity`, `npx tsc --noEmit`, and `npm test -- --runInBand`.
- 2026-05-19: Code review found one PATCH finding for empty TypeORM array `where` preserving tenant scope; fixed and re-verified.
- 2026-05-19: Traceability matrix and quality gate generated for the current ThinkTank Story 1.3; gate decision PASS.

### Implementation Plan

- Harden the existing shared `BaseRepository<T extends TenantEntity>` rather than adding a ThinkTank-only base class.
- Add a narrow advisory-specific wrapper for `advisory_module_configs` and keep `AdvisoryAdminService` focused on business rules and audit emission.
- Keep Story 1.3 limited to the current Epic 1 tenant-scoped data surface; future runtime entities remain owned by their first-use stories.

### Completion Notes List

- Hardened `BaseRepository` so tenant filters are injected into object and array TypeORM `where` conditions for `findAll`, `findOne`, and `count`.
- `BaseRepository.create()` overwrites caller-supplied `tenantId`; `BaseRepository.update()` strips caller-supplied `tenantId` and always scopes by `{ id, tenantId }`; `delete()` remains scoped by `{ id, tenantId }`.
- Added `AdvisoryModuleConfigRepository` for the current `advisory_module_configs` surface, with tenant-scoped `findByModuleKey`, `createForTenant`, `updateForTenant`, and `deleteForTenant` methods.
- Updated `AdvisoryAdminService` to use the wrapper for reads, create, update, and access checks while preserving Story 1.2 behavior: disabled defaults, role validation, strict audit events, latest audit summary, and disabled access messaging.
- MVP tenant isolation evidence: source of truth is `tenantId + BaseRepository` at the application repository layer; PostgreSQL RLS is documented as post-MVP enterprise hardening and is not a Story 1.3 blocker.
- Future first-use stories own cross-tenant tests for `workflow_sessions` (2.5), `conversation_messages` (2.6), `workflow_outputs` (2.8), `workflow_checkpoints` (4.1), `output_ratings` (4.4), and `organization_context` (3.6). No future advisory runtime tables were created in this story.
- NFR8 evidence: TLS 1.2+ in transit and AES-256-at-rest are inherited production infrastructure requirements; no local app-level encryption code was added because sensitive advisory conversation/output entities do not exist yet.
- Verified `advisory_module_configs` tenant lookup support through existing entity metadata coverage for `idx_advisory_module_configs_tenant_id` and unique `(tenantId, moduleKey)`. No session-history partition work is required before session tables exist.
- Frontend tests were not run because Story 1.3 changed backend/security-infrastructure code only and no frontend advisory behavior changed.
- Broader backend regression remains blocked by unrelated existing taxonomy-domain-gate failures: `taxonomy-domain-gate.automation.spec.ts` tests `[P0][6.5-AUTO-003]` and `[P0][6.5-AUTO-007]` expect `decision.allowed === true` but receive `false`; `taxonomy-domain-gate.atdd-8-2.spec.ts` test `[8.2-SVC-003][P1]` expects benchmarkGate PASS with tier/source details but receives FAIL/null values.
- Code review PATCH finding resolved: empty TypeORM array `where` now collapses to a scoped tenant predicate for `findAll`, `findOne`, and `count`; focused advisory tests now cover 47 passing cases.
- Traceability gate decision: PASS. P0 coverage 100%, P1 coverage 100%, overall coverage 100%; no Story 1.3 coverage gaps remain.

### File List

- `_bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-1-3.md`
- `_bmad-output/test-artifacts/atdd-story-1-3-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-3-fixtures.ts`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-3-2026-05-19T03-42-08+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-3-2026-05-19T03-42-08+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-3-2026-05-19T03-42-08+08-00.json`
- `_bmad-output/test-artifacts/code-review-story-1-3.md`
- `_bmad-output/test-artifacts/gate-decision-story-1-3.yaml`
- `_bmad-output/test-artifacts/traceability-report.md`
- `_bmad-output/test-artifacts/traceability-report-story-1-3.md`
- `_bmad-output/test-artifacts/traceability-story-1-3-phase1.json`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-1-3-2026-05-19T04-05-02+08-00.json`
- `backend/src/database/repositories/base.repository.ts`
- `backend/src/database/repositories/base.repository.spec.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.spec.ts`
- `backend/src/modules/advisory/admin/advisory-module-config.repository.ts`
- `backend/src/modules/advisory/admin/advisory-module-config.repository.spec.ts`

## Change Log

- 2026-05-19: Story context created for tenant isolation foundation.
- 2026-05-19: Implemented tenant isolation foundation, advisory module config repository wrapper, cross-tenant tests, security evidence, and verification notes.
- 2026-05-19: Addressed code review empty-array tenant filtering finding and recorded Story 1.3 review artifact.
- 2026-05-19: Generated Story 1.3 traceability matrix and PASS gate decision; marked story done.
