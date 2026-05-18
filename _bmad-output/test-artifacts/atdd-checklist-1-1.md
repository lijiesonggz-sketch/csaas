---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-19T02:25:19+08:00'
inputDocuments:
  - D:\Csaas\_bmad\tea\config.yaml
  - D:\Csaas\_bmad\tea\testarch\tea-index.csv
  - D:\Csaas\_bmad-output\implementation-artifacts\1-1-register-thinktank-module-entry.md
  - D:\Csaas\frontend\playwright.config.ts
  - D:\Csaas\frontend\jest.config.js
  - D:\Csaas\frontend\jest.setup.js
  - D:\Csaas\frontend\components\layout\Sidebar.tsx
  - D:\Csaas\frontend\components\layout\__tests__\Sidebar.test.tsx
  - D:\Csaas\backend\package.json
  - D:\Csaas\frontend\package.json
  - D:\Csaas\_bmad\tea\testarch\knowledge\data-factories.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\fixture-architecture.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\network-first.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\component-tdd.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\test-quality.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\test-healing-patterns.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\selector-resilience.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\timing-debugging.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\test-levels-framework.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\test-priorities-matrix.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\ci-burn-in.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\overview.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\api-request.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\auth-session.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\network-recorder.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\intercept-network-call.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\recurse.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\log.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\file-utils.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\network-error-monitor.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\fixtures-composition.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\playwright-cli.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\pactjs-utils-overview.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\pactjs-utils-consumer-helpers.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\pactjs-utils-provider-verifier.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\pactjs-utils-request-filter.md
  - D:\Csaas\_bmad\tea\testarch\knowledge\pact-mcp.md
---

# ATDD Step 1 - Preflight & Context

## Story

Story 1.1: Register ThinkTank Module Entry

## Stack Detection

- `test_stack_type`: `auto`
- Detected stack: `fullstack`
- Frontend indicators: `frontend/package.json`, `frontend/playwright.config.ts`, Next.js, React, Jest, Testing Library, Playwright.
- Backend indicators: `backend/package.json`, NestJS, Jest configuration under `backend/package.json`.

## Prerequisites

- Story file exists and has clear acceptance criteria: pass.
- Frontend test framework configured: pass, `frontend/playwright.config.ts` and Jest config are present.
- Backend test framework configured: pass, Jest is configured in `backend/package.json`.
- Development environment available: pass, dependencies and test folders exist in both `frontend` and `backend`.

## Acceptance Criteria Extracted

1. Authenticated authorized users see a ThinkTank navigation entry.
2. Authorized users can open `/advisory` and see a minimal access-controlled entry placeholder.
3. The story must not implement the full advisory workspace, session sidebar, conversation workspace, document drawer, workflow runtime, or session creation.
4. Successful authorized backend access emits `thinktank.access.opened`.
5. Authenticated users without ThinkTank access are blocked with a user-friendly authorization message.
6. Blocked access emits `thinktank.access.denied`.

## Scope Constraints

- New backend code belongs under `backend/src/modules/advisory/`.
- Do not create advisory persistence tables or module configuration persistence in Story 1.1.
- Role policy for this story is local and narrow: allow `admin`, `consultant`, `client_pm`; deny `respondent` and missing roles.
- Reuse `JwtAuthGuard`, `TenantGuard`, `@CurrentUser()`, `@CurrentTenant()`, and `AuditLogService`.
- Audit details must include `eventName`, `outcome`, `module`, and denied `reason`; no raw advisory content.
- Frontend route uses `frontend/app/advisory/` and inherits `MainLayout`.
- Extend existing `Sidebar.tsx`; do not replace navigation.
- Do not add production-only `data-testid` attributes for tests.

## Existing Patterns Inspected

- Sidebar uses `useSession`, `usePathname`, `useRouter`, static menu item metadata, role filtering, org-based route rewriting, collapsed/mobile states.
- Sidebar tests mock `next/navigation` and `next-auth/react`, use Testing Library role/text queries, and verify route pushes.
- Backend HTTP controller tests commonly use `@nestjs/testing`, `supertest`, guard overrides, `TransformInterceptor`, and mocked `AuditLogService`.
- Frontend app tests run through Jest + jsdom + `ts-jest`; E2E is present but not required for this narrow story slice.

## Test Generation Direction

- Backend unit tests:
  - `AdvisoryAccessService` role policy for allowed roles, denied role, missing role, and independence from module configuration persistence.
