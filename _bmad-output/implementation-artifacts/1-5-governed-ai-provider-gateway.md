# Story 1.5: Governed AI Provider Gateway

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want a governed AI provider gateway with a deterministic smoke path,
so that the team can verify ThinkTank advisor calls, errors, latency, and cost metadata before user-facing workflows depend on live GLM access.

## Acceptance Criteria

1. Given advisory code needs to call GLM 5.1, when the call is made, then it goes through a shared provider gateway using Anthropic-compatible messages and feature code cannot directly instantiate the SDK client.
2. Given the operator or automated test invokes the gateway smoke path, when the fake provider is configured, then the system returns a deterministic advisor response through the same gateway contract used by future workflow calls and telemetry emits `thinktank.provider.call_completed` or `thinktank.provider.call_failed` with provider type, latency, status, token/cost metadata, and error category where applicable.
3. Given workflow, recommendation, or Party Mode stories later use the gateway, when those stories claim user-facing FR coverage, then coverage is recorded in those feature stories rather than in this infrastructure story and this story is treated as enabling AI-call infrastructure for FR1-FR27, not implementing FR1-FR27 directly.
4. Given automated tests run without real model access, when workflow, recommendation, or Party Mode services call the gateway, then a deterministic fake provider can return scripted streaming and non-streaming responses and tests can assert retry, timeout, latency, token-cost metadata, and `thinktank.provider.call_retried` emission without network access.
5. Given GLM returns an error or timeout, when the gateway handles the failure, then it returns a normalized ThinkTank error shape and emits `thinktank.provider.call_failed` with latency, status, cost metadata, and error category for downstream telemetry.

## Tasks / Subtasks

- [x] Create the ThinkTank provider gateway contract and provider boundary (AC: 1, 3)
  - [x] Add provider gateway code under `backend/src/modules/advisory/provider-gateway/` or an equivalently narrow advisory-owned folder.
  - [x] Define Anthropic-compatible request types for `system`, `messages`, `model`, `maxTokens`, `temperature`, `metadata`, and `stream` without exposing raw SDK classes to feature callers.
  - [x] Define a single gateway service method for non-streaming calls and a streaming method or async-iterable contract for future SSE use.
  - [x] Ensure feature code receives an injectable `ThinkTankProviderGatewayService` or interface; direct `new Anthropic(...)` usage must remain inside the provider adapter/factory only.
  - [x] Do not create workflow/session/output runtime tables in this story.

- [x] Implement deterministic fake provider and smoke path (AC: 2, 4)
  - [x] Add a fake provider implementation that uses the same gateway request/response contract as live providers.
  - [x] Support scripted success, scripted failure, scripted timeout, and scripted streaming chunks with deterministic token/cost metadata.
  - [x] Add an operator/test smoke method that can call the fake provider without network access.
  - [x] Keep fake-provider selection configuration explicit, for example `THINKTANK_PROVIDER_MODE=fake`, and default tests to fake mode.

- [x] Add GLM/Anthropic-compatible provider adapter behind the gateway (AC: 1, 5)
  - [x] Prefer the existing repo dependency `@anthropic-ai/sdk` from `backend/package.json`; do not add a second Anthropic client library.
  - [x] Configure the adapter from backend config/env (`GLM_API_KEY`, `GLM_BASE_URL`, `GLM_MODEL`, `THINKTANK_PROVIDER_TIMEOUT_MS`, retry settings) with safe test defaults.
  - [x] Use Anthropic-compatible `messages` internally; if the live GLM endpoint must use OpenAI-compatible chat completions in the current environment, keep that translation inside the provider adapter and preserve the gateway contract.
  - [x] Normalize provider response content, model name, latency, token usage, estimated cost, status, finish/stop reason, and provider metadata.

- [x] Implement retry, timeout, and normalized error handling (AC: 4, 5)
  - [x] Add deterministic timeout handling around provider calls.
  - [x] Add bounded retry with exponential backoff or injected sleeper; tests must use a no-wait sleeper/fake clock and must not sleep in real time.
  - [x] Emit `thinktank.provider.call_retried` for each retry attempt with tenant scoping, correlation id, provider type, retry attempt, latency/status where available, and no raw message content.
  - [x] Map provider failures into a stable ThinkTank error shape with `code`, `category`, `provider`, `status`, `retryable`, and `message`.

