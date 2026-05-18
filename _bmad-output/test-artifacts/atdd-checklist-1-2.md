---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-19T02:56:00+08:00'
workflowType: testarch-atdd
storyId: '1.2'
storyTitle: Tenant Module Enablement and Role Permissions
inputDocuments:
  - 'D:\Csaas\_bmad\tea\config.yaml'
  - 'D:\Csaas\_bmad-output\implementation-artifacts\1-2-tenant-module-enablement-and-role-permissions.md'
  - 'D:\Csaas\frontend\playwright.config.ts'
  - 'D:\Csaas\backend\package.json'
  - 'D:\Csaas\frontend\package.json'
  - 'D:\Csaas\backend\src\modules\advisory\access\advisory-access.service.ts'
  - 'D:\Csaas\backend\src\modules\advisory\access\advisory-access.controller.ts'
  - 'D:\Csaas\frontend\lib\advisory\access.ts'
  - 'D:\Csaas\frontend\app\advisory\page.tsx'
  - 'D:\Csaas\frontend\components\layout\Sidebar.tsx'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\data-factories.md'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\component-tdd.md'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\test-quality.md'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\selector-resilience.md'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\test-levels-framework.md'
  - 'D:\Csaas\_bmad\tea\testarch\knowledge\test-priorities-matrix.md'
---

# ATDD Checklist - Story 1.2: Tenant Module Enablement and Role Permissions

**Date:** 2026-05-19  
**Author:** leo  
**Primary Test Level:** API/backend integration with focused frontend component/page coverage

## Story Summary

As a tenant administrator, I want to enable or disable ThinkTank and bind access to tenant roles, so that I can control who can use the advisory module in my organization.

This story replaces Story 1.1's temporary hardcoded access policy with tenant-scoped module configuration while preserving the existing `/advisory/access` access gate and audit behavior.

## Acceptance Criteria

1. Tenant admins can enable ThinkTank so authorized tenant users can see and open it.
2. Module configuration shows module status, role binding, retention policy, privacy confirmation, and latest audit summary.
3. Enablement emits `thinktank.module.enabled` with actor, tenant, timestamp, and changed setting.
4. Disabled tenants see a clear unavailable message when opening ThinkTank.
5. Disabled tenants cannot create advisory sessions; this story introduces a reusable guard/service check before session creation exists.
6. Disabling emits `thinktank.module.disabled` with actor, tenant, timestamp, and changed setting.
7. Role access uses existing CSAAS RBAC roles and takes effect without a ThinkTank account model.
8. Role binding changes emit `thinktank.role_access.updated`.

## Step 1: Preflight & Context

- Detected stack: `fullstack`.
- Frontend framework: Next.js app router, Jest/Testing Library, Playwright config present.
- Backend framework: NestJS, Jest configured in `backend/package.json`.
- Story file loaded: `_bmad-output/implementation-artifacts/1-2-tenant-module-enablement-and-role-permissions.md`.
- Existing Story 1.1 code inspected for advisory access, frontend access helper, sidebar, and audit behavior.
- Test directory note: repository does not use `{project-root}/tests`; backend tests live under `backend/src/**/*.spec.ts`, frontend tests under app/component-local `__tests__`, and ATDD intent artifacts live under `_bmad-output/test-artifacts`.

## Step 2: Generation Mode

- Selected mode: AI generation.
- Rationale: scenarios are deterministic admin API, RBAC, audit, and accessible UI state flows. Browser recording was not required because the admin screen is new and selectors are defined by accessibility roles/labels.
- Execution mode: sequential. Subagent/agent-team delegation was not used because the user did not explicitly request delegation.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | Red Phase Expectation |
| --- | --- | --- | --- | --- |
| AC1 | Admin enables ThinkTank; enabled and bound users can access `/advisory/access`. | Backend service/API | P0 | Fails until config persistence and access policy exist. |
| AC1 | Sidebar/admin UI exposes ThinkTank and config entry according to access/admin role. | Frontend component | P1 | Fails until Sidebar and admin route are config-aware. |
| AC2 | Admin config response includes status, roles, retention, privacy, latest audit. | Backend API + frontend page | P0 | Fails until admin endpoints and UI are implemented. |
| AC3 | Enable transition emits `thinktank.module.enabled`. | Backend audit integration | P0 | Fails until update service emits durable audit. |
| AC4 | Disabled tenant gets the disabled-state message on backend and frontend. | Backend API + frontend page | P0 | Fails until disabled reason is distinct from role denial. |
| AC5 | Reusable availability check blocks disabled tenants before future sessions. | Backend service/unit | P0 | Fails until `assertThinkTankModuleAvailable` or equivalent exists. |
| AC6 | Disable transition emits `thinktank.module.disabled`. | Backend audit integration | P0 | Fails until update service audits disable transition. |
| AC7 | `allowedRoles` validation accepts only CSAAS roles and no ThinkTank account model. | Backend service/API | P0 | Fails until DTO/service validation and entity boundaries exist. |
| AC8 | Role binding changes emit `thinktank.role_access.updated`. | Backend audit integration | P0 | Fails until allowedRoles diffing and audit exist. |