- Backend HTTP/controller tests:
  - `GET /api/advisory/access` success returns `{ allowed: true, module: "thinktank" }` and logs `AuditAction.READ`.
  - `GET /api/advisory/access` denied returns 403 and logs `AuditAction.ACCESS_DENIED`.
- Frontend tests:
  - Update `Sidebar.test.tsx` for ThinkTank visibility by allowed roles, hidden for `respondent`, route push to `/advisory`, and collapsed compatibility.
  - Add `/advisory` page tests for loading, authorized placeholder, and denied message.

## Priority and Level

- Priority: P0/P1 boundary because this is authz, navigation, and audit foundation. Treat backend access/audit as P0; frontend visibility and placeholder as P1.
- Test levels: unit for role policy, controller integration for guard/decorator/audit behavior, component/page tests for UI state.
- Contract/Pact testing: not relevant for this in-repo module-entry slice; no consumer-provider contract boundary is introduced.

## Step 1 Result

Inputs are complete. Proceed to Step 2 generation mode.

# ATDD Step 2 - Generation Mode

## Selected Mode

AI generation.

## Rationale

- Acceptance criteria are explicit and testable.
- Scenarios are standard authorization, API, navigation, and audit-emission flows.
- UI work is limited to extending an existing Sidebar and rendering a controlled `/advisory` placeholder.
- Browser recording is not required because there is no complex wizard, drag/drop interaction, live workspace workflow, or selector uncertainty that must be discovered from a running app.

## Recording Decision

Recording skipped. `tea_browser_automation` is `auto`, but no live UI exploration is needed for this story. Existing source and tests provide the required selectors and component structure.

## Step 2 Result

Proceed to Step 3 test strategy.

# ATDD Step 3 - Test Strategy

## Acceptance Criteria Mapping

| AC | Scenario | Level | Priority | Red Phase Expectation |
| --- | --- | --- | --- | --- |
| AC1 | Sidebar shows ThinkTank for `admin`, `consultant`, and `client_pm`. | Frontend component | P1 | Fails until Sidebar has ThinkTank menu item and role helper. |
| AC1 | Sidebar hides ThinkTank for `respondent`. | Frontend component | P0 | Fails until denied role is filtered. |
| AC1 | Clicking ThinkTank navigates to `/advisory`. | Frontend component | P1 | Fails until route key exists. |
| AC1 | Collapsed Sidebar remains compatible and exposes ThinkTank through title/icon-only button for allowed role. | Frontend component | P2 | Fails until collapsed menu receives item. |
| AC2 | Authorized `/advisory` page calls backend access check and renders minimal placeholder. | Frontend page component | P1 | Fails until route/page/client exists. |
| AC3 | `/advisory` placeholder does not expose workspace/session/conversation/document/workflow controls. | Frontend page component | P1 | Fails until page intentionally stays minimal. |
| AC4 | `GET /api/advisory/access` returns allowed response and logs `thinktank.access.opened`. | Backend controller/API | P0 | Fails until controller/module/audit integration exists. |
| AC5 | `GET /api/advisory/access` blocks authenticated but denied role with friendly 403 message. | Backend controller/API | P0 | Fails until controller rejects denied access. |
| AC5 | `/advisory` page renders user-friendly denied state on backend 403. | Frontend page component | P0 | Fails until client/page handles 403. |
| AC6 | Denied backend access logs `thinktank.access.denied` before throwing 403. | Backend controller/API | P0 | Fails until denied audit path is implemented. |
| AC2, AC5 | Role policy allows only `admin`, `consultant`, `client_pm`; denies `respondent` and missing role. | Backend unit | P0 | Fails until `AdvisoryAccessService` exists. |
| AC3 | No module-config dependency or advisory table dependency is introduced in access policy tests. | Backend unit | P1 | Fails until service is pure and constructible without persistence providers. |

## Test Files Planned

- `backend/src/modules/advisory/access/advisory-access.service.spec.ts`
- `backend/src/modules/advisory/access/advisory-access.controller.spec.ts`
- `frontend/components/layout/__tests__/Sidebar.test.tsx` updates
- `frontend/app/advisory/__tests__/page.test.tsx`

## Duplicate Coverage Control

- Role policy edge cases belong in service unit tests.
- Audit emission and HTTP status belong in backend controller/API tests.
- Sidebar visibility and navigation belong in component tests.
- Page authorization states belong in page component tests.
- No full Playwright E2E is generated for this story because the behavior is covered at lower levels with less flakiness and faster feedback.

## Red Phase Requirements

