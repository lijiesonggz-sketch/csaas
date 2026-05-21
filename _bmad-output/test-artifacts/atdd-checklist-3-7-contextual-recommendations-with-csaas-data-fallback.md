---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-21T03:26:54+08:00'
workflowType: testarch-atdd
inputDocuments:
  - .claude/claude.md
  - _bmad/bmm/config.yaml
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad-output/implementation-artifacts/3-7-contextual-recommendations-with-csaas-data-fallback.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - backend/package.json
  - frontend/package.json
  - frontend/jest.config.js
  - frontend/playwright.config.ts
  - backend/src/modules/advisory/quick-consult/quick-consult.service.ts
  - backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.ts
  - backend/src/modules/advisory/org-context/advisory-organization-context.service.ts
  - frontend/lib/advisory/quick-consult.ts
  - frontend/components/advisory/QuickConsultProblemIntake.tsx
knowledgeFragments:
  - data-factories
  - component-tdd
  - test-quality
  - test-healing-patterns
  - selector-resilience
  - timing-debugging
  - test-levels-framework
  - test-priorities-matrix
  - ci-burn-in
  - playwright-cli
  - overview
  - api-request
  - network-recorder
  - auth-session
  - intercept-network-call
  - recurse
  - log
  - file-utils
  - network-error-monitor
  - fixtures-composition
  - pactjs-utils-overview
  - pactjs-utils-consumer-helpers
  - pactjs-utils-provider-verifier
  - pactjs-utils-request-filter
  - pact-mcp
---

# ATDD Checklist - Epic 3, Story 3.7: Contextual Recommendations with CSAAS Data Fallback

**Date:** 2026-05-21
**Author:** leo
**Primary Test Level:** Backend service/unit + frontend client/proxy/component

---

## Story Summary

Quick Consult recommendations must use available CSAAS IT maturity and compliance signals when those signals can be loaded within the 2 second deadline. When signals are absent, malformed, unavailable, or timed out, Quick Consult must continue in generic recommendation mode and surface an explicit non-blocking UI warning. Low enterprise background completeness must produce guidance that helps users improve recommendation precision without blocking recommendation acceptance or manual browsing.

**As a** ThinkTank user
**I want** recommendations to use available CSAAS maturity and compliance data
**So that** advice is more relevant while still working when integration data is unavailable

---

## Step 1: Preflight And Context

### Stack Detection

`_bmad/tea/config.yaml` sets `test_stack_type: auto`. Auto-detection found:

- Frontend: `frontend/package.json` has Next.js/React/Jest/Playwright and `frontend/playwright.config.ts`.
- Backend: `backend/package.json` has NestJS/Jest/TypeScript.
- Detected stack: `fullstack`.

### Prerequisites

- Story file exists and has clear AC: `_bmad-output/implementation-artifacts/3-7-contextual-recommendations-with-csaas-data-fallback.md`.
- Backend test framework exists through package-level Jest config in `backend/package.json`.
- Frontend test framework exists through `frontend/jest.config.js`; Playwright E2E config exists at `frontend/playwright.config.ts`.
- Development environment and dependencies are present in `backend/node_modules`, `frontend/node_modules`, and root `node_modules`.

### TEA Config Flags

- `tea_use_playwright_utils: true`
- `tea_use_pactjs_utils: true`
- `tea_pact_mcp: mcp`
- `tea_browser_automation: auto`
- `tea_execution_mode: auto`
- `tea_capability_probe: true`
- `test_framework: auto`

### Existing Test Patterns

- Backend advisory tests live beside source under `backend/src/modules/advisory/**`.
- Frontend unit/component/proxy tests use Jest + Testing Library under `frontend/lib/**`, `frontend/components/**`, and `frontend/app/api/**`.
- Existing Quick Consult tests already cover Story 3.6 organization context plumbing and privacy-safe metadata; Story 3.7 should extend those patterns rather than introduce a live CSAAS dependency.

---

## Step 2: Generation Mode

Chosen mode: AI generation.

Rationale:

- Acceptance criteria are explicit and deterministic.
- The story is mainly service/client/component behavior, not an unknown live UI flow.
- The UI selectors can be derived from current `QuickConsultProblemIntake.tsx` and should use role/text/label selectors.
- No live CSAAS API, GLM provider, Redis, database, or browser session is required for RED coverage.

Execution mode for Step 4: `subagent`, because the user explicitly allowed subagents and runtime supports subagent launch. Worker A will generate backend/API/service RED tests; Worker B will generate frontend/client/proxy/component RED tests. Temporary JSON outputs are stored under `_bmad-output/test-artifacts/` to avoid orphaned random temp files.

---

## Step 3: Test Strategy

## Acceptance Criteria

1. Given CSAAS IT maturity or compliance data is available within the response-time threshold, when Quick Consult generates recommendations, then the recommendation context includes the available enterprise signals and the user can see that recommendations are using enterprise context.
2. Given CSAAS data is unavailable, errors, or exceeds 2 seconds, when recommendations are generated, then the system falls back to generic recommendation mode and the UI clearly indicates that enterprise data is temporarily unavailable.
3. Given enterprise background completeness is low, when recommendations are shown, then the system prompts the user to add missing context that would improve recommendation precision and the prompt does not block the user from continuing.

## Scenario Map