- [x] Emit provider telemetry through Story 1.4 infrastructure (AC: 2, 4, 5)
  - [x] Reuse `AdvisoryEventService` and `normalizeThinkTankEvent()`; extend the emitter only as narrowly needed for telemetry-class events.
  - [x] Event names owned by this story: `thinktank.provider.call_completed`, `thinktank.provider.call_failed`, `thinktank.provider.call_retried`.
  - [x] Required event contract fields: `event_name`, `event_version`, `tenant_id`, `actor_id`, `subject_type=provider_call`, `subject_id`, `outcome`, `occurred_at`, `correlation_id`, and `privacy_classification=operational`.
  - [x] Optional telemetry fields must include provider, latency, estimated tokens, estimated cost, and error category where applicable.
  - [x] Do not include raw conversation, prompt, messages, message content, report content, or enterprise context in event metadata.

- [x] Add TDD acceptance and regression coverage (AC: 1-5)
  - [x] Add RED tests before implementation for gateway contract, fake smoke success, fake streaming, retry telemetry, timeout failure, normalized error shape, and no-network execution.
  - [x] Add tests proving the live provider adapter is hidden behind the gateway/factory and feature code can inject the gateway without SDK construction.
  - [x] Add telemetry tests for completed/failed/retried events using canonical snake_case fields and Story 1.4 privacy guardrails.
  - [x] Add config tests for fake mode and safe defaults.
  - [x] Confirm existing Story 1.4 event tests still pass.

- [x] Automated verification (AC: 1-5)
  - [x] Run focused backend tests for provider gateway and advisory events.
  - [x] Run `cd backend && npx tsc --noEmit`.
  - [x] Run `cd backend && npm run orm:entities:parity`.
  - [x] Run broader backend regression where feasible; document unrelated existing taxonomy-domain-gate failures exactly.
  - [x] Frontend/E2E tests are not expected unless a UI smoke endpoint/page is added; document this if no frontend behavior changes.

## Dev Notes

### Source Requirements

- Epic 1 owns the security/governance foundation, including the unified AI provider gateway interface and minimal telemetry hooks. Story 1.5 is infrastructure only; it must not claim user-facing FR1-FR27 coverage. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.5]
- FR40 requires ThinkTank to interpret migrated BMAD workflow definitions without hardcoding the workflow logic. The gateway must be reusable by those future runtime services but must not implement workflows now. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR40]
- FR45 and NFR2/NFR3 require future prompt caching/cost control; this story only exposes token and estimated-cost telemetry needed by later prompt-cache and ops stories. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR45, NFR2, NFR3]
- NFR17 requires GLM calls through an adapter/translation layer using Claude/Anthropic-compatible message semantics. NFR18 requires retry handling. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR17, NFR18]
- Architecture clarification says ThinkTank should use Anthropic SDK plus a self-managed session layer, not Claude Agent SDK. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Architecture Clarification]

### Scope Boundaries

This story creates the governed provider-call foundation only.

Do not implement these future user-facing capabilities here:

| Capability | Owning future story |
| --- | --- |
| Advisory workspace, sessions, document drawer, SSE UI | Epic 2 |
| Workflow launch and runtime FR coverage | Story 2.5 and later Epic 2 workflow stories |
| Prompt caching hit/miss behavior | Story 2.10 |
| Quick Consult recommendation behavior | Epic 3 |
| Report generation/export/rating/favorites | Epic 2 / Epic 4 |
| Party Mode orchestration and budget controls | Epic 5 |
| Provider telemetry aggregation/dashboard | Epic 6 |

### Previous Story Intelligence

- Story 1.4 added `backend/src/modules/advisory/events/thinktank-event-contract.ts`, `thinktank-event-registry.ts`, `advisory-event.service.ts`, and retention helpers. Reuse this contract rather than creating a separate telemetry schema.
- Story 1.4 event contract currently validates telemetry names but `AdvisoryEventService` only persists audit-kind events. Story 1.5 may add a narrowly-scoped telemetry emission method, but must keep canonical snake_case details and raw-content rejection.
- Story 1.4 fixed a reserved metadata override risk. Provider telemetry metadata must not allow callers to override `tenant_id`, `actor_id`, `event_name`, `privacy_classification`, `estimated_cost`, or other canonical fields.
- Full backend regression after Story 1.4 still had unrelated taxonomy-domain-gate failures: `[P0][6.5-AUTO-003]`, `[P0][6.5-AUTO-007]`, `[8.2-SVC-003][P1]`. Do not treat those as Story 1.5 regressions unless this implementation changes them.

### Existing Patterns To Reuse

- Advisory module wiring: `backend/src/modules/advisory/advisory.module.ts`.
- Event contract and privacy guard: `backend/src/modules/advisory/events/*`.
- Existing generic AI client patterns: `backend/src/modules/ai-clients/ai-orchestrator.service.ts`, `providers/anthropic.client.ts`, `providers/openai.client.ts`, `interfaces/ai-client.interface.ts`.
- Existing generic AI clients are not enough for this story because they expose generic prompt-style requests, legacy multi-provider routing, and do not emit ThinkTank event contract telemetry. Use them for implementation patterns only; the new gateway must be advisory-owned and ThinkTank-specific.
- Backend config pattern: inject `ConfigService` and keep test overrides simple.
- Tests are colocated as `*.spec.ts` and use Jest/Nest testing utilities.

