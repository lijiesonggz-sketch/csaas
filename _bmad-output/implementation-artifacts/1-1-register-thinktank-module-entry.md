# Story 1.1: Register ThinkTank Module Entry

Status: done

## Story

As a CSAAS user,
I want to access ThinkTank from the existing CSAAS navigation after login,
so that I can start advisory work without a separate product or login flow.

## Acceptance Criteria

1. Given a user is authenticated through the existing CSAAS JWT flow, when the user has permission to access ThinkTank, then the CSAAS navigation shows a ThinkTank entry under the appropriate product area.
2. Given an authorized user selects the ThinkTank navigation entry, then it opens an authorized ThinkTank module route with a minimal access-controlled empty state or entry placeholder.
3. Given this is only module-entry registration, then this story does not implement the full advisory workspace shell, session sidebar, conversation workspace, document drawer, workflow runtime, or advisory session creation.
4. Given successful authorized access, then the backend emits audit event `thinktank.access.opened`.
5. Given a user is authenticated but lacks ThinkTank access, when the user attempts to open the ThinkTank route directly, then the system blocks access with a user-friendly authorization message.
6. Given a blocked access attempt, then the backend emits audit event `thinktank.access.denied`.

## Tasks / Subtasks

- [x] Backend advisory access endpoint and module registration (AC: 2, 4, 5, 6)
  - [x] Add `backend/src/modules/advisory/advisory.module.ts` and register it in `backend/src/app.module.ts`.
  - [x] Add a narrow `AdvisoryAccessController` under `backend/src/modules/advisory/access/` with a guarded `GET /advisory/access` endpoint.
  - [x] Protect the endpoint with existing `JwtAuthGuard` and `TenantGuard`; use `@CurrentUser()` and `@CurrentTenant()` rather than parsing JWTs manually.
  - [x] Implement a story-local `AdvisoryAccessService` permission helper. For Story 1.1, allow `admin`, `consultant`, and `client_pm`; deny `respondent`. Story 1.2 will replace or extend this with tenant module enablement and role binding.
  - [x] Do not create advisory tables, workflow session tables, checkpoint tables, or module-configuration persistence in this story.

- [x] Audit emission for access opened and denied (AC: 4, 6)
  - [x] Use existing `AuditLogService` from `backend/src/modules/audit/audit-log.service.ts`; import `AuditModule` from `AdvisoryModule`.
  - [x] Persist successful access with `AuditAction.READ`, `entityType: "ThinkTankAccess"`, and `details.eventName: "thinktank.access.opened"`.
  - [x] Persist denied access with `AuditAction.ACCESS_DENIED`, `entityType: "ThinkTankAccess"`, and `details.eventName: "thinktank.access.denied"` before returning `ForbiddenException`.
  - [x] Include tenant/user context, `outcome`, `occurredAt`, and no raw advisory conversation content. Story 1.4 will formalize the full versioned event contract; this story must not build that full foundation early.

- [x] Frontend route and empty state (AC: 2, 3, 5)
  - [x] Add `frontend/app/advisory/layout.tsx` that wraps children in existing `MainLayout`.
  - [x] Add `frontend/app/advisory/page.tsx` as a client page that calls a small advisory access API client and renders one of three states: loading, authorized placeholder, authorization denied.
  - [x] Authorized placeholder should be quiet and product-like: show ThinkTank module name, access-ready status, and disabled/non-functional entry affordance only if clearly labeled as not yet available. Do not build the full workspace.
  - [x] Direct route access by denied users must show a user-friendly authorization message and must not expose advisory features.

- [x] CSAAS navigation entry (AC: 1)
  - [x] Add a ThinkTank entry to `frontend/components/layout/Sidebar.tsx` under the main product navigation, using a lucide icon such as `BrainCircuit` or `Lightbulb`.
  - [x] Keep existing admin-only and organization-required filtering behavior intact.
  - [x] Show the item only for users passing the same story-local frontend access helper (`admin`, `consultant`, `client_pm`). The backend remains authoritative.
  - [x] Preserve collapsed sidebar behavior, active route styling, and mobile overlay behavior.

- [x] Automated tests and verification (AC: 1-6)
  - [x] Backend unit tests for `AdvisoryAccessService`: allowed roles, denied roles, missing role, and no module-configuration dependency.
  - [x] Backend controller tests for successful access event emission and denied access event emission.
  - [x] Frontend tests for Sidebar: ThinkTank appears for allowed roles, is hidden for denied role, navigates to `/advisory`, and remains compatible with collapsed state.
  - [x] Frontend tests for `/advisory` page: loading, authorized placeholder, and denied message.
  - [x] Run focused tests first, then run TypeScript validation for changed frontend/backend areas.

## Dev Notes

### Scope Boundaries

