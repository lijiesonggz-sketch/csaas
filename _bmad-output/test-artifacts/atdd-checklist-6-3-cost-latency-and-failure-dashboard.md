---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-23T02:25:00+08:00'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md
  - _bmad-output/implementation-artifacts/6-1-usage-and-completion-dashboard.md
  - _bmad-output/implementation-artifacts/6-2-provider-telemetry-aggregation.md
  - backend/src/modules/advisory/operations/advisory-provider-telemetry.types.ts
  - frontend/lib/advisory/operations.ts
  - frontend/app/api/advisory/admin/operations/usage/route.ts
  - frontend/app/admin/advisory/operations/page.tsx
  - frontend/e2e/advisory-operations-dashboard.atdd.spec.ts
---

# ATDD Checklist: Story 6.3 Cost, Latency, and Failure Dashboard

## Step 1: Preflight & Context Loading

- Story: `_bmad-output/implementation-artifacts/6-3-cost-latency-and-failure-dashboard.md`
- Detected stack: `fullstack`
- Primary implementation scope: frontend client/proxy, operations dashboard UI, and Playwright coverage.
- Backend source of truth: Story 6.2 `GET /advisory/admin/operations/provider-telemetry`; no new storage, migrations, jobs, backfill, live GLM, or frontend raw audit recomputation.
- Test framework evidence:
  - Jest config: `frontend/jest.config.js`
  - Playwright config: `frontend/playwright.config.ts`
  - Existing operations patterns: Story 6.1 client/proxy/page/E2E tests.

## Step 2: Generation Mode Selection

- Chosen mode: AI generation with existing source-pattern inspection.
- Browser recording: skipped. The existing operations dashboard selectors are stable enough for RED coverage, and no live browser session was needed.
- CLI session cleanup: N/A; no browser recording session opened.

## Step 3: Test Strategy

| Test ID | Priority | Level | AC | Scenario |
| --- | --- | --- | --- | --- |
| 6.3-UNIT-001 | P1 | Client unit | AC1, AC2 | Normalize 6.2 provider aggregates into metrics/groups and derive threshold breaches. |
| 6.3-UNIT-002 | P1 | Client unit | AC1 | Fetch provider telemetry through Next proxy with safe filters only, suppressing `tenantId=current` and raw/actor filters. |
| 6.3-UNIT-003 | P1 | Client unit | AC3 | Propagate 401/403 errors and normalize 503 unavailable envelopes as untrusted data. |
| 6.3-UNIT-004 | P1 | Client unit | AC3 | Treat unavailable telemetry as no trusted measurements rather than successful zeros. |
| 6.3-API-001 | P1 | Proxy API | AC1 | Forward only whitelisted filters and request authorization to the 6.2 backend endpoint. |
| 6.3-API-002 | P1 | Proxy API | AC1, AC2 | Reject duplicate query filters before proxying. |
| 6.3-API-003 | P1 | Proxy API | AC2, AC3 | Preserve 401, upstream 403, and 503 unavailable bodies/statuses. |
| 6.3-COMP-001 | P1 | Component | AC1 | Render latency, failures, tokens, cost, cache, and workflow/experience/provider groups. |
| 6.3-COMP-002 | P1 | Component | AC2 | Render threshold breach text, icon/badge labeling, tenant, scope, and time window. |
| 6.3-COMP-003 | P1 | Component | AC3 | Render unavailable provider telemetry without misleading zero cards or raw content. |
| 6.3-E2E-001 | P1 | E2E | AC1, AC2 | Dashboard shows provider metrics, groups, threshold warnings, and freshness context. |
| 6.3-E2E-002 | P1 | E2E | AC1 | Shared filters are included in provider telemetry requests. |
| 6.3-E2E-003 | P1 | E2E | AC3 | Unavailable provider telemetry hides successful zero measurements and private raw strings. |

## Step 4: RED Tests Generated

Generated and intentionally skipped RED coverage:

- `frontend/lib/advisory/operations.test.ts`
  - Provider telemetry normalization, threshold breach derivation, safe query construction, unavailable handling, auth/tenant error propagation, and raw sensitive content suppression.
- `frontend/app/api/advisory/admin/operations/provider-telemetry/route.test.ts`
  - Next proxy auth resolution, whitelist filtering, duplicate filter rejection, `tenantId=current` suppression, raw/actor filter rejection by omission, and upstream status/body propagation.
- `frontend/app/admin/advisory/operations/page.test.tsx`
  - Provider telemetry metrics, grouped views, threshold breach labeling, unavailable state, and raw-content suppression.
- `frontend/e2e/advisory-operations-dashboard.atdd.spec.ts`
  - Operations dashboard provider monitoring journey, shared filter request assertions, threshold/freshness visibility, and unavailable/no-zero behavior.

TDD RED compliance:

- All Story 6.3 generated tests use `it.skip()` or `test.skip()`.
- Tests assert expected behavior, not placeholder truth assertions.
- RED tests use aggregate provider telemetry fixtures, not raw audit rows.
- Raw private probes cover prompt, conversation, report, feedback, provider payload, and cache key strings.

## Acceptance Criteria Coverage

- AC1: Covered by client normalization/fetch tests, proxy forwarding tests, component rendering tests, and E2E grouped metrics tests.
- AC2: Covered by threshold breach normalization, component breach region assertions, proxy privacy filtering, and E2E warning visibility.
- AC3: Covered by unavailable normalization, proxy 503 preservation, component unavailable state, and E2E no-successful-zero assertions.

## Green Phase Commands

```bash
npm --workspace frontend run test -- operations app/api/advisory/admin/operations/provider-telemetry/route.test.ts app/admin/advisory/operations/page.test.tsx --runInBand
npm --workspace frontend run test:e2e -- advisory-operations-dashboard.atdd.spec.ts --project=chromium
cd frontend
npx tsc --noEmit
```

## Implementation Guidance

- Extend `frontend/lib/advisory/operations.ts` with typed provider telemetry filters/view models, safe normalization, threshold breach helpers, and `fetchAdvisoryProviderTelemetry()`.
- Add `frontend/app/api/advisory/admin/operations/provider-telemetry/route.ts` by following the Story 6.1 usage proxy pattern and adding `groupBy` to the allowlist.
- Extend `frontend/app/admin/advisory/operations/page.tsx` in-place; do not create a separate dashboard.
- Keep usage and provider telemetry loading independent enough that provider telemetry unavailable does not erase the existing usage dashboard.
- Remove `skip` from Story 6.3 tests during green phase and keep all existing Story 6.1 tests passing.

## Step 5: Validate & Complete

- Checklist validation: complete for Story 6.3 ATDD scope.
- Temp artifacts: no random temp output required; durable ATDD evidence is this checklist plus colocated RED tests.
- Browser sessions: none opened.
- Key assumption: Story 6.3 consumes only the 6.2 aggregate endpoint and never renders or recomputes raw audit/provider content.

