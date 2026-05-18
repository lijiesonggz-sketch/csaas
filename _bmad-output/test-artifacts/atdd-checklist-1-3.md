---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-19T03:45:18+08:00'
inputDocuments:
  - _bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/fixture-architecture.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/overview.md
  - _bmad/tea/testarch/knowledge/api-request.md
  - _bmad/tea/testarch/knowledge/auth-session.md
  - _bmad/tea/testarch/knowledge/recurse.md
  - _bmad/tea/testarch/knowledge/network-recorder.md
  - _bmad/tea/testarch/knowledge/intercept-network-call.md
  - _bmad/tea/testarch/knowledge/log.md
  - _bmad/tea/testarch/knowledge/file-utils.md
  - _bmad/tea/testarch/knowledge/network-error-monitor.md
  - _bmad/tea/testarch/knowledge/fixtures-composition.md
  - _bmad/tea/testarch/knowledge/playwright-cli.md
  - _bmad/tea/testarch/knowledge/ci-burn-in.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-overview.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-consumer-helpers.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-provider-verifier.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-request-filter.md
  - _bmad/tea/testarch/knowledge/pact-mcp.md
---

# ATDD Checklist - Story 1.3 Tenant Isolation Foundation

## Step 01 - Preflight and Context

- Detected stack: `fullstack`.
- Backend framework: NestJS + Jest from `backend/package.json`.
- Frontend framework: Next.js + Jest + Playwright from `frontend/package.json` and `frontend/playwright.config.ts`.
- Story file loaded: `_bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md`.
- Story status: `ready-for-dev`.
- Acceptance criteria are clear and testable.
- Primary ATDD focus: backend repository/service isolation tests. Frontend E2E is not required unless implementation changes frontend behavior.
- P0 risks:
  - Tenant filter omitted or overwritten in repository queries.
  - Caller-supplied `tenantId` mutates a record into another tenant.
  - Story 1.2 `advisory_module_configs` continues to use raw TypeORM access instead of the shared tenant repository contract.
  - RLS wording is treated as MVP blocker instead of documented post-MVP hardening.
- Hard prerequisites present: source story, Jest backend test setup, frontend Playwright setup, and development environment.

## Step 02 - Generation Mode

- Chosen mode: AI generation.
- Reason: Story 1.3 has clear backend/security acceptance criteria and does not require live UI selector discovery or complex browser recording.
- Recording mode skipped: no frontend behavior is expected to change for this story; Playwright CLI/MCP is unnecessary for ATDD red coverage here.
- Test artifact direction: generate backend Jest failing specs plus a compact ATDD summary artifact.

## Step 03 - Test Strategy

| Test ID | AC | Priority | Level | Red-phase scenario |
| --- | --- | --- | --- | --- |
| `1.3-UNIT-001` | AC1 | P0 | Unit | `BaseRepository.create()` overwrites malicious caller `tenantId` with scoped tenant id. |
| `1.3-UNIT-002` | AC1 | P0 | Unit | `BaseRepository.update()` strips caller `tenantId` before TypeORM mutation. |
| `1.3-UNIT-003` | AC1/AC2 | P0 | Unit | `BaseRepository.findAll()` injects scoped tenant id into every branch of array `where` options. |
| `1.3-UNIT-004` | AC2 | P0 | Unit | `BaseRepository.update()` and `delete()` always include scoped `{ id, tenantId }` criteria. |
| `1.3-INT-001` | AC1/AC2 | P0 | Integration-style unit | `AdvisoryAdminService` must use a tenant-scoped advisory config repository, not raw TypeORM repository calls. |
| `1.3-INT-002` | AC2 | P0 | Integration-style unit | Tenant A cannot read or update Tenant B's `advisory_module_configs` row. |
| `1.3-INT-003` | AC2 | P0 | Integration-style unit | Malicious update payload containing Tenant B id cannot overwrite or move Tenant B config. |
| `1.3-NFR-001` | AC3/AC5 | P1 | Evidence/static | Story evidence documents MVP `tenantId + BaseRepository`, RLS post-MVP, and future entity first-use ownership. |
| `1.3-NFR-002` | AC4 | P1 | Evidence/static | Story evidence documents TLS 1.2+ and AES-256-at-rest as inherited production infrastructure requirements with no invented app crypto. |

