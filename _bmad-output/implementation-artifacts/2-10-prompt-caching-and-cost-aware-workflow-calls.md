# Story 2.10: Prompt Caching and Cost-Aware Workflow Calls

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want repeated workflow prompts and persona content to be cached and measured,
so that structured advisory sessions remain economically sustainable.

## Acceptance Criteria

1. Given a workflow call reuses stable system prompt, workflow definition, or persona content, when the AI gateway assembles the request, then it applies the configured prompt-caching strategy where supported, records estimated input/output tokens, cache status, latency, and cost metadata, and cache reuse emits telemetry event `thinktank.prompt_cache.hit` where supported.
2. Given prompt caching is unavailable or unsupported, when a workflow call proceeds, then the system still completes the user-visible action and telemetry event `thinktank.prompt_cache.miss` indicates that caching was missed or bypassed.
3. Given an automated test suite runs, when workflow calls are executed through the fake provider, then tests assert cache metadata and cost telemetry without real LLM calls and no test depends on live GLM.

## Tasks / Subtasks

- [x] Add Story 2.10 ATDD coverage artifacts before production code (AC: 1-3)
  - [x] Create `_bmad-output/test-artifacts/atdd-checklist-2-10-prompt-caching-and-cost-aware-workflow-calls.md`.
  - [x] Define RED provider-gateway tests for cache hit/miss/bypass telemetry, token metadata, cost metadata, retry behavior, and privacy-safe event payloads.
  - [x] Define RED session tests for submit and SSE stream paths persisting safe cache metadata into assistant `providerMetadata`.
  - [x] Define RED adapter tests for fake deterministic cache metadata and GLM/Z.AI usage normalization without live network calls.
  - [x] Do not begin production implementation until the acceptance coverage artifact exists.

- [x] Extend provider gateway cache/cost contracts without breaking existing callers (AC: 1-3)
  - [x] Extend `ThinkTankProviderRequest`, `ThinkTankProviderResponse`, and `ThinkTankProviderStreamChunk` with prompt-cache strategy/status fields.
  - [x] Keep legacy `usage.inputTokens`, `usage.outputTokens`, and `usage.totalTokens` populated for all providers.
  - [x] Add optional safe cache fields such as `cacheStatus`, `cacheStrategy`, `cacheKey`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `cachedInputTokens`, and `cacheEligibleInputTokens`.
  - [x] Never add raw prompt, messages, workflow source content, report content, or persona text to request metadata, event metadata, or persisted `providerMetadata`.
  - [x] Preserve `thinktank.provider.call_completed`, `.call_failed`, and `.call_retried` semantics while adding cache-aware metadata to completed calls.

- [x] Add a prompt-cache policy/helper in the existing advisory provider/runtime boundary (AC: 1, 2)
  - [x] Prefer a focused helper under `backend/src/modules/advisory/provider-gateway/` or `backend/src/modules/advisory/runtime/`; do not introduce a new top-level module.
  - [x] Use `ThinkTankPromptAssemblerService` output and `sources[].contentHash` to compute stable cache identity; hash path/hash/model/workflow/strategy only, not raw content.
  - [x] Cache stable workflow definition, first prompt, method library, and agent persona material at the start of the system prompt.
  - [x] Keep dynamic message history and user input outside the cacheable static identity.
  - [x] Reassemble or retrieve the workflow prompt for each provider call so the gateway receives real runtime source material instead of the current short placeholder system prompt.
  - [x] Treat unsupported/disabled cache as `bypass`, not as a user-visible failure.