This story is an entry and access-control slice only. It must not implement Quick Consult, recommendation cards, workflow selection, session sidebar, conversation workspace, document drawer, output export, provider gateway, prompt builder, or database entities owned by later stories.

The six core advisory tables are introduced by later first-use stories and must not be front-loaded here:

| Entity | First-use story |
| --- | --- |
| `workflow_sessions` | Story 2.5 |
| `conversation_messages` | Story 2.6 |
| `workflow_outputs` | Story 2.8 |
| `workflow_checkpoints` | Story 4.1 |
| `output_ratings` | Story 4.4 |
| `organization_context` | Story 3.6 |

### Existing Patterns To Reuse

- Frontend authenticated shell: `frontend/components/layout/MainLayout.tsx`.
- Primary sidebar navigation: `frontend/components/layout/Sidebar.tsx`.
- Existing sidebar tests: `frontend/components/layout/__tests__/Sidebar.test.tsx`.
- NextAuth role/session shape: `frontend/lib/auth/types.ts`.
- Frontend auth headers: `frontend/lib/utils/jwt.ts`.
- Backend app module registration: `backend/src/app.module.ts`.
- Backend guards/decorators: `backend/src/modules/auth/guards/jwt-auth.guard.ts`, `backend/src/modules/organizations/guards/tenant.guard.ts`, `backend/src/modules/auth/decorators/current-user.decorator.ts`, `backend/src/modules/organizations/decorators/current-tenant.decorator.ts`.
- Existing audit service/entity: `backend/src/modules/audit/audit-log.service.ts`, `backend/src/database/entities/audit-log.entity.ts`.

### Backend Implementation Guidance

- Put all new backend code under `backend/src/modules/advisory/`.
- Use REST and CSAAS existing guard stack. The endpoint should be simple and deterministic:
  - `GET /advisory/access`
  - success response: `{ data: { allowed: true, module: "thinktank" } }`
  - denied response: `403` with a user-friendly message through the existing exception path.
- Keep permission policy isolated in one helper/service so Story 1.2 can replace role logic with tenant module enablement without touching UI and controller call sites.
- If `TenantGuard` fails before the controller executes, its existing error path may prevent a ThinkTank denied event. Do not rewrite `TenantGuard` in this story. Controller-level denied audit is required for authenticated users who reach the endpoint but fail ThinkTank permission.
- Avoid adding new dependencies.

### Frontend Implementation Guidance

- Use `frontend/app/advisory/` for the initial route. The page should be desktop-first and inherit `MainLayout`.
- Do not create a landing page or marketing page. The first screen is a working module placeholder inside the CSAAS shell.
- Keep UI text direct and operational. Example authorized message: `ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。`
- Use existing `Button`, `Card`, or plain shadcn-compatible classes already present in the app; do not introduce a new design system.
- The backend access endpoint is authoritative. The frontend helper only hides navigation noise for users who obviously cannot access the module.

### Audit Event Mapping For This Story

Story 1.4 owns the full versioned ThinkTank event contract. For Story 1.1, use an interim mapping that can be migrated:

| Event | AuditAction | Entity Type | Details |
| --- | --- | --- | --- |
| `thinktank.access.opened` | `READ` | `ThinkTankAccess` | `eventName`, `outcome: "success"`, `module: "thinktank"` |
| `thinktank.access.denied` | `ACCESS_DENIED` | `ThinkTankAccess` | `eventName`, `outcome: "denied"`, `module: "thinktank"`, `reason` |

No event payload may include raw advisory prompts, conversation content, reports, or enterprise background data.

### Testing Requirements

- Follow TDD: add failing tests before implementation.
- Use role-based tests instead of adding production-only `data-testid` attributes.
- Backend focused commands:
  - `npm run test -- advisory`
  - `npx tsc --noEmit`
- Frontend focused commands:
  - `npm run test -- Sidebar`
  - `npm run test -- advisory`
  - `npx tsc --noEmit`
- If full-suite commands are too slow, still run focused tests and TypeScript checks for both changed packages, then document remaining full-regression risk in Dev Agent Record.

### Latest Technical Notes

- NestJS remains the project backend framework and supports modular, testable, loosely coupled TypeScript applications. Reuse Nest modules/controllers/providers instead of standalone route handlers. Source: https://docs.nestjs.com/
- Next.js App Router pages are Server Components by default, while client interactivity should be marked with `"use client"`; manual JWT/session handling is supported for App Router auth flows. Source: https://nextjs.org/docs/14/app
- shadcn/ui Sidebar is a composable sidebar foundation, but this project already has a custom `Sidebar.tsx`; extend the existing custom sidebar rather than replacing it. Source: https://ui.shadcn.com/docs/components/radix/sidebar

### Project Structure Notes

