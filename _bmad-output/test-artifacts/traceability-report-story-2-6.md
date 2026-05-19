---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-05-20T06:18:22+08:00'
workflowType: testarch-trace
storyId: '2.6'
storyKey: 2-6-guided-step-conversation-and-decision-controls
storyTitle: Guided Step Conversation and Decision Controls
inputDocuments:
  - _bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md
  - _bmad-output/test-artifacts/atdd-checklist-2-6-guided-step-conversation-and-decision-controls.md
  - _bmad-output/test-artifacts/code-review-story-2-6.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/selective-testing.md
---

# Traceability Matrix & Gate Decision - Story 2.6

**Story:** Guided Step Conversation and Decision Controls
**Date:** 2026-05-20
**Evaluator:** TEA Trace Workflow

## Step 1: Context Summary

- Story file loaded: `_bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md`.
- ATDD artifact loaded: `_bmad-output/test-artifacts/atdd-checklist-2-6-guided-step-conversation-and-decision-controls.md`.
- Code review artifact loaded: `_bmad-output/test-artifacts/code-review-story-2-6.md`.
- Knowledge fragments loaded: test priorities, risk governance, probability-impact, test quality, selective testing.
- Acceptance criteria extracted: governed gateway streaming, `conversation_messages`, tenant isolation, privacy-safe telemetry, explicit continuation, in-message decision controls, and keyboard shortcuts.

## Step 2: Test Discovery

### Relevant Test Catalog

| Test File | Level | Relevant Coverage |
| --- | --- | --- |
| `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.spec.ts` | Unit | Tenant id stripping, tenant-scoped list/update/delete, cross-tenant not-found behavior, sequence from max value |
| `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts` | Unit / integration boundary | User message persistence, provider gateway stream orchestration, advisor message persistence, no raw provider metadata, retrieval, inactive/cross-tenant rejection, no auto-advance |
| `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts` | API/controller | Guarded controller contract for `GET/POST /advisory/sessions/:sessionId/messages` and tenant/user context forwarding |
| `frontend/lib/advisory/messages.test.ts` | Client unit | Message retrieval/submission envelope unwrapping, network request shape, client-side draft validation |
| `frontend/app/api/advisory/sessions/[sessionId]/messages/route.test.ts` | API proxy | NextAuth token requirement, backend proxying, caller tenant stripping |
| `frontend/app/advisory/__tests__/page.test.tsx` | Component / RTL | Conversation rendering, Enter/Shift+Enter/Escape/Ctrl+D, autosave, decision controls, disabled Party Mode, focus preservation |

### Coverage Heuristics Inventory

- **Endpoints referenced:** `GET /advisory/sessions/:sessionId/messages`, `POST /advisory/sessions/:sessionId/messages`, and the Next proxy route `/api/advisory/sessions/:sessionId/messages`.
- **Endpoint coverage:** backend controller specs cover controller-to-service contract; frontend proxy route tests cover token forwarding and request shaping; service specs cover business behavior under the endpoints.
- **Auth/authz coverage:** controller is guarded by `JwtAuthGuard` and `TenantGuard`; proxy tests require a NextAuth session token; repository/service tests prove tenant-scoped access and cross-tenant rejection.
- **Tenant isolation coverage:** repository tests verify tenant id injection, caller-supplied tenant stripping, sequence-scoped lookup, scoped update/delete, and no cross-tenant inference.
- **Error-path coverage:** empty/over-length client drafts, missing proxy auth, inactive/cross-tenant session rejection, provider metadata privacy, and no automatic current-step mutation are covered.

## Step 3: Criteria-To-Test Mapping

| AC | Requirement Summary | Priority | Tests / Evidence | Coverage | Rationale |
| --- | --- | --- | --- | --- | --- |
| AC1 | User answers go through the governed AI gateway stream path; advisor response is persisted and returns stream chunks plus continue/deepen/revise/Party Mode decision options where allowed. | P0 | `advisory-session.messages.spec.ts:133`, `advisory-session.messages.controller.spec.ts:73`, `frontend/lib/advisory/messages.test.ts:60`, `frontend/app/api/advisory/sessions/[sessionId]/messages/route.test.ts:75`, `frontend/app/advisory/__tests__/page.test.tsx:541` | FULL | Service test proves user persistence, `ThinkTankProviderGatewayService.stream(...)`, assistant persistence, stream chunk response, and decision options. Controller/proxy/client/UI tests cover the exposed path through the workspace. |
| AC2 | `conversation_messages` is tenant-scoped; cross-tenant reads/updates/deletes are rejected; raw message content is not copied into telemetry/provider metadata. | P0 | `advisory-conversation-message.repository.spec.ts:57`, `:88`, `:115`, `:125`, `:150`; `advisory-session.messages.spec.ts:133`, `:216`, `:248`; entity/migration `1772000000031-CreateAdvisoryConversationMessages.ts` | FULL | Repository tests prove BaseRepository tenant ownership semantics and max-sequence ordering. Service tests cover tenant-scoped retrieval/rejection and assert submitted message text and raw-sensitive keys are absent from provider metadata. Migration/entity require tenant/session indexes. |
| AC3 | If the AI indicates the step is ready, workflow does not advance until explicit user confirmation; input remains usable for follow-up/deepen/revise. | P0 | `advisory-session.messages.spec.ts:264`, `frontend/app/advisory/__tests__/page.test.tsx:541`, `frontend/app/advisory/__tests__/page.test.tsx:601` | FULL | Backend asserts `updateSession` is not called with a next step during message submission. Frontend tests show current step remains rendered after submit and decision controls are available in-message rather than forcing automatic advancement. |
| AC4 | Enter, Shift+Enter, Escape, Ctrl+D, and active decision keys perform expected actions without breaking focus; hints are discoverable through labels/titles/text. | P1 | `frontend/app/advisory/__tests__/page.test.tsx:568`, `:601`, `:630` | FULL | RTL tests cover Enter submit, Shift+Enter newline, empty-submit prevention, autosave, C/A/R/P decision controls with disabled Party Mode, Escape behavior, Ctrl+D disabled drawer hint, focus preservation, and visible shortcut hints. |