Duplicate coverage control:

- Backend tests own persistence defaults, validation, tenant scoping, audit, and access policy.
- Frontend tests own admin screen controls, confirmation dialog, proxy call shape, disabled state, and navigation filtering.
- No Playwright E2E is generated yet; existing auth/session fixtures for this new admin screen are not established. The dev phase must run Playwright `--list --grep "advisory|ThinkTank"` and document the gap.

## Step 4: Red Test Generation & Aggregation

Generated RED intent files:

- `_bmad-output/test-artifacts/atdd-story-1-2-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-1-2-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-2-frontend-red.spec.ts`

TDD red-phase compliance:

- Total intent tests: 22.
- Backend/API intent tests: 12.
- Frontend/UI intent tests: 10.
- All tests include `test.skip()`: PASS.
- Placeholder assertions (`expect(true).toBe(true)`) found: none.
- Tests assert expected behavior from ACs: PASS.
- `data-testid` requirements: N/A by project rule. Tests use roles, labels, and visible text.

Temp artifact copies:

- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-2-2026-05-19T02-56-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-2-2026-05-19T02-56-00+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-2-2026-05-19T02-56-00+08-00.json`

## Implementation Checklist

Backend tasks to make the RED intent green:

- [ ] Add `AdvisoryModuleConfig` entity and `advisory_module_configs` migration with unique `tenant_id + module_key`.
- [ ] Register the entity in TypeORM exports/config without creating future runtime tables.
- [ ] Add admin DTO validation for `enabled`, `allowedRoles`, `dataRetentionDays`, and privacy confirmation.
- [ ] Add guarded admin endpoints: `GET /advisory/admin/module-config`, `PUT /advisory/admin/module-config`.
- [ ] Use `CurrentTenant` and `CurrentUser`; never accept tenant id or actor id from request body.
- [ ] Emit `thinktank.module.enabled`, `thinktank.module.disabled`, and `thinktank.role_access.updated` audit events with changed setting, old/new values, actor, tenant, and timestamp.
- [ ] Replace Story 1.1 hardcoded access policy with tenant config policy.
- [ ] Preserve `thinktank.access.opened` and `thinktank.access.denied`.
- [ ] Add reusable availability check for later session creation paths.
- [ ] Add focused backend tests under advisory modules and run `npm run test -- advisory`.

Frontend tasks to make the RED intent green:

- [ ] Add `/admin/advisory` management page inside existing admin/MainLayout patterns.
- [ ] Add admin-only Sidebar child entry `ThinkTank 配置`.
- [ ] Add frontend proxy route(s) for admin config using existing auth token pattern.
- [ ] Render enabled switch, CSAAS role checkboxes, 90-day retention, privacy confirmation, and latest audit summary.
- [ ] Add accessible disable confirmation dialog.
- [ ] Update `/advisory` disabled-state handling and keep backend access authoritative.
- [ ] Update focused frontend tests for Sidebar, advisory page, and admin page using accessible selectors.

## Running Tests

ATDD artifact files are skipped and are not the final executable suite. Green-phase implementation should create or update focused real tests, then run:

```bash
cd backend
npm run test -- advisory
npm run orm:entities:parity
npx tsc --noEmit

cd ../frontend
npm run test -- advisory Sidebar
npm run test -- admin/advisory
npx tsc --noEmit
npx playwright test --list --grep "advisory|ThinkTank"
```

## Step 5: Validate & Complete

Validation result: complete.

- Story ACs loaded and mapped: PASS.
- Framework configs available: PASS.
- Existing patterns reviewed: PASS.
- Red intent files created under `_bmad-output/test-artifacts`: PASS.
- All generated tests use `test.skip()`: PASS.
- No placeholder assertions: PASS.
- CLI/browser sessions cleaned up: N/A, no browser recording used.
- Temp artifacts stored under project artifacts: PASS.
- `data-testid` requirements: N/A; project rule forbids production-only test IDs.
- Local red-phase execution: not run because generated files are skipped ATDD intent artifacts. DEV phase must implement executable focused tests and run them.

## Risks and Assumptions

- Missing config should behave as disabled.
- The backend global prefix makes the externally tested route `/api/advisory/admin/module-config` while the Nest controller route can be `/advisory/admin/module-config`.
- Latest audit summary can be read from existing audit log rows filtered by tenant and ThinkTank module config event names.
- Strict audit durability is preferred for control-plane changes; implementation must avoid persisting config changes without corresponding audit rows.

## Next Workflow

Proceed to `bmad-dev-story` for Story 1.2 implementation and green-phase focused tests.
