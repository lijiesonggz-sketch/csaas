# Code Review - Story 1.3 Tenant Isolation Foundation

Date: 2026-05-19
Review mode: full story review
Spec: `_bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md`
Scope: Story 1.3 uncommitted working tree changes, including new advisory repository files

## Review Layers

- Blind Hunter: reviewed shared repository hardening and advisory service wrapper migration from the diff.
- Edge Case Hunter: reviewed TypeORM `where` branch boundaries, tenant mutation paths, and advisory config read/update/delete scope.
- Acceptance Auditor: checked implementation against AC1-AC5 and Story 1.3 scope boundaries.

Subagents were not used because this pipeline is running in the current agent workspace without explicit subagent delegation authorization; findings were produced in-process using the same three review perspectives.

## Findings and Triage

### PATCH-1 - Empty TypeORM OR arrays did not preserve tenant predicate

Severity: Medium
Sources: edge + auditor
Locations:

- `backend/src/database/repositories/base.repository.ts`
- `backend/src/database/repositories/base.repository.spec.ts`

Details:

The new `addTenantFilter()` correctly injected `tenantId` into populated array `where` branches, but `where: []` returned an empty array unchanged. Depending on TypeORM interpretation, an empty OR array can become an unscoped or surprising query shape. Story 1.3 requires repository APIs to automatically apply tenant scope and support TypeORM array `where` options without losing tenant filtering.

Acceptance impact:

- AC1: tenant scope must be automatically applied through `BaseRepository`.
- AC2: cross-tenant reads and mutations must be rejected for current data surfaces.

Resolution:

- Updated `addTenantFilter()` to collapse an empty array `where` into the required scoped object predicate.
- Added tests for `findAll`, `findOne`, and `count` with `where: []`.

Status: fixed.

## Triage Summary

- intent_gap: 0
- bad_spec: 0
- patch: 1, fixed
- defer: 0
- rejected as noise: 0

## Verification After Review Fix

- PASS `cd backend && npm run test -- base.repository advisory --runInBand` (7 suites, 47 tests)
- PASS `cd backend && npx tsc --noEmit`
- PASS `cd backend && npm run orm:entities:parity` (1 suite, 3 tests)
- KNOWN UNRELATED FAILURES `cd backend && npm test -- --runInBand`: `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-003]`, `[P0][6.5-AUTO-007]`; `taxonomy-domain-gate.atdd-8-2.spec.ts` `[8.2-SVC-003][P1]`.

## Review Decision

PASS after fix. No blocking Story 1.3 code-review findings remain.

---

## 2026-05-20 Rerun Review With Subagents

Review mode: full story review rerun
Spec: `_bmad-output/implementation-artifacts/1-3-tenant-isolation-foundation.md`
Scope: committed Story 1.3 diff `370606c..942add5`, then current workspace fix diff.

### Subagent Layers

- Blind Hunter: found empty `where: []` broadening, mutable `id` update payload, delete affected result swallowing, trace/gate evidence wording issues, and skipped ATDD evidence caveat.
- Edge Case Hunter: found missing runtime rejection for empty tenant/id scope, delete affected result swallowing, and first-use get-or-create unique conflict race.
- Acceptance Auditor: found missing cross-tenant delete rejection proof for `advisory_module_configs`.

### Triage

- PATCH fixed:
  - Empty `where: []` now short-circuits to no matches for `findAll`, `findOne`, and `count` instead of broadening to tenant-wide results.
  - `BaseRepository` now rejects empty `tenantId` and empty `id` before building TypeORM criteria.
  - Runtime TypeORM configs now set `invalidWhereValuesBehavior` to throw on `null` and `undefined`.
  - `BaseRepository.update()` now strips immutable `id`, `tenantId`, and `createdAt` from update payloads.
  - `BaseRepository.delete()` and `AdvisoryModuleConfigRepository.deleteForTenant()` now return boolean success based on `affected`.
  - Added negative delete coverage for scoped miss / cross-tenant row attempts.
  - `AdvisoryAdminService.getOrCreateConfig()` now recovers from first-use unique constraint races by reloading the concurrently created tenant config.
  - Post-fix review found that global `invalidWhereValuesBehavior.null = 'throw'` would break existing intentional SQL NULL queries. Updated repository `findActive()` paths and radar peer relevance lookup to use `IsNull()`, then added regression coverage.
- DEFER / documentation caveat:
  - Full backend regression was already red from unrelated taxonomy-domain-gate suites in the original Story 1.3 evidence. This rerun verified the Story 1.3 focused surface and did not reclassify unrelated full-suite failures.
  - Skipped ATDD artifacts remain design/handoff artifacts, not executable validation evidence.

### Verification After 2026-05-20 Fixes

- PASS `npm --workspace backend run test -- base.repository advisory-module-config.repository advisory-admin.service --runInBand` (3 suites, 42 tests)
- PASS `npm --workspace backend run test -- soft-delete-null.repository peer-relevance.service base.repository advisory --runInBand` (15 suites, 120 tests)
- PASS `npm --workspace backend exec -- tsc --noEmit`
- PASS `npm --workspace backend run orm:entities:parity` (1 suite, 3 tests)
- PASS `rg -n "deletedAt:\s*null" backend\src -g "*.ts"` now returns only test fixture/data occurrences, not production TypeORM where predicates.

### Rerun Decision

PASS after fixes. No HIGH or MEDIUM Story 1.3 review findings remain in the focused tenant-isolation surface.
