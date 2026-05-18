---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-19T04:18:00+08:00'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md
  - backend/src/modules/audit/audit-log.service.ts
  - backend/src/database/entities/audit-log.entity.ts
  - backend/src/modules/advisory/access/advisory-access.service.ts
  - backend/src/modules/advisory/admin/advisory-admin.service.ts
  - backend/package.json
  - frontend/playwright.config.ts
---

# ATDD Checklist - Epic 1, Story 4: Audit and Telemetry Event Foundation

**Date:** 2026-05-19T04:18:00+08:00
**Author:** leo
**Primary Test Level:** Backend unit/service integration

## Story Summary

Story 1.4 creates the shared versioned ThinkTank audit/telemetry event contract and registry. It retrofits current Epic 1 access and module-configuration events, enforces no raw sensitive content by default, and documents retention/data-localization evidence.

**As a** platform operator
**I want** critical ThinkTank actions to emit consistent audit and telemetry events
**So that** security, compliance, and future operations views can rely on trustworthy data

## Acceptance Criteria

1. Critical ThinkTank actions emit a structured versioned event contract with required fields, applicable optional fields, and no raw sensitive conversation content by default.
2. Future advisory backend stories use this shared event contract and test success/failure event emission.
3. Feature stories that emit events list owned event names and test tenant scoping, correlation id, version, outcome, privacy classification, and privacy exclusions.
4. Audit retention defaults to at least 180 days and production storage respects data-localization requirements.

## Test Strategy

| Scenario | Level | Priority | RED behavior |
| --- | --- | --- | --- |
| Contract normalization writes required snake_case fields and optional metadata | Unit | P0 | Fails because contract module is missing |
| Registry exposes the exact initial audit/telemetry event names and rejects unknown/wrong-kind events | Unit | P0 | Fails because registry module is missing |
| Privacy guard rejects raw sensitive payload keys | Unit | P0 | Fails because validation helper is missing |
| Advisory event emitter persists audit events through existing `AuditLogService` with canonical details | Service integration | P0 | Fails because `AdvisoryEventService` is missing |
| Current access/admin emitters produce canonical fields and omit raw content | Service regression | P0 | Fails because current code still emits legacy `details.eventName` directly |
| Retention guard keeps ThinkTank audit retention >= 180 days and preserves existing 365-day default | Unit | P1 | Fails because retention helper is missing |

E2E/browser coverage is not applicable in ATDD for this story because Story 1.4 does not introduce a user-facing UI flow. Existing frontend behavior is covered by Story 1.1/1.2 regressions if touched later.

## Failing Tests Created (RED Phase)

### Backend Jest Tests (6 skipped RED tests)

**File:** `_bmad-output/test-artifacts/atdd-story-1-4-backend-red.spec.ts`

- `[P0][1.4-CONTRACT-001] normalizes every required ThinkTank event contract field`
  - **Status:** RED with `test.skip()` - unskip after implementation to verify the contract module.
  - **Verifies:** required fields, optional fields, event version, correlation id, privacy classification.
- `[P0][1.4-REGISTRY-001] exposes the exact initial audit and telemetry registry`
  - **Status:** RED with `test.skip()` - unskip after registry implementation.
  - **Verifies:** exact event-name inventory and fail-closed registry validation.
- `[P0][1.4-PRIVACY-001] rejects raw sensitive content keys by default`
  - **Status:** RED with `test.skip()` - unskip after privacy guard implementation.
  - **Verifies:** no raw conversation/message/prompt/content/report/context payloads by default.
- `[P0][1.4-EMIT-001] persists access events through AuditLogService with canonical snake_case details`
  - **Status:** RED with `test.skip()` - unskip after advisory event service implementation.
  - **Verifies:** storage reuse, canonical details, and existing audit column compatibility.
- `[P0][1.4-CURRENT-001] current access/admin emitters include contract fields and no raw content`
  - **Status:** RED with `test.skip()` - unskip after retrofitting services.
  - **Verifies:** access opened and module enabled current emitters use the contract.
- `[P1][1.4-RETENTION-001] enforces ThinkTank audit retention >= 180 days without weakening existing 365-day default`
  - **Status:** RED with `test.skip()` - unskip after retention helper implementation.
  - **Verifies:** NFR13 retention lower bound and existing stronger default.

### E2E Tests (0 tests)

No E2E test file was created because there is no new user-visible flow, page, route, or selector in this story. Browser recording was intentionally skipped.

## Data Factories Created

**File:** `_bmad-output/test-artifacts/atdd-story-1-4-fixtures.ts`

Exports deterministic tenant, actor, subject, correlation id, expected registry arrays, and raw-sensitive payload keys. No `@faker-js/faker` usage is needed because these are contract fixtures, not persisted user data factories.

## Fixtures Created

N/A. The RED tests are backend Jest contract/service tests and use inline mocks for `AuditLogService`.

## Mock Requirements

