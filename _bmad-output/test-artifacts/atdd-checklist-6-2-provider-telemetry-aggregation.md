---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-22T17:53:58+08:00'
inputDocuments:
  - _bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad-output/planning-artifacts/ux-design-specification-thinktank.md
  - _bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md
  - backend/src/modules/advisory/events/thinktank-event-contract.ts
  - backend/src/modules/advisory/events/thinktank-event-registry.ts
  - backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts
  - backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts
  - backend/src/modules/advisory/provider-gateway/thinktank-prompt-cache-policy.ts
  - backend/src/modules/advisory/operations/advisory-operations.service.ts
  - backend/src/modules/advisory/operations/advisory-operations.types.ts
  - backend/src/modules/audit/audit-log.service.ts
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/contract-testing.md
---

# ATDD Checklist: Story 6.2 Provider Telemetry Aggregation

## Step 1: Preflight & Context Loading

- Story: `_bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md`
- Detected stack: `fullstack`
- Story implementation scope for ATDD: backend aggregation/read-model and optional backend operations endpoint
- Frontend/browser scope: not required unless Story 6.2 changes frontend code
- Test framework evidence:
  - Backend Jest/Nest tests exist under `backend/src/**.spec.ts` and `backend/test/**`
  - Frontend Playwright config exists at `frontend/playwright.config.ts`
  - Existing Story 6.1 operations tests provide local patterns
- Hard requirements status:
  - Acceptance Criteria: present and clear
  - Test framework: present
  - Development environment: present

## Loaded Context Summary

- Epic 6 requires operations monitoring from prior telemetry, with gaps surfaced instead of invented metrics.
- Story 6.2 owns deterministic provider/cache telemetry aggregation, not the Story 6.3 dashboard UI.
- The source of truth is Story 1.4 versioned telemetry in `audit_logs.details`.
- Provider call metrics come from `provider.call_completed`, `provider.call_failed`, and `provider.call_retried`.
- Cache usage comes from `prompt_cache.hit` and `prompt_cache.miss`.
- Tests must use fake telemetry fixtures and must not call live GLM or network providers.

## ATDD Direction From Step 1

- Generate backend unit/acceptance tests first.
- Prefer colocated Jest specs under `backend/src/modules/advisory/operations/`.
- Use deterministic in-memory `AuditLog` row fixtures rather than database integration where service logic is the target.
- Add controller tests only if the backend endpoint is implemented.
- Treat malformed, unversioned, wrong-version, unknown, privacy-unsafe, stale, and unavailable telemetry as explicit instrumentation gaps.

## Step 2: Generation Mode Selection

- Chosen mode: AI generation.
- Reason: Story 6.2 is backend aggregation/read-model work with clear ACs and no UI recording requirement.
- Browser recording: skipped. Story 6.3 owns dashboard UI; Story 6.2 tests should be generated from source contracts, Story 6.1 patterns, and fake telemetry fixtures.

## Step 3: Test Strategy

### AC-to-Test Mapping

| Test ID | Priority | Level | AC | Scenario | Red Phase Expectation |
| --- | --- | --- | --- | --- | --- |
| 6.2-UNIT-001 | P0 | Unit/ATDD | AC1, AC3 | Deterministically aggregate fake provider completed/failed/retried telemetry into calls, success/failure/retry, latency avg/P95, timeout rate, tokens, and cost | Fails until provider telemetry service/types exist |
| 6.2-UNIT-002 | P0 | Unit/ATDD | AC1, AC3 | Compute cache hit/miss/bypass counts and hit rate from prompt-cache telemetry without double-counting provider tokens/cost | Fails until cache aggregation exists |
| 6.2-UNIT-003 | P0 | Unit/ATDD | AC1, AC2 | Group metrics by workflow, Quick Consult, Party Mode, and provider when safe metadata exists | Fails until grouping logic exists |
| 6.2-UNIT-004 | P0 | Unit/ATDD | AC2 | Reject unknown, unversioned, wrong-version, invalid date, non-operational, missing required field, and privacy-unsafe rows as instrumentation gaps | Fails until row validation/gap mapping exists |
| 6.2-UNIT-005 | P1 | Unit/ATDD | AC1, AC2 | Enforce tenant/date scoping, freshness delayed state, and source unavailable state | Fails until filters/freshness behavior exists |
| 6.2-API-006 | P1 | API/Controller | AC1, AC2 | Expose guarded aggregate-only provider telemetry endpoint, with `tenantId=current`, foreign tenant denial, bad date rejection, and no raw content | Fails until endpoint is added |
| 6.2-INT-007 | P1 | Integration/Source Query | AC2 | `AuditLogService` queries provider/cache telemetry from `audit_logs` by tenant/date/event names without new storage | Fails until query method exists |

### Level Selection

- Unit/ATDD service tests are primary because the core risk is deterministic aggregation math and privacy-safe row normalization.
- API/controller tests are required if the endpoint is implemented, because Story 6.3 needs a backend query surface and tenant authorization must be proven.
- Integration/source-query tests should stay focused on `AuditLogService` query construction/behavior rather than a full database stack unless the existing repository test pattern already supports it.
- Browser E2E is intentionally not generated for 6.2 because there is no user-facing dashboard in scope.