- Architecture says ThinkTank backend belongs under `src/advisory/`, but the current repository uses `backend/src/modules/<feature>/`. For this brownfield repo, use `backend/src/modules/advisory/` to match established module layout while preserving the architectural boundary.
- Architecture says frontend route should be `src/app/(dashboard)/advisory/`, but this repository currently uses `frontend/app/<route>/layout.tsx` with `MainLayout`. Use `frontend/app/advisory/` unless the repo later adopts `(dashboard)` route groups.
- Do not edit unrelated legacy KG/Radar files except shared navigation and module registration points required by this story.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.1 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR48, FR50, FR51, FR52; NFR19.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - module boundaries, REST/SSE API style, auth/RBAC reuse, advisory module structure.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - no front-loaded advisory entities; tenant isolation source of truth.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - desktop-first CSAAS workspace, navigation, accessibility, no marketing entry.
- `frontend/components/layout/Sidebar.tsx` - current primary navigation implementation.
- `frontend/components/layout/MainLayout.tsx` - current authenticated shell.
- `backend/src/modules/audit/audit-log.service.ts` - existing audit persistence.
- `backend/src/modules/auth/guards/jwt-auth.guard.ts` and `backend/src/modules/organizations/guards/tenant.guard.ts` - existing access guard stack.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Red phase confirmed with `backend npm run test -- advisory` and `frontend npm run test -- Sidebar advisory`; failures pointed to missing advisory service/controller/helper/page/navigation implementation.
- 2026-05-19: Green phase passed `backend npm run test -- advisory` (12 tests) and `frontend npm run test -- Sidebar advisory` (29 tests).
- 2026-05-19: TypeScript validation passed with `backend npx tsc --noEmit` and `frontend npx tsc --noEmit`.
- 2026-05-19: Frontend full unit regression passed with `frontend npm test -- --runInBand` (114 suites passed, 2 skipped).
- 2026-05-19: Backend full unit regression ran with `backend npm test -- --runInBand`; advisory tests passed, but existing `taxonomy-domain-gate` suites failed 3 temporal benchmark-summary assertions unrelated to Story 1.1 touched files.
- 2026-05-19: `frontend npx playwright test --list --grep "advisory|ThinkTank"` found no advisory-specific E2E tests in the current suite.
- 2026-05-19: Traceability gate generated at `_bmad-output/test-artifacts/traceability-report-story-1-1-thinktank-module-entry.md`; gate decision `PASS`.

### Completion Notes List

- Registered a minimal Nest `AdvisoryModule` with guarded `GET /advisory/access`.
- Added story-local ThinkTank role policy for `admin`, `consultant`, and `client_pm`; `respondent` and missing role are denied.
- Added access opened/denied audit emission through existing `AuditLogService` with `ThinkTankAccess` entity type, null `entityId`, tenant/user context, event name, outcome, reason, and `occurredAt`.
- Added Next App Router `/advisory` route with `MainLayout`, loading state, authorized placeholder, and friendly denied state.
- Added frontend advisory access helper and `/api/advisory/access` proxy to the backend endpoint.
- Added Sidebar ThinkTank navigation item with role-based visibility and preserved collapsed/mobile navigation behavior.
- No advisory workflow/session/output/checkpoint/rating/context tables or full workspace features were introduced.

### File List

- backend/src/app.module.ts
- backend/src/modules/advisory/advisory.module.ts
- backend/src/modules/advisory/access/advisory-access.controller.ts
- backend/src/modules/advisory/access/advisory-access.controller.spec.ts
- backend/src/modules/advisory/access/advisory-access.service.ts
- backend/src/modules/advisory/access/advisory-access.service.spec.ts
- frontend/app/advisory/layout.tsx
- frontend/app/advisory/page.tsx
- frontend/app/advisory/__tests__/page.test.tsx
- frontend/app/api/advisory/access/route.ts
- frontend/lib/advisory/access.ts
- frontend/components/layout/Sidebar.tsx
- frontend/components/layout/__tests__/Sidebar.test.tsx
- _bmad-output/implementation-artifacts/1-1-register-thinktank-module-entry.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/test-artifacts/atdd-checklist-1-1.md
- _bmad-output/test-artifacts/atdd-story-1-1-backend-red.spec.ts
- _bmad-output/test-artifacts/atdd-story-1-1-fixtures.ts
- _bmad-output/test-artifacts/atdd-story-1-1-frontend-red.spec.ts
- _bmad-output/test-artifacts/gate-decision-story-1-1.yaml
- _bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-1-1-2026-05-19T02-43-16+08-00.json
- _bmad-output/test-artifacts/traceability-report-story-1-1-thinktank-module-entry.md

## Change Log

- 2026-05-19: Story context created from Epic 1 Story 1.1 with backend/frontend guardrails and scope boundaries.
- 2026-05-19: Implemented ThinkTank module entry registration, advisory access endpoint, access audit events, frontend route placeholder, Sidebar entry, and focused tests.
- 2026-05-19: Completed traceability matrix and story quality gate; story marked done.