| ID | AC | Priority | Level | RED Coverage Intent |
| --- | --- | --- | --- | --- |
| 3.7-INT-001 | AC1 | P0 | Backend service integration | Quick Consult loads tenant/organization-scoped CSAAS maturity/compliance signals through an advisory-owned boundary and returns `recommendationContext.mode = enterprise`, `signalsApplied`, and safe `sources`. |
| 3.7-UNIT-001 | AC1 | P0 | Backend recommendation unit | Recommendation generation uses enterprise signals to annotate/rank without leaking raw report/questionnaire data. |
| 3.7-INT-002 | AC2 | P0 | Backend service integration | No data, malformed data, missing organization id, thrown errors, and timeout degrade to generic mode while preserving normal recommendations and analysis start. |
| 3.7-SEC-001 | AC1-2 | P0 | Backend service/security | Browser/user payload cannot supply tenant/organization/signal data; service uses trusted server context and does not leak tenant B signal existence. |
| 3.7-OBS-001 | AC1-2 | P1 | Backend telemetry/metadata | Audit/context metadata stores only status/count/source markers, never raw CSAAS signal details, raw problem text, prompts, or exception messages. |
| 3.7-UNIT-002 | AC3 | P1 | Backend service unit | Low organization-context completeness returns a non-blocking `contextCompletionPrompt` with missing fields and action hint. |
| 3.7-FE-UNIT-001 | AC1-2 | P0 | Frontend client/proxy | Client normalizes `recommendationContext`; proxy keeps request whitelist and forwards only trusted backend response fields. |
| 3.7-FE-COMP-001 | AC1 | P0 | Frontend component | Recommendation section shows an enterprise-context applied indicator using accessible visible text. |
| 3.7-FE-COMP-002 | AC2 | P0 | Frontend component | Generic-mode warning text is visible and exposed as `role="alert"` when CSAAS data is unavailable/degraded. |
| 3.7-FE-COMP-003 | AC3 | P1 | Frontend component | Low-completeness prompt is visible and non-blocking; recommendation accept and manual browse controls remain usable. |

## Duplicate Coverage Guard

- Backend service tests own tenant scoping, timeout/fallback, privacy-safe metadata, and response contract.
- Backend recommendation tests own signal-to-rationale/ranking behavior.
- Frontend client/proxy tests own normalization and request whitelisting.
- Frontend component tests own visible user states and accessibility semantics.
- Full browser E2E is not the primary layer for this story because all behavior is deterministic and can be validated through existing Jest/Testing Library tests without running a live stack.

## Red Phase Requirements

- Generated tests must be written as RED-phase expectations with `it.skip`/`test.skip` first.
- Each skipped test asserts expected Story 3.7 behavior, not placeholders.
- DEV phase must remove skips or translate these scenarios into active focused Jest tests while implementing the story.
- Tests must not add production `data-testid`; selectors should use role, label, and visible text.

---

## Step 4: Aggregate RED Tests

Subagent outputs were read from:

- `_bmad-output/test-artifacts/tea-atdd-api-tests-3-7-2026-05-21T02-34-00+08-00.json`
- `_bmad-output/test-artifacts/tea-atdd-e2e-tests-3-7-2026-05-21T02-34-00+08-00.json`

TDD RED validation passed:

- Backend/API output success: true
- Frontend/client/component output success: true
- Total tests: 15
- Backend/API/service tests: 10
- Frontend/client/proxy/component tests: 5
- All tests use `it.skip` or `test.skip`
- No generated file contains `expect(true).toBe(true)`
- All generated test artifacts are marked `expected_to_fail: true`

Generated RED test files:

- `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.spec.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult.service.contextual-recommendations.spec.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.contextual.spec.ts`
- `frontend/lib/advisory/quick-consult.contextual-recommendations.test.ts`
- `frontend/app/api/advisory/quick-consult/start/route.contextual-recommendations.test.ts`
- `frontend/components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx`

Fixture needs documented by subagents:

- `mockEnterpriseSignalAdapter`
- `quickConsultServiceFactory`
- `workflowRegistryFactory`
- `advisoryAccessUserFactory`
- `organizationPromptContextFactory`
- `jestFakeTimersForTimeout`
- `quickConsultClientMock`
- `manualBrowseCatalogMock`
- `authenticatedAdvisoryIdentityFixture`
- `proxyRequestFactory`

## Step 5: Validate And Complete

Checklist validation result: complete for ATDD handoff.

- Prerequisites satisfied: story AC, framework configs, dependencies, and existing test patterns were available.
- Test files created correctly in the existing backend/frontend test locations.
- Acceptance coverage maps to AC1 enterprise context, AC2 generic fallback, and AC3 low-completeness prompt.
- RED phase intent is explicit through skipped tests and `expected_to_fail`.
- CLI browser sessions: N/A; no browser automation session was opened during this ATDD run.
- Temporary artifacts are stored under `_bmad-output/test-artifacts/`.

Implementation handoff:

1. Add the advisory-owned CSAAS enterprise signal boundary.
2. Thread trusted tenant/user organization context into Quick Consult recommendation generation.
3. Return and persist privacy-safe `recommendationContext` metadata.
4. Normalize `recommendationContext`/`enterpriseContext` in the frontend client.
5. Render enterprise/generic/low-completeness indicators near recommendation cards.
6. During DEV green phase, remove `it.skip`/`test.skip` or translate each scenario into active focused tests before marking the story complete.