## Step 4: Gap Analysis

### Coverage Statistics

| Priority | Total Criteria | FULL Coverage | Coverage % | Status |
| --- | ---: | ---: | ---: | --- |
| P0 | 3 | 3 | 100% | PASS |
| P1 | 1 | 1 | 100% | PASS |
| P2 | 0 | 0 | 100% | PASS |
| P3 | 0 | 0 | 100% | PASS |
| **Total** | **4** | **4** | **100%** | **PASS** |

### Gap Counts

- Critical gaps (P0): 0
- High gaps (P1): 0
- Medium gaps (P2): 0
- Low gaps (P3): 0
- Endpoint coverage gaps: 0
- Auth/authz negative-path gaps: 0
- Happy-path-only criteria: 0

### Quality Assessment

- BLOCKER issues: 0
- WARNING issues: 1
  - `frontend/app/advisory/__tests__/page.test.tsx` is an aggregated advisory route suite over 300 lines. The Story 2.6 assertions are deterministic and focused, so this remains a maintainability warning rather than a gate blocker.
- INFO issues: 0
- Additional checks: no Story 2.6 `test.skip`, `.only`, hard waits, or production `data-testid` were found in the relevant files.

### Duplicate Coverage Analysis

- AC1 has backend service/controller, frontend proxy/client, and RTL overlap. This is acceptable defense in depth because provider orchestration, route contract, proxy auth boundary, and user-visible rendering are separate failure surfaces.
- AC2 has repository plus service overlap. This is acceptable because tenant isolation must be proven at the repository boundary and again in the session message flow.
- AC4 is primarily frontend RTL coverage. That is appropriate because the acceptance surface is keyboard/focus/accessibility behavior.

### Phase 1 Summary

- Total Requirements: 4
- Fully Covered: 4 (100%)
- Partially Covered: 0
- Uncovered: 0
- Recommendations: no blocking test additions required before marking Story 2.6 done.

Phase 1 coverage matrix saved to `_bmad-output/test-artifacts/traceability-story-2-6-guided-step-conversation-and-decision-controls-phase1.json`.

## Step 5: Gate Decision

### Decision Criteria Evaluation

| Criterion | Threshold | Actual | Status |
| --- | --- | --- | --- |
| P0 Coverage | 100% | 100% | MET |
| P0 Test Pass Rate | 100% | 100% | MET |
| P1 Coverage | >=90% for PASS | 100% | MET |
| Overall Coverage | >=80% | 100% | MET |
| Security Issues | 0 unresolved | 0 | MET |
| Critical NFR Failures | 0 unresolved | 0 | MET |
| Flaky Tests | 0 known | 0 known | MET |

### Evidence Summary

Local verification evidence recorded in the code review artifact:

- `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand` - 8 suites / 45 tests passed.
- `cd backend && npx tsc --noEmit` - passed.
- `cd backend && npm run orm:entities:parity` - passed.
- `cd backend && npm run orm:metadata:check` - passed.
- `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand` - 11 suites / 50 tests passed.
- `cd frontend && npx tsc --noEmit` - passed.
- Code review initially found two patch-level issues; both were fixed and revalidated.

### GATE DECISION: PASS

**Rationale:** P0 coverage is 100%, P1 coverage is 100%, overall requirements coverage is 100%, all Story 2.6 ACs have direct automated backend and/or frontend evidence, no critical gaps remain after code review fixes, and recorded regression/type/ORM checks are green.

### Gate Recommendations

1. Mark Story 2.6 as `done` after updating sprint/story status.
2. Keep the advisory route test file-size warning as non-blocking technical debt; split only if future Epic 2 stories make the suite harder to maintain.
3. Continue Epic 2 with Story 2.7 after committing Story 2.6.

## Integrated YAML Snippet

```yaml
traceability_and_gate:
  traceability:
    story_id: "2.6"
    date: "2026-05-20T06:18:22+08:00"
    coverage:
      overall: 100
      p0: 100
      p1: 100
      p2: 100
      p3: 100
    gaps:
      critical: 0
      high: 0
      medium: 0
      low: 0
    quality:
      blocker_issues: 0
      warning_issues: 1
  gate_decision:
    decision: "PASS"
    gate_type: "story"
    decision_mode: "deterministic"
    criteria:
      p0_coverage: 100
      p0_pass_rate: 100
      p1_coverage: 100
      p1_pass_rate: 100
      overall_pass_rate: 100
      overall_coverage: 100
      security_issues: 0
      critical_nfrs_fail: 0
      flaky_tests: 0
```

## Sign-Off

- Phase 1 - Traceability Assessment: PASS
- Phase 2 - Gate Decision: PASS
- Overall Status: PASS

Generated: 2026-05-20T06:18:22+08:00
Workflow: bmad-testarch-trace