All planned tests reference files, route modules, client helpers, or exports that do not exist yet or behavior not yet implemented, so they should fail before implementation. Expected initial failure classes:

- Module not found for `backend/src/modules/advisory/...`.
- Missing `/advisory` page and access client.
- Missing ThinkTank item/role filtering in Sidebar.
- Missing audit calls for advisory access.

## Step 3 Result

Proceed to Step 4 test generation.

# ATDD Step 4 - Red Test Generation & Aggregation

## Execution Mode

- Requested mode: `auto`
- Capability probe: enabled
- Agent-team support: unavailable
- Subagent support: unavailable for this run because the user did not request delegation
- Resolved mode: `sequential`
- Execution label: `SEQUENTIAL (API -> E2E)`

## Worker Outputs

- API worker output: `D:\tmp\tea-atdd-api-tests-2026-05-19T02-21-22-9015022+08-00.json`
- E2E/UI worker output: `D:\tmp\tea-atdd-e2e-tests-2026-05-19T02-21-22-9015022+08-00.json`
- Artifact copies:
  - `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-2026-05-19T02-21-22-9015022+08-00.json`
  - `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-2026-05-19T02-21-22-9015022+08-00.json`
  - `_bmad-output/test-artifacts/tmp/tea-atdd-summary-2026-05-19T02-21-22-9015022+08-00.json`

## Generated Red-Phase Files

- `_bmad-output/test-artifacts/atdd-story-1-1-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-1-1-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-1-frontend-red.spec.ts`

## TDD Red Phase Validation

- Total red-phase intent tests: 15
- Backend/API tests: 7
- Frontend/UI tests: 8
- All generated tests include `test.skip()`: pass
- Placeholder assertions (`expect(true).toBe(true)`) found: none
- All tests marked `expected_to_fail`: pass
- Fixture infrastructure created: pass

## Acceptance Coverage

- AC1 covered by frontend navigation visibility, hidden denied-role item, navigation route, and collapsed state tests.
- AC2 covered by backend access response and frontend authorized placeholder tests.
- AC3 covered by frontend no-full-workspace-control assertions.
- AC4 covered by backend opened audit assertion.
- AC5 covered by backend 403 and frontend denied message assertions.
- AC6 covered by backend denied audit assertion.

## Implementation Guidance for Green Phase

- Backend endpoints to implement:
  - `GET /api/advisory/access`
  - `AdvisoryAccessService` role policy helper
  - `AdvisoryAccessController` guarded with `JwtAuthGuard` and `TenantGuard`
  - `AdvisoryModule` imported by `AppModule`
- Frontend surfaces to implement:
  - `frontend/app/advisory/layout.tsx`
  - `frontend/app/advisory/page.tsx`
  - a small advisory access client using existing auth header helper
  - Sidebar ThinkTank entry and frontend role helper

## Step 4 Result

ATDD red-phase generation and aggregation completed. Proceed to Step 5 validation.

# ATDD Step 5 - Validate & Complete

## Validation Result

Status: complete.

Validated against `D:\Csaas\.agents\skills\bmad-testarch-atdd\checklist.md` with project-specific applicability:

- Story acceptance criteria loaded and mapped: pass.
- Framework configuration available for frontend and backend: pass.
- Existing patterns reviewed: pass.
- Knowledge fragments loaded: pass.
- Test level strategy documented and duplicate coverage minimized: pass.
- Red-phase files created: pass.
- All generated tests use `test.skip()`: pass.
- Placeholder assertions found: none.
- CLI sessions cleaned up: N/A, no browser/CLI recording was used.
- Temp artifacts stored in project artifacts: pass, copies exist under `_bmad-output/test-artifacts/tmp/`.
- `data-testid` requirements: N/A by project rule. Tests must adapt to production UI and must not require production-only test IDs.
- Local red-phase execution: not run in ATDD Step 5 because the generated tests are skipped red intent artifacts; implementation verification happens in `bmad-dev-story` with unskipped focused tests.

## Test Files Created

- `_bmad-output/test-artifacts/atdd-story-1-1-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-1-1-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-1-frontend-red.spec.ts`

## Key Assumptions

- Backend REST route will be `GET /api/advisory/access` after Nest global prefixing.
- Frontend role helper mirrors Story 1.1 local policy only; backend remains authoritative.
- Pact/CDC is not introduced because this story adds an in-repo endpoint and no consumer/provider boundary.

## Next Workflow

Proceed to `bmad-dev-story` for Story 1.1 implementation and green-phase focused tests.
