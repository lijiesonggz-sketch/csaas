# Story 1.2: Tenant Module Enablement and Role Permissions

Status: done

## Story

As a tenant administrator,
I want to enable or disable ThinkTank and bind access to tenant roles,
so that I can control who can use the advisory module in my organization.

## Acceptance Criteria

1. Given a tenant administrator opens the module management area, when they enable ThinkTank for the tenant, then authorized tenant users can see and open the module.
2. Given ThinkTank is enabled or disabled, then the module configuration screen shows module status, role binding, data retention policy, privacy confirmation, and latest audit summary.
3. Given a tenant administrator enables ThinkTank, then the enablement action emits audit event `thinktank.module.enabled` with actor, tenant, timestamp, and changed setting.
4. Given ThinkTank is disabled for a tenant, when any tenant user attempts to open ThinkTank, then the module is unavailable with a clear disabled-state message.
5. Given ThinkTank is disabled for a tenant, then no advisory session can be created for that tenant. This story must introduce the reusable guard/service check even though session creation is implemented later.
6. Given a tenant administrator disables ThinkTank, when the setting is saved, then the disable action emits audit event `thinktank.module.disabled` with actor, tenant, timestamp, and changed setting.
7. Given a tenant administrator updates role access, when permissions are saved, then access checks use the existing CSAAS RBAC model and role changes take effect without a separate ThinkTank account model.
8. Given role access is updated, then the system emits audit event `thinktank.role_access.updated`.

## Tasks / Subtasks

- [x] Backend tenant module configuration persistence (AC: 1-8)
  - [x] Add a tenant-scoped ThinkTank module configuration entity under `backend/src/modules/advisory/admin/` or `backend/src/database/entities/`, registered in TypeORM entity exports and advisory module imports.
  - [x] Add a migration for an `advisory_module_configs` table with UUID primary key, `tenant_id`, `module_key`, `enabled`, `allowed_roles`, `data_retention_days`, privacy confirmation fields, audit metadata, and timestamps.
  - [x] Enforce one config per tenant/module via a unique index on `tenant_id + module_key`; use `module_key = "thinktank"`.
  - [x] Default new tenant config to disabled, empty role binding or no effective role access, `data_retention_days = 90`, and visible privacy policy copy.
  - [x] Do not create workflow/session/output/checkpoint/rating/context tables in this story.

- [x] Backend admin API for module management (AC: 1, 2, 3, 6, 7, 8)
  - [x] Add guarded admin endpoints, preferably under `backend/src/modules/advisory/admin/`:
    - `GET /advisory/admin/module-config`
    - `PUT /advisory/admin/module-config`
  - [x] Protect endpoints with existing `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`/`@Roles(UserRole.ADMIN)`.
  - [x] Use `@CurrentUser()` and `@CurrentTenant()`; never accept tenant id from the request body.
  - [x] Validate `allowedRoles` against existing `UserRole` values only: `admin`, `consultant`, `client_pm`, `respondent`.
  - [x] Return ThinkTank-owned response envelopes: success as `{ data: ... }`, user-facing errors through the existing Nest exception path.
  - [x] Include latest audit summary in the config response by reading recent audit entries for module config events scoped to the current tenant.

- [x] Replace Story 1.1 story-local role policy with tenant config policy (AC: 1, 4, 5, 7)
  - [x] Extend `AdvisoryAccessService` so access requires both tenant module `enabled === true` and the user's role in the configured `allowedRoles`.
  - [x] Preserve Story 1.1 `GET /advisory/access`, `thinktank.access.opened`, and `thinktank.access.denied` behavior.
  - [x] Return a distinct disabled-state denial reason/message when the tenant config is disabled.
  - [x] Add a reusable service method such as `assertThinkTankModuleAvailable(user, tenantId)` for later session/workflow creation paths; tests must prove disabled tenants are blocked before session creation can be added in Story 2.5.
  - [x] Do not add a separate ThinkTank account/user model.

- [x] Audit emission for configuration changes (AC: 3, 6, 8)
  - [x] Emit `thinktank.module.enabled` when `enabled` changes from false to true.
  - [x] Emit `thinktank.module.disabled` when `enabled` changes from true to false.
  - [x] Emit `thinktank.role_access.updated` when `allowedRoles` changes.
  - [x] Audit payloads must include actor/user id, tenant id, module key, changed setting, old value, new value, outcome, and `occurredAt`.
  - [x] No audit payload may include raw advisory prompt, conversation, report, or enterprise background content.
  - [x] Prefer strict/durable audit behavior for control-plane changes. If using a transaction, keep config persistence and audit insert consistent.

