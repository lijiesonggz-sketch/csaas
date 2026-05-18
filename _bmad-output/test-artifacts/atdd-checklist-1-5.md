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
lastSaved: '2026-05-19T04:52:49+08:00'
workflowType: 'testarch-atdd'
storyId: '1.5'
storyTitle: 'Governed AI Provider Gateway'
inputDocuments:
  - _bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md
  - backend/src/modules/advisory/events/thinktank-event-contract.ts
  - backend/src/modules/advisory/events/thinktank-event-registry.ts
  - backend/src/modules/advisory/events/advisory-event.service.ts
  - backend/src/modules/ai-clients/providers/anthropic.client.ts
  - backend/package.json
  - _bmad/tea/config.yaml
---

# ATDD Checklist - Epic 1, Story 5: Governed AI Provider Gateway

**Date:** 2026-05-19T04:52:49+08:00
**Author:** leo
**Primary Test Level:** Backend unit/service integration

## Story Summary

Story 1.5 creates an advisory-owned ThinkTank AI provider gateway. It provides a deterministic fake smoke path, hides live SDK construction behind provider adapters, supports non-streaming and streaming calls, handles retry/timeout/error normalization, and emits provider telemetry through the Story 1.4 event infrastructure.

This story is infrastructure only. It enables later workflow, recommendation, and Party Mode stories, but it does not claim user-facing FR1-FR27 coverage and does not create workflow/session/output runtime tables.

## Acceptance Criteria

1. Advisory code calls GLM 5.1 through a shared gateway using Anthropic-compatible messages; feature code cannot directly instantiate the SDK client.
2. Fake smoke path returns deterministic advisor responses through the same gateway contract and emits `thinktank.provider.call_completed` or `thinktank.provider.call_failed`.
3. Future workflow/recommendation/Party Mode FR coverage remains owned by those feature stories.
4. Automated tests can use deterministic fake streaming/non-streaming responses and assert retry, timeout, latency, token/cost metadata, and `thinktank.provider.call_retried` without network access.
5. GLM errors/timeouts return a normalized ThinkTank error shape and emit `thinktank.provider.call_failed`.

## Step 1: Preflight & Context

- TEA config uses `test_stack_type=auto`; repository detection is `fullstack`.
- This story is backend infrastructure under `backend/src/modules/advisory/provider-gateway/`.
- Existing Story 1.4 event contract, registry, and advisory event service are mandatory dependencies.
- Existing generic AI clients are reference patterns only; this story needs a ThinkTank-specific gateway and telemetry contract.
- Existing `_bmad-output/test-artifacts/atdd-checklist-1-5.md`, `atdd-story-1-5-api-red.spec.ts`, and fixtures belonged to an older resolve-controls story and were refreshed.
- Browser recording is not applicable because no user-facing UI, page, route, or selector is introduced.

## Step 2: Generation Mode

- Selected mode: `AI generation`.
- Execution mode: sequential in the current agent, because this pipeline is running in the current workspace and no explicit user delegation was requested.
- Pact/CDC: N/A. This story does not introduce an HTTP consumer/provider endpoint contract; provider interaction is an internal service adapter boundary.

## Step 3: Test Strategy

| Scenario | AC | Level | Priority | RED behavior |
| --- | --- | --- | --- | --- |
| Gateway exposes injectable non-streaming and streaming service methods without SDK classes in feature callers | 1, 3 | Unit/static | P0 | Fails until gateway module and boundary exist |
| Fake provider smoke call returns deterministic response through the same gateway contract | 2, 4 | Service integration | P0 | Fails until fake provider adapter exists |
| Completed fake call emits `thinktank.provider.call_completed` with canonical snake_case telemetry | 2 | Service integration | P0 | Fails until gateway emits telemetry |
| Fake streaming returns deterministic ordered chunks and final usage metadata | 4 | Unit/service | P0 | Fails until streaming contract exists |
| Retryable fake/live errors emit `thinktank.provider.call_retried` with attempt metadata and no real sleeps | 4, 5 | Service integration | P0 | Fails until retry orchestration exists |
| Timeout and provider failures normalize to stable ThinkTank error shape and emit `call_failed` | 5 | Unit/service | P0 | Fails until error normalization exists |
| Provider telemetry excludes raw messages, prompt, content, report, document, and enterprise context | 2, 4, 5 | Contract regression | P0 | Fails until privacy guard is reused for telemetry |
| Config defaults to fake/no-network mode in tests without `GLM_API_KEY` or `ANTHROPIC_API_KEY` | 2, 4 | Unit | P1 | Fails until config helper exists |
| Advisory module wires and exports the gateway for future feature modules | 1, 3 | Nest module | P1 | Fails until `AdvisoryModule` exports gateway |

## Step 4: RED Phase Artifacts

### Backend/Service API RED Tests

**File:** `_bmad-output/test-artifacts/atdd-story-1-5-api-red.spec.ts`

- `[P0][1.5-GW-001] exposes injectable gateway methods and keeps SDK construction outside feature code`
- `[P0][1.5-GW-002] fake smoke success returns deterministic advisor response and emits completed telemetry`
- `[P0][1.5-GW-003] fake streaming returns deterministic chunks through the gateway contract`
- `[P0][1.5-GW-004] retryable provider failure emits call_retried without real sleeping`
- `[P0][1.5-GW-005] timeout/failure returns normalized ThinkTank error and emits failed telemetry`
- `[P0][1.5-GW-006] provider telemetry uses canonical snake_case fields and excludes raw content`
- `[P1][1.5-GW-007] config defaults to fake safe mode without model API keys`
- `[P1][1.5-GW-008] AdvisoryModule registers and exports the provider gateway`

