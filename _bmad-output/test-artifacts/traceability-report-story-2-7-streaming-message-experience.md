---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-20T07:25:00+08:00'
workflowType: testarch-trace
storyId: '2.7'
storyKey: 2-7-streaming-message-experience
storyTitle: Streaming Message Experience
---

# Traceability Matrix & Gate Decision - Story 2.7 Streaming Message Experience

## Gate Decision: PASS

Rationale: P0 coverage is 100%, P1 coverage is 100%, and overall coverage is 100% (minimum: 80%). No critical or high coverage gaps remain after code-review fixes.

## Coverage Summary

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 3 | 3 | 100% | PASS |
| P1 | 1 | 1 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **4** | **4** | **100%** | **PASS** |

## Traceability Matrix

| AC | Priority | Coverage | Tests | Heuristics |
| --- | --- | --- | --- | --- |
| AC1 - SSE incremental response, streaming state, and polite live-region updates | P0 | FULL | `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`; `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`; `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.test.ts`; `frontend/lib/advisory/streaming.test.ts`; `frontend/app/advisory/__tests__/page.test.tsx` | Endpoint: present; auth: present; error paths: present |
| AC2 - Scroll position remains stable unless already near bottom | P0 | FULL | `frontend/app/advisory/__tests__/page.test.tsx` | Endpoint: n/a; auth: n/a; error paths: present |
| AC3 - Markdown/code safe rendering and non-color-only role identities | P0 | FULL | `frontend/app/advisory/__tests__/page.test.tsx` | Endpoint: n/a; auth: n/a; error paths: present |
| AC4 - Long conversation lazy rendering over threshold | P1 | FULL | `frontend/app/advisory/__tests__/page.test.tsx` | Endpoint: n/a; auth: n/a; error paths: present |

## Coverage Heuristics

- Endpoints without direct tests: 0.
- Auth/authz negative-path gaps: 0.
- Happy-path-only criteria: 0.
- API-impacting AC1 has backend controller/service tests, Next proxy tests, session-token required tests, tenant-field stripping tests, provider-error tests, empty-stream tests, malformed-EOF tests, abort tests, and backpressure tests.

## Quality Notes

- Warning, non-blocking: `frontend/app/advisory/__tests__/page.test.tsx` is an aggregated advisory route suite over 300 lines. This is acceptable for Story 2.7 because it extends existing route-level coverage, but it should be split if later Epic 2 stories make it harder to maintain.
- Deterministic coverage: no test requires live LLM/network access. Streaming is tested with mocked async iterables, Web streams, and controller/service fakes.
- No production `data-testid` attributes were introduced; frontend assertions use roles, labels, status, alert, text, and semantic structure.

## Verification Evidence

- `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand` - 53 tests passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand` - 63 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd frontend && npx tsc --noEmit` - passed.

## Recommendations

- LOW: split the aggregated advisory route test suite later if subsequent Epic 2 stories make it difficult to maintain.

## Gate Summary

GATE DECISION: PASS

- P0 Coverage: 100% (required: 100%) - MET.
- P1 Coverage: 100% (pass target: 90%, minimum: 80%) - MET.
- Overall Coverage: 100% (minimum: 80%) - MET.
- Critical gaps: 0.
- Release status for this story: approved; no traceability blocker remains.