- [x] Frontend admin module configuration screen (AC: 1, 2, 6, 7)
  - [x] Add `frontend/app/admin/advisory/page.tsx` or a similarly named admin route for ThinkTank module management inside existing `MainLayout`.
  - [x] Add a sidebar admin child entry, for admins only, with operational copy such as `ThinkTank 配置`.
  - [x] Render module status, role binding controls, data retention policy defaulting to 90 days, privacy confirmation text, and latest audit summary.
  - [x] Provide enable/disable and role-binding save flows using accessible controls: switch/checkboxes/buttons/dialogs as appropriate.
  - [x] Confirm disabling access through an accessible dialog and present a clear disabled-state explanation.
  - [x] Keep the UI dense and operational, not a marketing or landing page.

- [x] Frontend access behavior and API proxy updates (AC: 1, 4, 7)
  - [x] Update `frontend/lib/advisory/access.ts` so sidebar visibility and `/advisory` route access account for backend module config, not only role hardcoding.
  - [x] Keep the backend authoritative. Frontend filtering may reduce navigation noise, but direct route access must still call `/api/advisory/access`.
  - [x] Add or update Next route handlers under `frontend/app/api/advisory/` to proxy admin config calls to backend with the existing auth token pattern.
  - [x] Preserve Story 1.1 loading, authorized placeholder, and denied state. Add a disabled-state message for tenant-disabled access.

- [x] Automated tests and verification (AC: 1-8)
  - [x] Backend unit tests for default disabled config, enable/disable transitions, role updates, invalid role rejection, tenant scoping, and disabled-module access denial.
  - [x] Backend controller tests for admin guard/role behavior, response envelope, and audit events `thinktank.module.enabled`, `thinktank.module.disabled`, `thinktank.role_access.updated`.
  - [x] Backend access tests proving enabled+bound role can open, enabled+unbound role is denied, disabled tenant is denied, and existing access opened/denied audit events remain intact.
  - [x] Migration/entity tests or metadata parity checks covering the new table/entity registration.
  - [x] Frontend tests for admin screen loading, enabled/disabled states, role binding save, disable confirmation, latest audit summary, non-admin denial, sidebar admin entry, advisory route disabled state, and role-based visibility.
  - [x] Run focused tests first, then TypeScript validation for changed frontend/backend areas; run broader suites if feasible and document unrelated existing failures.

## Dev Notes

### Source Requirements

- Epic 1 requires ThinkTank to be safely enabled by tenant administrators under CSAAS authentication, RBAC, tenant isolation, audit, and data-localization constraints.
- Story 1.2 owns FR46, FR48, FR51, NFR12, and NFR13 for module enablement, role binding, retention policy display, and module-configuration audit events.
- UX requires a tenant admin screen with module status, role/user-group access binding, default 90-day data retention policy, privacy confirmation that conversation history is not used for model training, latest audit summary, disabled state, permission-not-configured state, and audit-data-delayed state.

### Scope Boundaries

This story is a tenant module configuration and RBAC slice. It must not implement Quick Consult, recommendations, workflow selection, session sidebar, conversation workspace, document drawer, provider gateway, prompt builder, output export, report reuse, telemetry dashboard, or full Story 1.4 versioned event contract.

The six core advisory tables remain owned by later first-use stories and must not be front-loaded here:

| Entity | First-use story |
| --- | --- |
| `workflow_sessions` | Story 2.5 |
| `conversation_messages` | Story 2.6 |
| `workflow_outputs` | Story 2.8 |
| `workflow_checkpoints` | Story 4.1 |
| `output_ratings` | Story 4.4 |
| `organization_context` | Story 3.6 |

This story may introduce only the module-configuration table required to satisfy FR46/NFR12.

### Previous Story Intelligence