### Backend Implementation Guidance

Suggested advisory-owned structure:

```text
backend/src/modules/advisory/provider-gateway/
  thinktank-provider-gateway.service.ts
  thinktank-provider-gateway.types.ts
  thinktank-provider-gateway.config.ts
  providers/
    thinktank-provider.adapter.ts
    fake-thinktank-provider.adapter.ts
    anthropic-glm-provider.adapter.ts
  *.spec.ts
```

Minimum gateway request shape:

```typescript
interface ThinkTankProviderRequest {
  tenantId: string
  actorId: string
  correlationId?: string
  subjectId?: string
  provider?: 'fake' | 'glm'
  model?: string
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  metadata?: Record<string, unknown>
}
```

Minimum success response shape:

```typescript
interface ThinkTankProviderResponse {
  id: string
  provider: 'fake' | 'glm'
  model: string
  content: string
  status: 'completed'
  latencyMs: number
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  estimatedCost: number
  finishReason?: string
}
```

Minimum error shape:

```typescript
interface ThinkTankProviderError {
  code: string
  category: 'provider' | 'timeout' | 'validation' | 'unknown'
  provider: 'fake' | 'glm'
  status: 'failed' | 'timeout'
  retryable: boolean
  message: string
}
```

Implementation rules:

- The fake provider must use the same adapter interface as live GLM and must be selected by config, not by test-only branches inside the gateway method.
- Token estimates for fake responses may be deterministic approximate counts; they must be stable and asserted in tests.
- Cost estimates may be zero for fake provider, but live provider responses must carry a numeric estimate when usage is available.
- The gateway must measure latency inside the gateway so retries and telemetry use consistent timings.
- Use injected retry/backoff helpers or injectable delay functions so tests do not wait.
- All event payloads must pass Story 1.4 privacy guards; do not pass raw `messages`, `prompt`, `content`, or `system` into event metadata.

### Security / Compliance Guidance

- `tenantId` and `actorId` must come from guarded backend context or trusted service parameters, never from browser-supplied telemetry payloads.
- Correlation id is required for every provider telemetry event; accept an explicit id from request context or generate one at the gateway boundary.
- No provider telemetry event may contain raw user input, full prompts, conversation messages, report content, documents, attachments, or enterprise context.
- Data-localization acceptance is met by avoiding external telemetry sinks and persisting through the existing CSAAS PostgreSQL audit/event path. Do not add third-party analytics.
- Live GLM calls must be disabled in automated tests. Tests must pass without `GLM_API_KEY`, `ANTHROPIC_API_KEY`, or network access.

### Latest Technical Notes

