# Code Review - Story 1.4 Audit and Telemetry Event Foundation

**Date:** 2026-05-19
**Scope:** Current Story 1.4 uncommitted backend and BMAD artifact changes
**Mode:** Full review against `_bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md`

## Result

PASS after one patch finding was fixed.

## Findings

### Fixed

1. **Metadata could override reserved contract fields**
   - Category: patch
   - Severity: High
   - Location: `backend/src/modules/advisory/events/thinktank-event-contract.ts`
   - Detail: `metadata` keys are normalized to snake_case and were originally merged after required contract fields, so a caller could provide metadata such as `tenantId` and override trusted `tenant_id`.
   - Resolution: Added reserved metadata key rejection and a regression test in `thinktank-event-contract.spec.ts`.

2. **Subject type lacked a typed contract value**
   - Category: patch
   - Severity: Medium
   - Location: `backend/src/modules/advisory/events/thinktank-event-contract.ts`
   - Detail: The story requested typed enums/consts for subject type where needed. The initial implementation accepted plain strings only.
   - Resolution: Added `ThinkTankSubjectType` and used it in current access/admin emitters.

## Verification After Fix

- `PASS cd backend && npm run test -- advisory-event thinktank-event thinktank-audit-retention advisory-access advisory-admin audit-log --runInBand` (11 suites, 57 tests)
- `PASS cd backend && npx tsc --noEmit`
- `KNOWN UNRELATED FAILURES cd backend && npm test -- --runInBand`:
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-003]`
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-007]`
  - `taxonomy-domain-gate.atdd-8-2.spec.ts` `[8.2-SVC-003][P1]`

## Final Review Conclusion

No blocking Story 1.4 review findings remain.

## Rerun - 2026-05-20

**Scope:** `3f0b044^..3f0b044` (`feat: complete story 1-4`) with full review against `_bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md`.

### Findings Fixed

1. **Audit `changes` bypassed raw sensitive key validation**
   - Category: patch
   - Severity: High
   - Location: `backend/src/modules/advisory/events/advisory-event.service.ts`
   - Detail: `metadata` was validated by the ThinkTank event contract, but `changes` was persisted separately to `AuditLog.changes`, allowing keys such as `prompt`, `content`, `conversation`, or `report` to bypass the privacy guard.
   - Resolution: Exported the recursive raw sensitive key guard and now validates `changes` before audit persistence. Added strict audit regression coverage.

2. **Fail-safe audit could still throw during event preparation**
   - Category: patch
   - Severity: Medium
   - Location: `backend/src/modules/advisory/events/advisory-event.service.ts`
   - Detail: `emitAudit()` called normalization before entering the fail-safe `AuditLogService.log()` path. Invalid event preparation could interrupt opened/denied access flows.
   - Resolution: Wrapped non-strict audit preparation and logging in `emitAudit()`; `emitAuditStrict()` still fails closed for control-plane events. Added regression coverage.

3. **`subject_type` accepted arbitrary strings**
   - Category: patch
   - Severity: Medium
   - Location: `backend/src/modules/advisory/events/thinktank-event-contract.ts`
   - Detail: `ThinkTankSubjectType` existed, but normalization only required a non-empty string.
   - Resolution: Added enum validation for `subject_type` and regression coverage for unknown values.

4. **Telemetry numeric fields accepted invalid values**
   - Category: patch
   - Severity: Low
   - Location: `backend/src/modules/advisory/events/thinktank-event-contract.ts`
   - Detail: `latency_ms`, `estimated_tokens`, and `estimated_cost` accepted negative, `NaN`, or infinite values; token counts also accepted fractions.
   - Resolution: Added non-negative finite number validation and non-negative integer validation for tokens.

### Verification After Rerun Fix

- `PASS npm --workspace backend run test -- advisory-event thinktank-event thinktank-audit-retention advisory-access advisory-admin audit-log --runInBand` (11 suites, 63 tests)
- `PASS npm --workspace backend exec -- tsc --noEmit`
- `PASS npm --workspace backend exec -- eslint src/modules/advisory/events/advisory-event.service.ts src/modules/advisory/events/advisory-event.service.spec.ts src/modules/advisory/events/thinktank-event-contract.ts src/modules/advisory/events/thinktank-event-contract.spec.ts`
- `PASS` second-pass subagent review of the four changed files.