- Story 1.1 established `backend/src/modules/advisory/`, `AdvisoryModule`, guarded `GET /advisory/access`, `AdvisoryAccessService`, and frontend `/advisory` placeholder.
- Story 1.1 used a temporary hardcoded policy allowing `admin`, `consultant`, and `client_pm`; Story 1.2 must replace that with tenant config plus existing CSAAS roles.
- Story 1.1 access audit events use `AuditLogService`, `AuditAction.READ`, `AuditAction.ACCESS_DENIED`, entity type `ThinkTankAccess`, and details `eventName`, `outcome`, `module`, `reason`, `occurredAt`.
- Frontend Story 1.1 added `frontend/lib/advisory/access.ts`, `/api/advisory/access` proxy, `/advisory` page, and Sidebar ThinkTank entry. Reuse these files; do not rebuild the route or navigation from scratch.
- Story 1.1 full backend regression had unrelated taxonomy benchmark failures. Do not treat those as advisory regressions unless changed files overlap.

### Existing Patterns To Reuse

- Backend guards/decorators: `backend/src/modules/auth/guards/jwt-auth.guard.ts`, `backend/src/modules/auth/guards/roles.guard.ts`, `backend/src/modules/auth/decorators/roles.decorator.ts`, `backend/src/modules/auth/decorators/current-user.decorator.ts`, `backend/src/modules/organizations/guards/tenant.guard.ts`, `backend/src/modules/organizations/decorators/current-tenant.decorator.ts`.
- Backend advisory access code: `backend/src/modules/advisory/access/advisory-access.service.ts`, `backend/src/modules/advisory/access/advisory-access.controller.ts`.
- Backend audit persistence: `backend/src/modules/audit/audit-log.service.ts`, `backend/src/database/entities/audit-log.entity.ts`.
- TypeORM registration: `backend/src/config/typeorm.entities.ts`, `backend/src/config/database.config.ts`, `backend/src/database/entities/index.ts`, `backend/src/database/migrations/`.
- Frontend authenticated shell/admin layout: `frontend/components/layout/MainLayout.tsx`, `frontend/app/admin/layout.tsx`.
- Frontend sidebar/admin child navigation: `frontend/components/layout/Sidebar.tsx`.
- Frontend auth/session types and API proxy pattern: `frontend/lib/auth/types.ts`, `frontend/app/api/advisory/access/route.ts`.
- shadcn/Radix-compatible controls already available: `frontend/components/ui/button.tsx`, `card.tsx`, `switch.tsx`, `checkbox.tsx`, `dialog.tsx`, `alert.tsx`, `table.tsx` if present.

### Backend Implementation Guidance

- Keep all ThinkTank feature code under `backend/src/modules/advisory/` to match the brownfield repo. Architecture examples use `src/advisory/`, but this repo uses `backend/src/modules/<feature>/`.
- Suggested files:
  - `backend/src/modules/advisory/admin/advisory-module-config.entity.ts` or `backend/src/database/entities/advisory-module-config.entity.ts`
  - `backend/src/modules/advisory/admin/advisory-admin.controller.ts`
  - `backend/src/modules/advisory/admin/advisory-admin.service.ts`
  - `backend/src/modules/advisory/admin/dto/update-advisory-module-config.dto.ts`
  - `backend/src/database/migrations/<timestamp>-CreateAdvisoryModuleConfigs.ts`
- Suggested table shape:
  - `id uuid primary key`
  - `tenant_id uuid not null`
  - `module_key varchar(50) not null default 'thinktank'`
  - `enabled boolean not null default false`
  - `allowed_roles text[] not null default '{}'`
  - `data_retention_days integer not null default 90`
  - `privacy_confirmed_at timestamptz null`
  - `privacy_confirmed_by uuid null`
  - `created_by uuid null`
  - `updated_by uuid null`
  - `created_at timestamptz not null`
  - `updated_at timestamptz not null`
  - unique index `tenant_id, module_key`
- If this repo's TypeORM style prefers enum arrays poorly supported by tests, use `text[]` with service-level validation against `UserRole` to avoid PostgreSQL enum churn.
- `GET /advisory/access` should return allowed only when tenant config exists/enabled and user role is bound. Missing config should behave as disabled.
- Disabled response copy should be operational, for example: `ThinkTank 当前未在本租户启用，请联系管理员开通。`
- Admin endpoints must reject non-admin users. A tenant admin means existing CSAAS `UserRole.ADMIN` in this codebase unless a stronger organization-level admin model is already present.
- No request body may override tenant id, actor id, or module key for audit purposes.

### Frontend Implementation Guidance

- Admin page should be a real management screen, not a feature explanation page.
- Show four visible control groups:
  - Module status: enabled/disabled switch.
  - Role binding: checkboxes for existing CSAAS roles.
  - Retention/privacy: default 90 days, policy text, privacy confirmation.
  - Audit summary: latest enable, disable, and role-access changes, with fallback when unavailable.
