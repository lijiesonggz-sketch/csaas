---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T12:20:00+08:00'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/2-10-prompt-caching-and-cost-aware-workflow-calls.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/api-testing-patterns.md
---

# ATDD Checklist - Epic 2, Story 2.10: Prompt Caching and Cost-Aware Workflow Calls

**Date:** 2026-05-20
**Author:** leo
**Primary Test Level:** Backend integration and provider-adapter unit tests

## Story Summary

Story 2.10 makes repeated ThinkTank workflow prompts and persona content cache-aware at the AI provider gateway boundary. The acceptance focus is safe provider cache metadata, cost telemetry, and deterministic fake-provider tests without live GLM calls.

**As a** platform operator
**I want** repeated workflow prompts and persona content to be cached and measured
**So that** structured advisory sessions remain economically sustainable

## Acceptance Criteria

1. Stable system prompt, workflow definition, and persona content use the configured provider-supported prompt-cache strategy; the system records input/output tokens, cache status, latency, cost metadata, and emits `thinktank.prompt_cache.hit` on cache reuse.
2. If prompt caching is unavailable or unsupported, the user-visible workflow action still completes and `thinktank.prompt_cache.miss` records missed or bypassed cache status.
3. Automated tests use the fake provider and mocked adapter responses to assert cache metadata and cost telemetry without live GLM calls.

## Test Strategy

| Scenario | Priority | Level | Rationale |
| --- | --- | --- | --- |
| Gateway emits prompt cache hit/miss telemetry with safe metadata | P0 | Backend integration/unit | Core AC1/AC2 behavior lives in provider gateway orchestration. |
| Fake provider produces deterministic hit/miss/bypass metadata | P0 | Backend unit | AC3 requires no live provider dependency. |
| GLM adapter normalizes Anthropic and Z.AI cache usage fields | P0 | Backend unit | Provider billing/cost accuracy depends on adapter normalization. |
| Session submit and SSE paths persist safe cache metadata | P0 | Backend integration/unit | Existing non-stream and stream paths must stay aligned. |
| Frontend metadata reader | P2 | Frontend unit if touched | Only required if cache metadata is consumed/displayed by UI. |
| Browser E2E journey | N/A | N/A | Story has no new user journey or visual behavior. |

## Failing Tests Created (RED Phase)

The RED tests are intentionally written with `test.skip()` so they document expected behavior before implementation without breaking CI. During the DEV step, each skipped test should be unskipped as its implementation is made green.

### Backend Gateway Tests (4 tests)

**File:** `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.prompt-cache.spec.ts`

- **Test:** `[P0] emits prompt cache hit telemetry with safe token and cost metadata`
  - **Status:** RED - gateway does not yet expose normalized cache fields or emit `thinktank.prompt_cache.hit`.
  - **Verifies:** AC1, AC3.
- **Test:** `[P0] emits prompt cache miss telemetry for unsupported or bypassed cache without failing completion`
  - **Status:** RED - gateway does not yet normalize bypass/miss states or emit `thinktank.prompt_cache.miss`.
  - **Verifies:** AC2, AC3.
- **Test:** `[P1] carries final stream cache metadata into provider completion telemetry`
  - **Status:** RED - final stream chunk does not yet carry cache metadata.
  - **Verifies:** AC1, AC2.
- **Test:** `[P0] rejects raw prompt-like cache telemetry metadata through the existing privacy guard`
  - **Status:** RED - cache telemetry privacy handling is not yet implemented.
  - **Verifies:** AC1, AC2.

### Backend Fake Provider Tests (4 tests)

**File:** `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.prompt-cache.spec.ts`

- **Test:** `[P0] returns deterministic cache hit metadata for complete calls without live GLM`
  - **Status:** RED - fake provider does not yet support scripted cache hit metadata.
  - **Verifies:** AC1, AC3.
- **Test:** `[P0] returns deterministic cache miss metadata for complete calls without live GLM`
  - **Status:** RED - fake provider does not yet support scripted cache miss metadata.
  - **Verifies:** AC2, AC3.
- **Test:** `[P0] returns deterministic bypass metadata with bypass reason when cache is disabled or unsupported`
  - **Status:** RED - fake provider does not yet support scripted bypass reasons.
  - **Verifies:** AC2, AC3.
- **Test:** `[P1] carries the same deterministic cache metadata on the final stream chunk`
  - **Status:** RED - fake stream final chunk does not yet carry cache metadata.
  - **Verifies:** AC1, AC2, AC3.

### Backend GLM Adapter Tests (3 tests)

**File:** `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.prompt-cache.spec.ts`