- [x] Implement provider-specific cache behavior and metadata normalization (AC: 1-3)
  - [x] Extend `FakeThinkTankProviderAdapter` so tests can deterministically produce `hit`, `miss`, and `bypass` cache statuses.
  - [x] Extend `AnthropicGlmProviderAdapter` to normalize both Anthropic-style usage fields (`cache_read_input_tokens`, `cache_creation_input_tokens`) and Z.AI/GLM-style `usage.prompt_tokens_details.cached_tokens`.
  - [x] For GLM/Z.AI context caching, rely on provider automatic caching and observe `cached_tokens`; do not send unsupported manual cache directives unless config explicitly declares Anthropic-compatible explicit cache support.
  - [x] For Anthropic-compatible explicit cache support, apply `cache_control` only to stable system/content blocks where the SDK endpoint supports it.
  - [x] If cache metadata is absent, continue the user action and emit `thinktank.prompt_cache.miss` with `cacheStatus` = `miss` or `bypass`.
  - [x] Estimate cost using uncached input, cache read/write tokens where present, output tokens, and provider-specific safe fallback pricing; keep the old estimate path for providers without cache detail.

- [x] Emit privacy-safe prompt-cache telemetry (AC: 1, 2)
  - [x] Emit `thinktank.prompt_cache.hit` when a provider response confirms cache reuse.
  - [x] Emit `thinktank.prompt_cache.miss` when cache was enabled but no reuse occurred, unsupported, disabled, or bypassed.
  - [x] Use `ThinkTankSubjectType.ProviderCall`, `ThinkTankPrivacyClassification.Operational`, existing tenant/actor/correlation IDs, and the provider call subject id.
  - [x] Include only safe metadata: provider, model, workflow key, step index, cache status, cache strategy, cache key/hash, input/output/total tokens, cache read/create/cached tokens, latency, estimated cost, and bypass reason.
  - [x] Do not duplicate raw-sensitive keys blocked by `assertNoRawSensitiveThinkTankKeys`.
  - [x] Keep telemetry best-effort for cache events; cache telemetry failure must not break user-visible workflow completion.

- [x] Persist and expose safe cache metadata through existing session/message paths (AC: 1, 2)
  - [x] Update both `submitMessage` and `streamMessage` in `AdvisorySessionService`.
  - [x] Persist safe assistant `providerMetadata` fields for provider/model/latency/cost/tokens/cache status/cache token counts.
  - [x] Extend frontend metadata readers only if the UI or tests need to observe cache fields; keep user-facing workflow behavior unchanged.
  - [x] Do not expose raw system prompts, assembled runtime source, message history, or provider raw payloads in API responses.

- [x] Add focused automated tests and regression evidence (AC: 1-3)
  - [x] Backend tests for provider gateway complete and stream cache telemetry, fake provider deterministic hit/miss/bypass, GLM usage normalization, cost estimates, privacy guard rejection, and request validation.
  - [x] Backend session tests for submit/SSE cache metadata persistence and no raw prompt leakage in provider metadata/events.
  - [x] Frontend tests only for safe metadata parsing if cache metadata is displayed or consumed by existing advisory UI.
  - [x] Run focused backend advisory tests, focused frontend advisory tests if touched, `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit` if frontend changed, `git diff --check`, and pre-commit-equivalent validation before marking done.

## Dev Notes

### Source Requirements

- Story 2.10 owns `FR45`, `NFR2`, and `NFR3` for Epic 2: repeated workflow prompts/persona content must be cached where supported and measured so workflow calls remain economically sustainable. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.10]
- FR45 requires prompt caching to reduce repeated LLM token consumption by at least 80%; NFR2 requires quick consult cost below ¥2; NFR3 requires a full workflow below ¥10 with prompt caching and later conversation compression. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR45 / NFR2 / NFR3]
- ThinkTank must use a unified LLM service/gateway boundary with adapter translation for GLM-compatible calls; feature code must not instantiate provider SDKs directly. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - LLM API 调用架构 / NFR17]
- Runtime source-of-truth remains `_bmad/` workflow, step, method-library, and agent files. Prompt construction must stay file-driven and pass through the existing brand-mapping/runtime loader boundary. [Source: `_bmad-output/planning-artifacts/epics.md` - Additional Requirements]
- Architecture identifies Prompt Assembly and Caching Strategy as cross-cutting concerns; prompt caching, method-library caching, and workflow-definition caching belong in the runtime/provider flow, not in UI state. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - System Architecture]

### Scope Boundaries

Do not implement these capabilities in Story 2.10:

| Capability | Owning story / reason |
| --- | --- |
| Usage aggregation dashboards | Epic 6, especially Stories 6.2 and 6.3 |
| Budget limits, quota enforcement, warnings, or Party Mode budget controls | Epic 5 / Epic 6 |
| Conversation context compression | Story 4.6 |
| New workflow output/report persistence | Already owned by Stories 2.8 and 2.9 |
| Live GLM integration tests | Forbidden by AC3; use fake/mocked provider responses |
| New Redis cache or database tables | Not required for provider-side prompt caching metadata; only add if strictly justified |
| Raw prompt/source observability in events or API responses | Violates advisory privacy guardrails |

### Previous Story Intelligence

- Story 1.5 established the governed provider gateway, fake provider, retry/timeout handling, and provider telemetry events. Extend that gateway instead of creating a parallel LLM service.
- Story 2.4 created runtime file loading, workflow registry, prompt assembler, source refs, source content hashes, and brand mapping. Reuse `ThinkTankPromptAssemblerService` and `sources[].contentHash`; do not parse `_bmad/` files again in a new subsystem.
- Story 2.5/2.6/2.7 wired session launch, message submit, SSE stream, decision controls, and safe provider metadata persistence. Both non-stream and stream paths must stay behaviorally aligned.
- Story 2.8/2.9 introduced output draft/export and explicitly deferred prompt-cache and cost-aware workflow-call work to Story 2.10. Do not regress document drawer, export, AI label, or audit behavior.
- Story 2.9 validation passed with focused backend/frontend advisory suites and TypeScript checks; use the same validation discipline.

### Existing Patterns To Reuse

- Provider types and gateway orchestration: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts` and `thinktank-provider-gateway.service.ts`.
- Provider config and DI registration: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.ts` and `backend/src/modules/advisory/advisory.module.ts`.
- Fake provider adapter for deterministic tests: `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter.ts`.
- GLM adapter boundary: `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter.ts`.
- Runtime prompt assembly: `backend/src/modules/advisory/runtime/prompt-assembler.service.ts` and `runtime.types.ts`.
- Session submit/SSE persistence: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
- Event contract and registry: `backend/src/modules/advisory/events/thinktank-event-contract.ts`, `thinktank-event-registry.ts`, and `advisory-event.service.ts`.
- Frontend safe provider metadata reader, if needed: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.

### Backend Implementation Guidance

- Suggested normalized cache metadata shape:
  - `cacheStatus: 'hit' | 'miss' | 'bypass'`
  - `cacheStrategy: 'provider-auto' | 'anthropic-explicit' | 'disabled' | 'unsupported'`
  - `cacheKey: string` as a deterministic hash of workflow key, source refs/hashes, provider, model, and strategy
  - `cacheReadInputTokens`, `cacheCreationInputTokens`, `cachedInputTokens`, `cacheEligibleInputTokens`
  - `cacheBypassReason?: 'disabled' | 'unsupported' | 'no_static_prompt' | 'provider_metadata_absent'`
- Suggested request flow for `AdvisorySessionService`:
  - Assemble runtime prompt with `includeMethodLibraries: true` and `includeAgentSources: true`.
  - Build provider `system` from stable assembled workflow/persona material plus a small dynamic step instruction block.
  - Attach cache policy metadata derived from hashes, not content.
  - Keep conversation messages unchanged and dynamic.
- Do not store assembled prompt text in `workflow_sessions.metadata` or `conversation_messages.providerMetadata`. If a future optimization wants persistence, persist only source refs/hashes and rehydrate through the runtime file provider.
- Provider telemetry should keep `estimatedTokens` equal to normalized total tokens and add cache token breakdown in metadata.
- `thinktank.prompt_cache.hit` and `.miss` should be emitted separately from `thinktank.provider.call_completed`; both can share correlation id and subject id.
- Cache telemetry should be best effort like current provider telemetry. Provider call completion must not fail because cache telemetry could not be written.
- If a provider streams chunks, ensure the final chunk carries usage/cache metadata so session persistence and SSE completion events receive the same metadata as complete calls.

### Provider Notes