Red phase expectation:

- `1.3-UNIT-002` fails against the current `BaseRepository.update()` because it passes caller data directly to TypeORM `update()`.
- `1.3-UNIT-003` fails if array `where` options are not tenant-injected branch by branch.
- `1.3-INT-001` fails until a tenant-scoped advisory config repository/wrapper exists.
- Evidence checks fail until Story 1.3 Dev Agent Record is updated during implementation.

Coverage boundaries:

- No frontend/component/E2E tests are generated for Story 1.3 because no user-facing UI behavior changes are required.
- No Pact contract tests are generated because this story does not introduce a new external consumer/provider contract.
- Later first-use stories must generate their own entity-specific cross-tenant isolation tests for runtime tables that do not exist yet.

## Step 04C - Aggregated RED Test Generation

TDD red phase validation: PASS.

- API worker output: `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-3-2026-05-19T03-42-08+08-00.json`
- E2E worker output: `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-3-2026-05-19T03-42-08+08-00.json`
- Summary output: `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-3-2026-05-19T03-42-08+08-00.json`
- Backend RED tests written: `_bmad-output/test-artifacts/atdd-story-1-3-backend-red.spec.ts`
- Fixture artifact written: `_bmad-output/test-artifacts/atdd-story-1-3-fixtures.ts`

Summary:

- Total RED tests: 7.
- API/backend tests: 7.
- E2E tests: 0, intentionally not applicable because Story 1.3 has no frontend journey.
- All generated tests use `test.skip()` and assert expected behavior, not placeholders.
- Fixture needs aggregated: `mockTypeOrmRepository`, `tenantScopedAdvisoryModuleConfigFactory`.

Acceptance criteria coverage:

- AC1: covered by BaseRepository create/update/find tests.
- AC2: covered by scoped mutation/delete and advisory module config repository tests.
- AC3: covered by story implementation evidence requirement; no future entity tests generated before first use.
- AC4: covered by story implementation evidence requirement for inherited TLS/AES policy.
- AC5: covered by code tests and implementation evidence requirement documenting MVP `tenantId + BaseRepository`.

Next TDD green phase guidance:

1. Move the RED intent into source-level Jest tests during `bmad-dev-story`.
2. Remove `test.skip()` only when implementation is ready to prove the behavior.
3. Keep frontend E2E unchanged unless implementation touches frontend behavior.

## Step 05 - Validation and Completion

Validation result: PASS.

- Prerequisites satisfied: Story file exists, acceptance criteria are clear, backend Jest and frontend Playwright/Jest configuration are present.
- Test files created correctly under `_bmad-output/test-artifacts/` for ATDD handoff.
- Temp artifacts are stored under `_bmad-output/test-artifacts/tmp/`, not random OS temp locations.
- CLI sessions cleaned up: N/A. No Playwright CLI session was opened because Story 1.3 has no UI selector discovery need.
- Static RED compliance check passed:
  - 7 `test.skip()` entries found in the generated backend RED spec.
  - No placeholder `expect(true).toBe(true)` assertions.
  - No hard waits or UI selector anti-patterns in generated artifacts.
- RED phase local execution: not run by design because these ATDD artifacts are skipped handoff tests outside the source test tree. `bmad-dev-story` must convert the RED intent into source-level Jest specs, remove skips only after implementation, and then prove green.

Completion summary:

- Test files created:
  - `_bmad-output/test-artifacts/atdd-story-1-3-backend-red.spec.ts`
  - `_bmad-output/test-artifacts/atdd-story-1-3-fixtures.ts`
- Checklist output:
  - `_bmad-output/test-artifacts/atdd-checklist-1-3.md`
- Key assumptions:
  - Story 1.3 has no frontend UI journey.
  - No new external API/Pact contract is introduced.
  - RLS remains post-MVP hardening; MVP evidence must document `tenantId + BaseRepository`.
- Next workflow:
  - Continue to `bmad-dev-story` for Story 1.3 implementation.