- **Test:** `[P0] normalizes Anthropic-style cache read and creation usage fields`
  - **Status:** RED - adapter currently reads only `input_tokens` and `output_tokens`.
  - **Verifies:** AC1, AC3.
- **Test:** `[P0] normalizes Z.AI cached_tokens from prompt_tokens_details without live GLM calls`
  - **Status:** RED - adapter currently ignores `usage.prompt_tokens_details.cached_tokens`.
  - **Verifies:** AC1, AC3.
- **Test:** `[P1] avoids explicit cache_control for provider-auto GLM requests`
  - **Status:** RED - provider-auto cache policy is not represented yet.
  - **Verifies:** AC2, AC3.

### Backend Session Tests (3 tests)

**File:** `backend/src/modules/advisory/sessions/advisory-session.prompt-cache.spec.ts`

- **Test:** `[P0] submitMessage assembles runtime prompt, sends cache policy, and persists safe cache metadata`
  - **Status:** RED - submit path still sends a short placeholder system prompt and persists only basic provider metadata.
  - **Verifies:** AC1, AC3.
- **Test:** `[P0] streamMessage persists the same cache metadata on the completed SSE assistant message`
  - **Status:** RED - SSE completion does not yet persist or surface cache token metadata.
  - **Verifies:** AC1, AC2.
- **Test:** `[P1] provider request metadata and persisted providerMetadata omit raw prompt and user content`
  - **Status:** RED - cache policy metadata does not exist yet; privacy expectations are documented before implementation.
  - **Verifies:** AC1, AC2.

### Frontend Metadata Forwarding Tests (2 tests)

**Files:**

- `frontend/lib/advisory/outputs.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts`

- **Test:** `[2.10-FE-RED-001][P1] preserves safe prompt-cache provider metadata and strips raw prompt fields when appending sections`
  - **Status:** RED - frontend output client currently drops cache metadata fields.
  - **Verifies:** AC1, AC2.
- **Test:** `[2.10-FE-RED-002][P1] forwards only safe prompt-cache provider metadata to the backend append endpoint`
  - **Status:** RED - frontend output section proxy currently drops cache metadata fields.
  - **Verifies:** AC1, AC2.

## Data Factories Created

No new factories were created. Existing deterministic in-memory mocks are sufficient because Story 2.10 validates provider gateway/session contracts, not persistent domain records.

## Fixtures Created

No new reusable fixtures were created. Each skipped spec builds minimal isolated Jest mocks for `AdvisoryEventService`, `ThinkTankProviderGatewayService`, `ThinkTankPromptAssemblerService`, and message/session repositories.

## Mock Requirements

### Fake Provider Mock

- Extend `FakeThinkTankProviderAdapter` so tests can script `hit`, `miss`, and `bypass`.
- Keep fake token/cost metadata deterministic.
- Do not call live GLM or any external network.

### GLM Adapter Mock

- Mock `@anthropic-ai/sdk` constructor and `messages.create`.
- Return Anthropic-style `cache_read_input_tokens` / `cache_creation_input_tokens`.
- Return Z.AI-style `usage.prompt_tokens_details.cached_tokens`.
- Assert provider-auto GLM requests do not send manual `cache_control`.

## Required data-testid Attributes

N/A. No production `data-testid` is required or allowed for this story.

## Implementation Checklist

### Gateway Cache Telemetry

- [x] Extend provider request/response/stream types with safe prompt-cache fields.
- [x] Normalize cache status and token breakdown from provider responses.
- [x] Emit `thinktank.prompt_cache.hit` and `.miss` best-effort with operational privacy classification.
- [x] Keep existing provider completion/failure/retry telemetry semantics.
- [x] Ensure cache telemetry never includes raw prompt, messages, content, report, document, or persona text.
- [x] Unskip and pass `thinktank-provider-gateway.prompt-cache.spec.ts`.

### Provider Adapters

- [x] Extend fake provider options for deterministic cache scripts.
- [x] Normalize Anthropic-style cache usage fields.
- [x] Normalize Z.AI/GLM `prompt_tokens_details.cached_tokens`.
- [x] Estimate cost with cache read/create token breakdown while preserving legacy fallback.
- [x] Unskip and pass `fake-thinktank-provider.prompt-cache.spec.ts`.
- [x] Unskip and pass `anthropic-glm-provider.prompt-cache.spec.ts`.

### Session Submit and Stream Paths

- [x] Reassemble runtime prompt in `submitMessage` and `streamMessage`.
- [x] Compute cache identity from workflow key, source refs/hashes, provider, model, and strategy, not raw content.
- [x] Send stable assembled workflow/persona material as provider `system`.
- [x] Persist safe cache metadata into assistant `providerMetadata` for both non-stream and SSE completion paths.
- [x] Unskip and pass `advisory-session.prompt-cache.spec.ts`.