- Official Anthropic docs describe streaming Messages as SSE and the TypeScript SDK supports message creation/streaming helpers. This story should keep a gateway streaming contract even if only fake streaming is fully exercised now. [Source: https://platform.claude.com/docs/en/build-with-claude/streaming]
- Official Anthropic TypeScript SDK installation remains `@anthropic-ai/sdk`; this repo already depends on `@anthropic-ai/sdk` and should not add a duplicate SDK. [Source: https://platform.claude.com/docs/en/api/client-sdks; `backend/package.json`]
- Official BigModel GLM-5.1 docs currently show `glm-5.1` chat completions and streaming through `https://open.bigmodel.cn/api/paas/v4/chat/completions`. The architecture says Anthropic SDK + GLM-compatible endpoint; if live endpoint compatibility differs during implementation, isolate any translation inside the adapter and preserve the ThinkTank Anthropic-compatible gateway contract. [Source: https://docs.bigmodel.cn/cn/guide/models/text/glm-5.1; `_bmad-output/planning-artifacts/architecture-thinktank.md`]
- Do not upgrade package versions in this story. Use repo-locked NestJS/Jest/TypeScript and the existing `@anthropic-ai/sdk` dependency unless implementation discovers a compile-time blocker.

### Testing Requirements

- Follow TDD: create failing focused tests before production code.
- Focused command:
  - `cd backend && npm run test -- thinktank-provider advisory-event thinktank-event --runInBand`
- Static and ORM checks:
  - `cd backend && npx tsc --noEmit`
  - `cd backend && npm run orm:entities:parity`
- Broader regression:
  - `cd backend && npm test -- --runInBand`
- Document unrelated failures exactly; do not mark the story done until Story 1.5 focused tests and TypeScript checks pass.

### Project Structure Notes

- Keep provider gateway code inside `backend/src/modules/advisory/` to maintain ThinkTank module ownership.
- Register gateway providers in `AdvisoryModule` and export the gateway for future workflow/recommendation/Party Mode modules.
- Avoid database migrations unless implementation proves a separate persistence entity is required. Current story acceptance can be met by event details in existing audit/event storage.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.5 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR40, FR45, NFR17, NFR18 and AI/data localization constraints.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - Anthropic SDK + self-managed session layer decision and advisory module boundaries.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - first-use entity ownership and tenant isolation boundaries.
- `_bmad-output/implementation-artifacts/1-4-audit-and-telemetry-event-foundation.md` - previous event contract implementation notes and known regression status.
- `backend/src/modules/advisory/events/thinktank-event-contract.ts` - canonical event fields and privacy guard.
- `backend/src/modules/advisory/events/advisory-event.service.ts` - existing event persistence service to extend for telemetry.
- `backend/src/modules/ai-clients/providers/anthropic.client.ts` - existing Anthropic SDK usage pattern.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 1 Story 1.5, PRD FR40/FR45 and NFR17/NFR18, architecture Anthropic SDK clarification, existing AI client patterns, and Story 1.4 event contract learnings.
- 2026-05-19: ATDD RED artifacts refreshed for governed provider gateway; stale resolve-controls Story 1.5 artifacts replaced.
- 2026-05-19: Code review fixed one Medium finding: fake streaming now carries deterministic token/cost metadata instead of gateway-only estimation.

### Implementation Plan

- Add failing provider gateway tests for fake success/streaming, retry, timeout, telemetry, and privacy.
- Implement a small advisory-owned gateway with fake and GLM provider adapters.
- Extend advisory event emission for telemetry-class provider events.
- Wire the gateway into `AdvisoryModule` and verify focused tests, TypeScript, and ORM parity.

### Completion Notes List

- ATDD RED artifacts generated for gateway contract, fake smoke success, deterministic streaming, retry telemetry, timeout/failure normalization, telemetry privacy, safe config defaults, and `AdvisoryModule` wiring.
- Implemented advisory-owned `ThinkTankProviderGatewayService` with `complete()` and async-iterable `stream()` contracts, deterministic fake provider, live Anthropic/GLM adapter boundary, safe config defaults, retry/backoff, timeout, and normalized ThinkTank error shape.
- Extended `AdvisoryEventService` with telemetry emission through the existing audit/event storage path and Story 1.4 `normalizeThinkTankEvent()` guardrails.
- Verified no Story 1.5 workflow/session/output runtime tables were created and live SDK construction is confined to provider adapter code.
- Verification completed: focused provider/advisory event tests passed (22 tests), `npx tsc --noEmit` passed, `npm run orm:entities:parity` passed.
- Full backend regression run completed with the same unrelated taxonomy-domain-gate failures recorded before Story 1.5: `[P0][6.5-AUTO-003]`, `[P0][6.5-AUTO-007]`, `[8.2-SVC-003][P1]`.
- No frontend/E2E tests were added because Story 1.5 introduces no UI behavior or browser-visible route.
- Code review passed after fixing the streaming fake metadata finding.
- Traceability and gate completed with PASS: 5/5 acceptance criteria fully covered; no Story 1.5 blocking gaps.

### File List

- `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-1-5.md`
- `_bmad-output/test-artifacts/code-review-story-1-5.md`
- `_bmad-output/test-artifacts/gate-decision-story-1-5.yaml`
- `_bmad-output/test-artifacts/atdd-story-1-5-api-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-1-5-fixtures.ts`
- `_bmad-output/test-artifacts/traceability-report-story-1-5.md`
- `_bmad-output/test-artifacts/traceability-story-1-5-phase1.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-1-5-2026-05-19T04-52-49+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-1-5-2026-05-19T04-52-49+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-1-5-2026-05-19T04-52-49+08-00.json`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/events/advisory-event.service.spec.ts`
- `backend/src/modules/advisory/events/advisory-event.service.ts`
- `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter.ts`
- `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.spec.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.spec.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts`

## Change Log

- 2026-05-19: Story context created for governed AI provider gateway.
- 2026-05-19: Generated ATDD RED acceptance artifacts for governed AI provider gateway.
- 2026-05-19: Implemented governed provider gateway, fake/live adapters, telemetry emission, retry/timeout/error handling, config, module wiring, and backend test coverage.
- 2026-05-19: Completed code review and fixed streaming token/cost metadata coverage.
- 2026-05-19: Completed traceability and PASS gate for Story 1.5.