- Use role names consistent with existing UI: `admin`, `consultant`, `client_pm`, `respondent`; labels may be `管理员`, `主咨询师`, `企业PM`, `被调研者`.
- Avoid production-only `data-testid`; tests should use accessible roles, labels, and text.
- Preserve existing Sidebar collapsed behavior and active route styling when adding the admin child entry.

### Audit Event Mapping For This Story

Story 1.4 owns the full versioned ThinkTank event contract. For Story 1.2, use this interim mapping and keep it easy to migrate:

| Event | AuditAction | Entity Type | Details |
| --- | --- | --- | --- |
| `thinktank.module.enabled` | `UPDATE` | `ThinkTankModuleConfig` | `eventName`, `outcome: "success"`, `module`, `changedSetting: "enabled"`, `oldValue`, `newValue`, `occurredAt` |
| `thinktank.module.disabled` | `UPDATE` | `ThinkTankModuleConfig` | `eventName`, `outcome: "success"`, `module`, `changedSetting: "enabled"`, `oldValue`, `newValue`, `occurredAt` |
| `thinktank.role_access.updated` | `UPDATE` | `ThinkTankModuleConfig` | `eventName`, `outcome: "success"`, `module`, `changedSetting: "allowedRoles"`, `oldValue`, `newValue`, `occurredAt` |

Use the config row id as `entityId` when available. Keep `tenantId`, `organizationId` if known, and `userId` populated through existing audit columns.

### Testing Requirements

- Follow TDD: create failing tests before implementation.
- Focused backend commands:
  - `npm run test -- advisory`
  - `npm run orm:entities:parity`
  - `npx tsc --noEmit`
- Focused frontend commands:
  - `npm run test -- advisory Sidebar`
  - `npm run test -- admin/advisory`
  - `npx tsc --noEmit`
- E2E: run `npx playwright test --list --grep "advisory|ThinkTank"` first. If no matching E2E exists, document the gap; do not create brittle E2E unless the existing suite has matching fixtures/auth helpers.
- If broader suites expose existing unrelated failures, document exact failing suites and keep advisory focused tests passing.

### Latest Technical Notes

- No new external library or version upgrade is required for this story. Use the repo-locked stack: NestJS 10.4, TypeORM 0.3.20, PostgreSQL, Next.js 14.2 App Router, React 18.3, next-auth 4.24, lucide-react, and existing shadcn/Radix UI primitives.
- Because the story is about existing RBAC/config/audit behavior, local package manifests and source code are the source of truth. Do not redesign around newer framework APIs.

### Project Structure Notes

- Architecture says frontend route examples under `src/app/(dashboard)/advisory/`; this repo currently uses `frontend/app/advisory/` and `frontend/app/admin/` with `MainLayout`. Continue that pattern.
- Architecture says API endpoints use `/api/{resource}` examples; the backend currently exposes controllers directly while frontend App Router proxies through `/api/...`. Continue Story 1.1's proxy pattern.
- `TenantGuard` comments mention historical RLS, but current code injects `request.tenantId` and uses application-layer filtering. This aligns with the correct-course addendum: MVP tenant isolation source of truth is `tenant_id + BaseRepository`/service filtering, not PostgreSQL RLS as an MVP blocker.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.2 acceptance criteria and Epic 1 implementation notes.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR46, FR48, FR51; NFR12, NFR13.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - advisory module boundary, REST API style, TypeORM/PostgreSQL conventions, audit/security requirements.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - no front-loaded advisory runtime entities; tenant isolation source of truth.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Tenant Admin Module Configuration requirements and states.
- `_bmad-output/implementation-artifacts/1-1-register-thinktank-module-entry.md` - previous story implementation patterns and known regression notes.
- `backend/src/modules/advisory/access/advisory-access.service.ts` - temporary access policy to replace/extend.
- `backend/src/modules/advisory/access/advisory-access.controller.ts` - existing guarded access endpoint.
- `frontend/lib/advisory/access.ts` - frontend access helper/proxy consumer.
- `frontend/components/layout/Sidebar.tsx` - existing primary/admin navigation behavior.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Started Story 1.2 implementation after ATDD red artifact generation.
- 2026-05-19: ATDD RED confirmed missing module config implementation, then GREEN focused backend/frontend tests passed.
- 2026-05-19: Full frontend regression passed; full backend regression still has existing non-advisory taxonomy-domain-gate failures.
- 2026-05-19: Code review found and fixed frontend nested response-envelope handling plus respondent role navigation gating.
- 2026-05-19: Traceability gate completed with PASS; 8/8 P0 acceptance criteria fully covered.