### Frontend Metadata Reader

- [x] Extend `readProviderMetadata()` only if cache metadata is displayed or consumed.
- [x] Preserve cache metadata in `frontend/lib/advisory/outputs.ts` and the output section proxy if assistant metadata is forwarded to report sections.
- [x] Unskip and pass the two frontend metadata forwarding RED tests if frontend metadata forwarding is changed.

## Running Tests

```bash
# ATDD RED files currently skip tests by design
cd backend && npm run test -- src/modules/advisory/provider-gateway/thinktank-provider-gateway.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.prompt-cache.spec.ts src/modules/advisory/sessions/advisory-session.prompt-cache.spec.ts --runInBand

# DEV green phase focused backend advisory tests
cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions src/modules/advisory/events --runInBand

# TypeScript validation after implementation
cd backend && npx tsc --noEmit

# Frontend metadata forwarding tests if frontend is touched
cd frontend && npm run test -- lib/advisory/outputs.test.ts app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts --runInBand
```

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- RED test intent is documented in skipped Jest specs.
- Acceptance criteria are mapped to backend provider/session/adapter tests.
- Browser E2E is explicitly N/A because no user-facing journey changes are required.
- No live provider dependency is introduced.

### GREEN Phase (DEV - Next)

1. Implement provider cache contracts and helper.
2. Unskip one focused test group at a time.
3. Make the tests pass with deterministic fake/mocked provider responses.
4. Run focused backend advisory tests and `npx tsc --noEmit`.

### REFACTOR Phase

- Consolidate cache metadata mapping into focused helper functions.
- Keep raw-sensitive guardrails centralized.
- Avoid new top-level modules, Redis, database tables, dashboards, or budget controls.

## Test Execution Evidence

Initial RED verification is expected to show skipped tests until the DEV step unskips them. This preserves CI stability while satisfying ATDD pre-implementation coverage.

DEV green evidence captured on 2026-05-20:

- `cd backend && npm run test -- src/modules/advisory/provider-gateway/thinktank-provider-gateway.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.prompt-cache.spec.ts src/modules/advisory/sessions/advisory-session.prompt-cache.spec.ts src/modules/advisory/sessions/advisory-session.outputs.spec.ts src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.spec.ts --runInBand` → 6 suites passed, 34 tests passed.
- `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions src/modules/advisory/events --runInBand` → 19 suites passed, 112 tests passed.
- `cd frontend && npm run test -- components/advisory lib/advisory --runInBand` → 10 suites passed, 40 tests passed.
- `cd frontend && npm run test -- --runTestsByPath lib/advisory/outputs.test.ts "app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts" --runInBand` → 2 suites passed, 11 tests passed.
- `cd backend && npx tsc --noEmit` → passed.
- `cd frontend && npx tsc --noEmit` → passed.
- `git diff --check` → passed.
- `cd backend && npm run test -- --runInBand` → 291 suites passed, 2606 tests passed, 16 suites skipped, 69 tests skipped, 5 todo.
- `cd frontend && npm run test -- --runInBand` → 135 suites passed, 1353 tests passed, 2 suites skipped, 23 tests skipped.

Expected command:

```bash
cd backend && npm run test -- src/modules/advisory/provider-gateway/thinktank-provider-gateway.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.prompt-cache.spec.ts src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.prompt-cache.spec.ts src/modules/advisory/sessions/advisory-session.prompt-cache.spec.ts --runInBand
```

Expected result before implementation:

```text
Backend Test Suites: 4 skipped, 4 total
Backend Tests: 14 skipped, 14 total
Frontend RED additions: 2 skipped tests in existing suites
Status: RED expectations documented; tests intentionally skipped
```

## Knowledge Base References Applied

- `data-factories.md` - Avoid static fixtures unless deterministic service mocks are more appropriate.
- `test-quality.md` - Keep tests deterministic, isolated, focused, and without hard waits.
- `test-levels-framework.md` - Select backend integration/unit over browser E2E for provider gateway behavior.
- `test-priorities-matrix.md` - Mark provider cache telemetry, privacy, and fake-provider determinism as P0.
- `api-testing-patterns.md` - Validate backend/service contracts directly without browser overhead.

## Notes

- AC3 forbids live GLM dependency; all provider tests must use fake provider or mocked SDK responses.
- Prompt cache keys must be deterministic hashes over safe identifiers and content hashes only.
- `_bmad-output/` is gitignored; force-add this checklist when committing.