All tests are intentionally `test.skip()` and contain expected-behavior assertions, not placeholders.

### Fixtures

**File:** `_bmad-output/test-artifacts/atdd-story-1-5-fixtures.ts`

Exports deterministic tenant/actor/correlation identifiers, gateway requests, fake script expectations, retry/timeout scenarios, expected telemetry fields, and raw-sensitive keys that must not appear in provider telemetry.

### E2E Tests

No E2E/browser file was generated. Story 1.5 has no UI journey and no endpoint that a browser user can exercise.

## Implementation Checklist

### Test: `[P0][1.5-GW-001]`

- [ ] Add `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`.
- [ ] Define request/response/error/streaming types without exporting raw SDK classes.
- [ ] Add provider adapter/factory boundary under `provider-gateway/providers/`.
- [ ] Keep `new Anthropic(...)` only inside live provider adapter/factory, not feature code.

### Test: `[P0][1.5-GW-002]`

- [ ] Add deterministic `FakeThinkTankProviderAdapter`.
- [ ] Use the same gateway contract for fake and live provider calls.
- [ ] Return stable content, usage, cost, status, latency, model, provider, and finish reason.
- [ ] Emit `thinktank.provider.call_completed` through `AdvisoryEventService`.

### Test: `[P0][1.5-GW-003]`

- [ ] Add gateway streaming method returning an async iterable.
- [ ] Support deterministic fake chunks and final usage metadata.
- [ ] Keep streaming response shape compatible with future SSE use without adding UI behavior.

### Test: `[P0][1.5-GW-004]`

- [ ] Implement bounded retry with injected no-wait sleeper for tests.
- [ ] Emit `thinktank.provider.call_retried` for each retry attempt.
- [ ] Include retry attempt, provider, latency/status where available, and correlation id.

### Test: `[P0][1.5-GW-005]`

- [ ] Implement deterministic timeout handling.
- [ ] Normalize failures to `{ code, category, provider, status, retryable, message }`.
- [ ] Emit `thinktank.provider.call_failed` with latency, status, cost metadata, and error category.

### Test: `[P0][1.5-GW-006]`

- [ ] Reuse Story 1.4 event contract and privacy guard.
- [ ] Use canonical snake_case telemetry fields.
- [ ] Do not persist raw `messages`, `prompt`, `content`, `report`, `document`, `enterpriseContext`, or attachments.

### Test: `[P1][1.5-GW-007]`

- [ ] Add provider gateway config helper.
- [ ] Default automated tests to fake/no-network mode.
- [ ] Keep live GLM adapter disabled unless explicit provider mode and API key are configured.

### Test: `[P1][1.5-GW-008]`

- [ ] Register provider gateway dependencies in `AdvisoryModule`.
- [ ] Export gateway service for future advisory workflow/recommendation modules.
- [ ] Do not create workflow/session/output runtime tables.

## Running Tests

```bash
# RED artifact is intentionally skipped until implementation begins.
# Adapt these assertions into colocated backend specs, then unskip there:
cd backend && npm run test -- thinktank-provider advisory-event thinktank-event --runInBand

# Required story verification:
cd backend && npx tsc --noEmit
cd backend && npm run orm:entities:parity
cd backend && npm test -- --runInBand
```

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- Acceptance criteria mapped to backend unit/service integration scenarios.
- Skipped RED tests and deterministic fixtures generated.
- E2E/browser coverage explicitly marked N/A.
- Pact/CDC explicitly marked N/A because no HTTP provider contract is created.

### GREEN Phase (DEV)

1. Move/adapt RED assertions into colocated backend Jest specs.
2. Run the focused test command and confirm the new provider gateway tests fail before implementation.
3. Implement gateway types, fake provider, live adapter boundary, retry/timeout/error handling, telemetry, config, and module wiring.
4. Keep all tests no-network and API-key independent.

### REFACTOR Phase

1. Consolidate telemetry field mapping with Story 1.4 event helpers.
2. Keep adapter logic narrow and avoid future workflow runtime schema changes.
3. Re-run focused tests, TypeScript, ORM parity, and broader backend regression.

## Knowledge Base References Applied

- `data-factories.md` - deterministic fixtures and override-ready request objects.
- `test-quality.md` - explicit assertions, no placeholders, no real sleeps, no network dependence.
- `test-levels-framework.md` - backend unit/service integration selected over browser E2E.
- `test-priorities-matrix.md` - P0 for provider boundary, telemetry, retry, timeout, privacy; P1 for config/module wiring.
- `test-healing-patterns.md` - no selector/timing healing needed; fake clock/no-wait retry prevents flake.
- `contract-testing.md`, Pact utils, and Pact MCP - reviewed and marked N/A for this internal service boundary.

## Test Execution Evidence

The ATDD artifact tests are intentionally skipped and not connected to the backend Jest root. Expected pre-implementation failures after unskip are missing provider gateway modules and telemetry behavior:

- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config`
- `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter`
- `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter`
- Story 1.4 telemetry emission extension for provider events

**Generated by BMad TEA Agent** - 2026-05-19T04:52:49+08:00