- `AuditLogService.log` must be mockable for fail-safe access events.
- `AuditLogService.logStrict` must be mockable for strict module configuration events.
- `AdvisoryModuleConfigRepository` can be represented by a narrow in-memory mock matching Story 1.3 service tests.

## Required data-testid Attributes

N/A. No UI is introduced by Story 1.4, and project instructions prohibit adding production `data-testid` solely for tests.

## Implementation Checklist

### Test: `[P0][1.4-CONTRACT-001]`

- [ ] Add `backend/src/modules/advisory/events/thinktank-event-contract.ts`.
- [ ] Export event version, enums/constants, and `normalizeThinkTankEvent()`.
- [ ] Normalize camelCase input to canonical snake_case persisted details.
- [ ] Generate `correlation_id` when missing and preserve explicit correlation id.
- [ ] Run focused event contract tests.

### Test: `[P0][1.4-REGISTRY-001]`

- [ ] Add `backend/src/modules/advisory/events/thinktank-event-registry.ts`.
- [ ] Encode exact audit and telemetry names from Story 1.4.
- [ ] Reject unknown event names and audit/telemetry kind mismatches.
- [ ] Keep future runtime names in registry only; do not emit them yet.

### Test: `[P0][1.4-PRIVACY-001]`

- [ ] Add default raw-sensitive key guard.
- [ ] Cover `conversation`, `message`, `messages`, `prompt`, `content`, `rawContent`, `report`, `document`, `enterpriseContext`, and `attachments`.
- [ ] Allow only structured non-raw operational metadata.

### Test: `[P0][1.4-EMIT-001]`

- [ ] Add `backend/src/modules/advisory/events/advisory-event.service.ts`.
- [ ] Reuse `AuditLogService` and existing `audit_logs` storage.
- [ ] Store canonical snake_case details and preserve existing entity columns for queries.
- [ ] Add provider registration in `AdvisoryModule`.

### Test: `[P0][1.4-CURRENT-001]`

- [ ] Update `AdvisoryAccessService` to emit through the shared event service.
- [ ] Update `AdvisoryAdminService` to emit module config events through the shared event service.
- [ ] Update latest audit summary reads to prefer canonical snake_case fields and fall back to legacy camelCase.
- [ ] Preserve Story 1.1/1.2 behavior and tests.

### Test: `[P1][1.4-RETENTION-001]`

- [ ] Add ThinkTank audit retention helper/constant with default >= 365 and lower bound >= 180.
- [ ] Add tests proving lower values are rejected or normalized.
- [ ] Document data-localization evidence as existing regional CSAAS PostgreSQL storage; do not add external sinks.

## Running Tests

```bash
# RED artifact is intentionally skipped until implementation begins.
# Copy or adapt assertions into colocated backend specs, then unskip:
cd backend && npm run test -- advisory-event advisory-access advisory-admin audit-log --runInBand

# Required story verification after implementation:
cd backend && npm run orm:entities:parity
cd backend && npx tsc --noEmit
cd backend && npm test -- --runInBand
```

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- Skipped RED tests and fixtures generated.
- Acceptance criteria mapped to P0/P1 backend coverage.
- E2E/browser coverage explicitly marked not applicable.

### GREEN Phase (DEV)

1. Move RED assertions into colocated backend specs or unskip the artifact test in a controlled way.
2. Implement one missing contract/service behavior at a time.
3. Run focused backend tests after each implementation slice.
4. Preserve Story 1.1-1.3 regressions.

### REFACTOR Phase

1. Consolidate duplicate event field mapping.
2. Keep event service narrow and avoid schema churn.
3. Re-run focused tests, entity parity, TypeScript, and broader backend regression.

## Knowledge Base References Applied

- `data-factories.md` - deterministic contract fixtures with explicit overrides where needed.
- `test-quality.md` - focused tests, no hard waits, no placeholders, explicit assertions.
- `test-levels-framework.md` - backend unit/service integration selected over browser E2E.
- `test-priorities-matrix.md` - P0 for security/compliance/tenant/privacy contract, P1 for retention evidence.
- `test-healing-patterns.md` - no selector/timing patterns needed because no browser flow.
- `pactjs-utils-*` and `pact-mcp.md` - reviewed; Pact not applicable because no consumer/provider HTTP contract is introduced by this story.

## Test Execution Evidence

The RED tests are intentionally `test.skip()` artifacts. They are not run as part of CI until implementation adapts/unskips them. Expected pre-implementation failures after unskip are missing modules:

- `backend/src/modules/advisory/events/thinktank-event-contract`
- `backend/src/modules/advisory/events/thinktank-event-registry`
- `backend/src/modules/advisory/events/advisory-event.service`
- `backend/src/modules/advisory/events/thinktank-audit-retention`

## Notes

- The repository is fullstack, but Story 1.4 is backend/security infrastructure only.
- No `data-testid` attributes are required or allowed for this story.
- Full backend regression may still show unrelated taxonomy-domain-gate failures from Story 1.3 evidence.

**Generated by BMad TEA Agent** - 2026-05-19T04:18:00+08:00