- Anthropic prompt caching uses cache breakpoints such as `cache_control` and reports `cache_creation_input_tokens`, `cache_read_input_tokens`, and `input_tokens` in `usage`; total input is the sum of read, creation, and regular input tokens. [Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching]
- Anthropic cache hits require identical prompt segments up to the cache breakpoint and stable block ordering; place stable workflow/persona content at the start and dynamic user input after it. [Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching]
- Z.AI/GLM context caching is documented as automatic recognition of repeated context, suitable for repeated system prompts/conversation history, and exposes cached token counts through `usage.prompt_tokens_details.cached_tokens`. [Source: https://docs.z.ai/guides/capabilities/cache]
- Z.AI/GLM docs say caching is automatically triggered and minor formatting differences can affect effectiveness; therefore keep stable system prompt formatting deterministic across repeated workflow calls. [Source: https://docs.z.ai/guides/capabilities/cache]

### Testing Requirements

- Follow TDD: add failing acceptance tests and ATDD artifact before production code.
- Focused backend commands:
  - `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions src/modules/advisory/events --runInBand`
  - `cd backend && npx tsc --noEmit`
- Focused frontend commands if frontend metadata/UI changes:
  - `cd frontend && npm run test -- components/advisory lib/advisory --runInBand`
  - `cd frontend && npx tsc --noEmit`
- Pre-commit equivalent before commit:
  - `cd frontend && npx lint-staged`
  - `cd backend && npx lint-staged`
  - `node backend/scripts/detect-orm-risk-changes.js --staged`
- No test may depend on live GLM, external network, actual provider cache state, or timing-sensitive cache warmup. Mock adapter responses and usage payloads deterministically.
- No production `data-testid`; tests must query by role, label, text, status, alert, or direct service contracts.

### Project Structure Notes

- Keep prompt-cache code inside advisory runtime/provider-gateway boundaries.
- Keep cache metadata snake_case in persisted provider metadata when matching existing message storage patterns.
- Keep public TypeScript types camelCase at frontend read boundaries.
- BMAD artifacts under `_bmad-output/` are gitignored; force-add them when committing.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2, Story 2.10, FR45/NFR2/NFR3 mappings.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - LLM API architecture, prompt caching, FR45, NFR2, NFR3, NFR17, NFR18.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - Runtime prompt builder, caching strategy, provider/adapter boundary, tenant isolation clarification.
- `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md` - provider gateway foundations.
- `_bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md` - prompt assembler and runtime source refs.
- `_bmad-output/implementation-artifacts/2-7-streaming-message-experience.md` - SSE/provider metadata behavior.
- `_bmad-output/implementation-artifacts/2-9-report-viewing-and-export.md` - previous story regression and validation context.
- `backend/src/modules/advisory/provider-gateway/`
- `backend/src/modules/advisory/runtime/`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/events/`
- `https://platform.claude.com/docs/en/build-with-claude/prompt-caching`
- `https://docs.z.ai/guides/capabilities/cache`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.10, ThinkTank PRD FR45/NFR2/NFR3/NFR17/NFR18, architecture prompt-builder/provider-gateway guidance, Story 1.5/2.4/2.7/2.9 implementation learnings, current advisory provider/runtime/session/event code, and official Anthropic/Z.AI cache references.

### Implementation Plan

- Generate ATDD artifact and RED tests first.
- Extend provider gateway types/config/cache policy and fake/GLM adapter normalization.
- Route assembled runtime prompt and cache policy through submit/SSE workflow calls.
- Emit provider and prompt-cache telemetry with safe cache/cost metadata.
- Persist safe cache metadata into assistant messages and adjust frontend readers only if needed.
- Run focused tests, TypeScript validation, code review, traceability, status update, and commit.

### Completion Notes List

- 2026-05-20: 已完成 Story 2.10 prompt-cache/cost-aware provider gateway 实现；缓存策略、状态、token breakdown、cost、latency 通过 provider gateway、session persistence、frontend safe metadata forwarding 贯通。
- 2026-05-20: 新增 `ThinkTankPromptCachePolicy` helper，使用 workflow key、source refs/content hashes、provider、model、strategy 生成稳定 cache identity；`step_index` 仅用于 telemetry，不参与静态缓存 key，不保存 raw prompt/source/persona/report/message 内容。
- 2026-05-20: `AdvisorySessionService.submitMessage` 与 `streamMessage` 均重新使用 `ThinkTankPromptAssemblerService` 组装 runtime prompt，并将稳定 workflow/persona/method material 置于 system prompt 起始位置。
- 2026-05-20: Fake provider 支持 deterministic `hit`/`miss`/`bypass`，GLM adapter 支持 Anthropic-style 与 Z.AI/GLM-style cache usage normalization；provider-auto GLM 请求不发送 unsupported `cache_control`。
- 2026-05-20: Provider completed telemetry 保持原语义，同时 best-effort 发出 `thinktank.prompt_cache.hit` / `thinktank.prompt_cache.miss`；metadata 仅包含安全字段。
- 2026-05-20: 补强 streaming 边界：gateway 会把 inferred/accumulated cache metadata 归一化到最终 yielded stream chunk，确保 SSE assistant message 与 completion telemetry 一致。
- 2026-05-20: Code review 修复完成：移除 stepIndex cache identity 参与项；缺失 provider cache usage 时标记 `bypass/provider_metadata_absent`；fallback prompt assembly 仍发送 disabled cache policy；GLM `anthropic-explicit` 默认降级为 unsupported，显式配置开启时才发送 `cache_control`；cache source/key/status/strategy/reason 加安全校验。
- 2026-05-20: 验证通过：Story backend focused tests 34 passed；backend advisory focused regression 19 suites/112 tests passed；frontend advisory/lib focused regression 10 suites/40 tests passed；frontend output focused tests 2 suites/11 tests passed；`cd backend && npx tsc --noEmit` passed；`cd frontend && npx tsc --noEmit` passed；`git diff --check` passed。
- 2026-05-20: 完整回归通过：`cd backend && npm run test -- --runInBand` 291 suites passed, 16 skipped, 2606 tests passed, 69 skipped, 5 todo；`cd frontend && npm run test -- --runInBand` 135 suites passed, 2 skipped, 1353 tests passed, 23 skipped。
- 2026-05-20: Traceability and gate 完成：Story 2.10 requirements coverage 3/3 FULL，P0 coverage 100%，overall coverage 100%，gate decision PASS；无 traceability blocker。

### File List

- `_bmad-output/implementation-artifacts/2-10-prompt-caching-and-cost-aware-workflow-calls.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-10-prompt-caching-and-cost-aware-workflow-calls.md`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-10-prompt-caching-and-cost-aware-workflow-calls.json`
- `_bmad-output/test-artifacts/traceability-report-story-2-10-prompt-caching-and-cost-aware-workflow-calls.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-10-prompt-caching-and-cost-aware-workflow-calls.yaml`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-2-10-2026-05-20T13-03-29+08-00.json`
- `backend/src/modules/advisory/provider-gateway/thinktank-prompt-cache-policy.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.spec.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.types.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
- `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.prompt-cache.spec.ts`
- `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter.ts`
- `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.prompt-cache.spec.ts`
- `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter.ts`
- `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.prompt-cache.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/advisory-session.prompt-cache.spec.ts`
- `frontend/lib/advisory/outputs.ts`
- `frontend/lib/advisory/outputs.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`

### Change Log

- 2026-05-20: Created Story 2.10 implementation context and marked ready for development.
- 2026-05-20: Added ATDD coverage artifact and deterministic backend/frontend prompt-cache tests.
- 2026-05-20: Implemented prompt-cache policy, provider gateway metadata normalization, fake/GLM adapter cache usage support, session persistence, and frontend safe metadata forwarding.
- 2026-05-20: Completed dev-story validation and moved Story 2.10 to review.
- 2026-05-20: Completed code-review fixes for cache identity stability, provider metadata absence handling, streaming metadata accumulation, explicit cache support gating, and safe metadata validation.
- 2026-05-20: Completed traceability matrix and deterministic PASS gate; marked Story 2.10 done.
