# Code Review - Story 1.2 Tenant Module Enablement and Role Permissions

Date: 2026-05-19
Review mode: full story review
Spec: `_bmad-output/implementation-artifacts/1-2-tenant-module-enablement-and-role-permissions.md`
Scope: Story 1.2 uncommitted working tree changes, including untracked Story 1.2 files

## Review Layers

- Blind Hunter: reviewed changed behavior from diff shape and client/server contracts.
- Edge Case Hunter: reviewed access-control boundaries, response envelopes, tenant config role binding, and disabled states.
- Acceptance Auditor: checked implementation against Story 1.2 AC1-AC8 and Dev Notes.

Subagents were not used because this pipeline is running in the current agent workspace; findings were produced in-process using the same three review perspectives.

## Findings and Triage

### PATCH-1 - Frontend clients misread backend-wrapped ThinkTank envelopes

Severity: High
Sources: blind + edge + auditor
Locations:

- `frontend/lib/advisory/access.ts`
- `frontend/lib/advisory/admin-config.ts`
- `backend/src/common/interceptors/transform.interceptor.ts`
- `backend/src/modules/advisory/access/advisory-access.controller.ts`
- `backend/src/modules/advisory/admin/advisory-admin.controller.ts`

Details:

The backend controllers return ThinkTank-owned `{ data: ... }` envelopes, while the global `TransformInterceptor` wraps any object without a `success` property into `{ success: true, data: ... }`. The resulting runtime shape is `{ success: true, data: { data: ... } }`. The frontend clients read only `body.data.allowed` and `body.data`, so authorized access could be interpreted as denied, and the admin configuration page could receive the nested envelope instead of the config.

Acceptance impact:

- AC1: authorized users may not see/open ThinkTank.
- AC2: admin config screen may not render the module config correctly.
- AC4/AC7: access behavior would not reliably reflect backend module config and RBAC state.

Resolution:

- Added `frontend/lib/advisory/envelope.ts` to unwrap direct, single-wrapped, and double-wrapped advisory response envelopes.
- Updated `fetchThinkTankAccess`, `fetchAdvisoryModuleConfig`, and `updateAdvisoryModuleConfig` to use the shared unwrap/message helpers.
- Added focused client tests for nested backend/global response envelopes.
- Added admin proxy route coverage to prove request/session authorization forwarding and PUT body forwarding.

Status: fixed.

### PATCH-2 - Sidebar still excluded `respondent` before checking tenant config

Severity: High
Sources: edge + auditor
Locations:

- `frontend/lib/advisory/access.ts`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/__tests__/Sidebar.test.tsx`

Details:

Story 1.2 allows tenant admins to bind ThinkTank access to any CSAAS role: `admin`, `consultant`, `client_pm`, or `respondent`. The Sidebar pre-check still used the Story 1.1 static allowlist of `admin`, `consultant`, and `client_pm`, which prevented `respondent` users from even calling the backend access endpoint. If a tenant admin explicitly enabled `respondent`, those users would still not see the module navigation.

Acceptance impact:

- AC1: an authorized tenant user could fail to see the module.
- AC7: role-binding changes would not fully take effect in frontend navigation.

Resolution:

- Updated frontend role pre-check so every CSAAS role is a backend-check candidate.
- Kept the backend authoritative: Sidebar still hides ThinkTank when `/api/advisory/access` denies access.
- Added Sidebar coverage for both backend-denied and backend-allowed `respondent` cases.

Status: fixed.

## Triage Summary

- intent_gap: 0
- bad_spec: 0
- patch: 2, both fixed
- defer: 0
- rejected as noise: 0

## Verification After Review Fixes

- PASS `cd frontend && npm run test -- advisory Sidebar --runInBand` (6 suites, 44 tests)
- PASS `cd frontend && npx tsc --noEmit`

## Review Decision

PASS after fixes. No blocking Story 1.2 code-review findings remain.

---

## 2026-05-20 Rerun - Access Proxy and Audit Regression Review

Scope: Story 1.2 advisory access changes in the current working tree.

Findings:

- HIGH: access opened/denied audit had been switched to strict audit, which could turn normal allowed/denied access checks into 500 responses if audit persistence failed. Fixed by keeping access audit on fail-safe `emitAudit`; strict audit remains reserved for control-plane module config changes.
- MEDIUM: `/api/advisory/access` had removed request `Authorization` fallback and diverged from the existing advisory admin proxy token pattern. Fixed by preserving the existing route behavior and adding focused route tests for request-token proxying, session-token fallback, no-token 401, and backend denial propagation.

Verification:

- PASS `npm run test -- app/api/advisory/access/route.test.ts --runInBand` in `frontend` (4 tests).
- PASS `npm run test -- advisory-access --runInBand` in `backend` (10 tests).
- PASS `npx tsc --noEmit` in `frontend`.
- PASS `npx tsc --noEmit` in `backend`.

Decision: PASS after fixes.