### Completion Notes List

- Implemented tenant-scoped `advisory_module_configs` persistence with TypeORM registration and migration; no future advisory runtime tables were added.
- Added admin-only ThinkTank config API with current-tenant scoping, CSAAS role validation, response envelopes, latest audit summary, and strict audit logging for enable/disable/role changes.
- Replaced Story 1.1 hardcoded backend access policy with tenant config evaluation while preserving `thinktank.access.opened` and `thinktank.access.denied`.
- Added frontend admin config screen, admin Sidebar entry, config-aware ThinkTank navigation filtering, admin proxy route, and disabled-state handling.
- Added advisory envelope unwrapping and route/client tests so frontend handles backend global response wrapping and admin proxy forwarding.
- Validation passed for focused advisory tests, entity parity, TypeScript checks, and full frontend regression. `npx playwright test --list --grep "advisory|ThinkTank"` found 0 matching E2E tests and exits with `No tests found`; this is documented as a non-blocking E2E fixture gap, so no brittle E2E was added.
- Code review and traceability gate both passed after fixes.
- Full backend regression result: 3 existing unrelated taxonomy-domain-gate failures remain in `taxonomy-domain-gate.automation.spec.ts` and `taxonomy-domain-gate.atdd-8-2.spec.ts`.

### File List

- `_bmad-output/implementation-artifacts/1-2-tenant-module-enablement-and-role-permissions.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-1-2.md`
- `_bmad-output/test-artifacts/atdd-story-1-2-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-2-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-1-2-frontend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-2-summary.json`
- `_bmad-output/test-artifacts/code-review-story-1-2.md`
- `_bmad-output/test-artifacts/gate-decision-story-1-2.yaml`
- `_bmad-output/test-artifacts/traceability-report-story-1-2.md`
- `_bmad-output/test-artifacts/traceability-story-1-2-phase1.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-2-2026-05-19T02-56-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-2-2026-05-19T02-56-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-2-2026-05-19T02-56-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-1-2-2026-05-19T03-26-57+08-00.json`
- `backend/src/config/typeorm.entities.ts`
- `backend/src/database/entities/advisory-module-config.entity.ts`
- `backend/src/database/entities/index.ts`
- `backend/src/database/migrations/1772000000029-CreateAdvisoryModuleConfigs.ts`
- `backend/src/modules/advisory/access/advisory-access.controller.spec.ts`
- `backend/src/modules/advisory/access/advisory-access.controller.ts`
- `backend/src/modules/advisory/access/advisory-access.service.spec.ts`
- `backend/src/modules/advisory/access/advisory-access.service.ts`
- `backend/src/modules/advisory/admin/advisory-admin.controller.spec.ts`
- `backend/src/modules/advisory/admin/advisory-admin.controller.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.spec.ts`
- `backend/src/modules/advisory/admin/advisory-admin.service.ts`
- `backend/src/modules/advisory/admin/advisory-module-config.metadata.spec.ts`
- `backend/src/modules/advisory/admin/dto/update-advisory-module-config.dto.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/audit/audit-log.service.ts`
- `frontend/app/admin/advisory/page.test.tsx`
- `frontend/app/admin/advisory/page.tsx`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/admin/module-config/route.test.ts`
- `frontend/app/api/advisory/admin/module-config/route.ts`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/__tests__/Sidebar.test.tsx`
- `frontend/lib/advisory/access.test.ts`
- `frontend/lib/advisory/access.ts`
- `frontend/lib/advisory/admin-config.test.ts`
- `frontend/lib/advisory/admin-config.ts`
- `frontend/lib/advisory/envelope.ts`

## Change Log

- 2026-05-19: Story context created from Epic 1 Story 1.2 with tenant module config, RBAC, audit, frontend admin UX, and Story 1.1 continuity guardrails.
- 2026-05-19: Implemented Story 1.2 tenant module enablement, role binding, audit, frontend admin config, and verification coverage.
- 2026-05-19: Fixed code-review findings for frontend envelope parsing and respondent role navigation, then completed traceability gate with PASS.