### Risk Notes

- P0: wrong cost/token/failure math, tenant leakage, accepting malformed telemetry, or leaking raw prompt/content would make downstream dashboards untrustworthy.
- P1: endpoint guard/default/date behavior and source unavailable handling are important but can be covered at focused backend levels.

### Red Phase Requirements

- New specs must import or instantiate `AdvisoryProviderTelemetryService` and related types before those files exist.
- Endpoint specs must expect `getProviderTelemetry()` and `/advisory/admin/operations/provider-telemetry` before controller support exists.
- Query tests must expect `findThinkTankProviderTelemetryEvents()` before it exists.

## Step 4: RED Tests Generated

- Execution mode: subagent workers.
- API/backend worker output:
  - `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-6-2-provider-telemetry-aggregation-2026-05-22T17-40-28+08-00.json`
  - 11 RED tests across 3 backend files.
- E2E worker output:
  - `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-6-2-provider-telemetry-aggregation-2026-05-22T17-40-28+08-00.json`
  - 0 E2E tests; browser journey is not applicable because Story 6.2 has no UI surface.
- Summary:
  - `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-6-2-provider-telemetry-aggregation-2026-05-22T17-40-28+08-00.json`

### Generated RED Test Files

- `backend/src/modules/advisory/operations/advisory-provider-telemetry.atdd.spec.ts`
  - 5 skipped RED tests for deterministic provider/call/cache aggregation, grouping, contract/privacy gaps, and freshness/unavailable states.
- `backend/src/modules/advisory/operations/advisory-operations-provider-telemetry.controller.atdd.spec.ts`
  - 4 skipped RED tests for the future admin operations provider-telemetry endpoint, guard metadata, filter delegation, tenant/date rejection, and aggregate-only response shape.
- `backend/src/modules/audit/audit-log-provider-telemetry.atdd.spec.ts`
  - 2 skipped RED tests for the future `findThinkTankProviderTelemetryEvents()` source query on `audit_logs`.

### TDD Red Phase Validation

- All generated tests use `test.skip()`.
- No generated test uses placeholder assertions such as `expect(true).toBe(true)`.
- Tests assert expected Story 6.2 behavior before implementation.
- The service RED spec uses skipped-test dynamic imports for not-yet-created 6.2 service files so the current test suite is not broken merely by top-level module resolution.
- Fixture strategy: deterministic inline factories in the generated backend specs; no shared fixture file was needed for RED phase.

### Acceptance Criteria Coverage

- AC1: covered by `6.2-UNIT-001`, `6.2-UNIT-002`, `6.2-UNIT-003`, `6.2-API-007`, and `6.2-INT-007`.
- AC2: covered by `6.2-UNIT-004`, `6.2-UNIT-005`, `6.2-API-006`, `6.2-API-008`, `6.2-API-009`, `6.2-INT-007`, and `6.2-INT-008`.
- AC3: covered by fake provider/cache telemetry rows in `6.2-UNIT-001` and `6.2-UNIT-002`; no live GLM/network is used.

### Green Phase Commands

```bash
npm --workspace backend run test -- advisory-provider-telemetry audit-log-provider-telemetry operations-provider-telemetry --runInBand
npm --workspace backend run test -- advisory-operations advisory-event thinktank-event audit-log --runInBand
npm --workspace backend run build
```

### Implementation Guidance

- Implement `AdvisoryProviderTelemetryService` and its types under `backend/src/modules/advisory/operations/`.
- Extend `AuditLogService` with `findThinkTankProviderTelemetryEvents()` rather than adding new storage.
- Extend `AdvisoryOperationsController` with `GET /advisory/admin/operations/provider-telemetry` only as a backend aggregate endpoint; no frontend dashboard belongs in Story 6.2.
- Keep provider call cost/tokens sourced from provider events and cache usage sourced from prompt-cache events to prevent double counting.

## Step 5: Validate & Complete

### Validation Results

- Checklist validation: complete for Story 6.2 backend ATDD scope.
- CLI/browser cleanup: not applicable; no browser recording session was opened for this backend-only story.
- Temp artifacts: stored under `_bmad-output/test-artifacts/tmp/`.
- Output polish: duplicate sections checked; acceptance criteria, test IDs, risk notes, and generated file paths are consistent.

### RED Verification Command

```bash
npm --workspace backend run test -- advisory-provider-telemetry audit-log-provider-telemetry operations-provider-telemetry --runInBand
```

Result:

- Test suites: 3 skipped, 0 of 3 total.
- Tests: 11 skipped, 11 total.
- Exit code: 0.
- Interpretation: RED acceptance specs are present, syntactically valid, and intentionally skipped until DEV removes `test.skip()` during the green phase.

### Completion Summary

- Test files created: 3 backend ATDD spec files.
- Checklist output path: `_bmad-output/test-artifacts/atdd-checklist-6-2-provider-telemetry-aggregation.md`.
- Key assumption: Story 6.2 owns backend aggregation/read-model only; dashboard UI remains Story 6.3.
- Next workflow: `bmad-dev-story 6-2-provider-telemetry-aggregation`.
