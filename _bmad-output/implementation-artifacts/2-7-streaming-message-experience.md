# Story 2.7: Streaming Message Experience

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want AI responses to stream with clear state and readable formatting,
so that I can trust the advisor is working and follow long answers comfortably.

## Acceptance Criteria

1. Given an AI response is being generated, when tokens arrive through SSE, then the message renders incrementally with a streaming indicator, and screen readers receive polite live-region updates without being overwhelmed.
2. Given the user scrolls during a streaming response, when new content arrives, then historical content remains readable and selectable, and the UI does not force-scroll away from the user's chosen reading position unless they are already at the bottom.
3. Given code or structured Markdown appears in a response, when the message renders, then Markdown and code blocks display consistently with the advisory design system, and user, AI, system, and later expert identities are distinguishable without relying on color alone.
4. Given long conversations accumulate many messages, when message count or rendered content exceeds the performance threshold, then the conversation area uses virtualized or lazy rendering where needed, and scrolling, selection, streaming, and screen-reader behavior remain usable.

## Tasks / Subtasks

- [x] Add Story 2.7 ATDD coverage artifacts before production code (AC: 1-4)
  - [x] Create `_bmad-output/test-artifacts/atdd-checklist-2-7-streaming-message-experience.md`.
  - [x] Define RED backend/API tests for SSE event shape, `text/event-stream` headers, ordered deltas, completion event, error event, and existing JSON `POST /messages` compatibility.
  - [x] Define RED frontend tests for incremental rendering, streaming indicator/cursor removal, aria-live batching, scroll anchoring, Markdown/code rendering, identity labels, and lazy rendering threshold behavior.
  - [x] Do not begin implementation until the acceptance coverage artifact exists.

- [x] Add a safe streaming transport without breaking Story 2.6 JSON message submission (AC: 1)
  - [x] Preserve existing `POST /advisory/sessions/:sessionId/messages` JSON behavior and current tests.
  - [x] Add a streaming endpoint or content-negotiated path for Story 2.7; prefer `POST /advisory/sessions/:sessionId/messages/stream` if that keeps the existing JSON endpoint stable.
  - [x] Keep `JwtAuthGuard`, `TenantGuard`, `@CurrentUser()`, and `@CurrentTenant()`; never accept `tenantId` from body, query, or SSE payload.
  - [x] The stream must emit UTF-8 SSE frames with deterministic event names such as `message.started`, `message.delta`, `message.completed`, and `message.error`.
  - [x] Set `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, and connection headers appropriate for the local Nest/Express stack; call `flushHeaders()` when available to avoid proxy buffering.
  - [x] Include keep-alive comments or heartbeat frames only if needed for connection stability; tests must not depend on real timers or live network behavior.
  - [x] Persist the user message before the provider call and persist the assistant message only after successful completion, matching Story 2.6 semantics.
  - [x] On provider failure, emit a recoverable error event and do not persist a corrupted assistant message unless it is explicitly marked failed and tested.

- [x] Reuse the governed provider gateway and tenant-scoped message persistence (AC: 1, 2)
  - [x] Extend `AdvisorySessionService` rather than creating a parallel workflow/chat service.
  - [x] Reuse `ThinkTankProviderGatewayService.stream(...)`; do not instantiate Anthropic/GLM SDK clients in sessions/UI code.
  - [x] Reuse `AdvisoryConversationMessageRepository.nextSequenceForSession()` and existing `conversation_messages` entity; Story 2.7 does not introduce new database tables.
  - [x] Stream only privacy-safe operational metadata to the client; never include raw system prompt, runtime file content, or telemetry payload internals in SSE events.
  - [x] Maintain current-step no-auto-advance behavior; Story 2.7 is streaming polish, not workflow progression.

- [x] Add Next proxy and typed frontend streaming client (AC: 1, 2)
  - [x] Add a Next App Router proxy route under `frontend/app/api/advisory/sessions/[sessionId]/messages/...` that forwards the streaming response with the NextAuth session token.
  - [x] Use Web `Response`/`ReadableStream` APIs in the route handler and keep `dynamic = 'force-dynamic'`.
  - [x] Add a narrow client helper in `frontend/lib/advisory/workflows.ts` or a new `frontend/lib/advisory/streaming.ts` that parses SSE blocks from `fetch()` using `ReadableStreamDefaultReader` + `TextDecoder`.
  - [x] Support abort/cancel via `AbortController`; closing the UI stream must stop reading and not leave `isStreaming` stuck.
  - [x] Keep existing `sendThinkTankSessionMessage()` JSON fallback available for non-streaming tests and error recovery.
  - [x] Tests must prove the proxy does not relay caller-supplied tenant fields and propagates backend status/error events safely.

- [x] Build streaming-aware advisory message rendering (AC: 1, 3)
  - [x] Extract message rendering from `AdvisoryWorkspaceShell.tsx` into a focused component such as `frontend/components/advisory/AdvisoryChatMessage.tsx` or `AdvisoryMessageList.tsx` if it reduces complexity.
  - [x] Render a pending assistant message immediately after user submission, append deltas as they arrive, and replace local ids with persisted ids on completion.
  - [x] Show a clear streaming state: current speaker label, subtle typing/streaming indicator, and cursor while streaming; remove the cursor after `message.completed`.
  - [x] Use `aria-live="polite"` for streaming updates, but batch/throttle announcements so screen readers are not notified for every token.
  - [x] Preserve professional minimal message styling: user right-aligned, advisor/system/expert left-aligned, role labels visible, 3px identity border, no decorative chat bubbles or nested cards.
  - [x] Add system role rendering support as a frontend type/display concern for future recovery/error messages; do not introduce backend system-message persistence unless tests require it.

- [x] Render Markdown and code safely (AC: 3)
  - [x] Prefer `react-markdown` plus `remark-gfm` for Markdown and `prism-react-renderer` for code highlighting if dependencies are added; update `frontend/package.json`, root `package-lock.json`, Jest transforms/mocks, and tests in the same commit.
  - [x] Do not enable raw HTML rendering for AI Markdown. `react-markdown` escapes or ignores HTML by default; keep that safety posture unless a later security-reviewed story explicitly changes it.
  - [x] If dependency friction is too high for this repo's Jest/Next setup, implement a deliberately small internal renderer for headings, paragraphs, lists, inline code, fenced code blocks, and links, and document the scope in the story completion notes.
  - [x] Code blocks must use CJK-compatible fonts from the UX spec, preserve selection, wrap or scroll predictably, and expose copy/select affordances only if they can be tested accessibly.

- [x] Preserve scroll position and long-conversation usability (AC: 2, 4)
  - [x] Track whether the conversation viewport is near the bottom before applying each streamed delta.
  - [x] Auto-scroll only when the user is already at or near the bottom; if the user scrolls upward, keep their position stable and show a keyboard-accessible "new content" affordance.
  - [x] Define a Story 2.7 threshold constant, for example `THINKTANK_MESSAGE_LAZY_RENDER_THRESHOLD`, based on message count and/or rendered character count.
  - [x] When the threshold is exceeded, lazy render older messages behind an accessible "show older messages" boundary or use a virtualization approach that does not break selection, focus, or live-region behavior.
  - [x] Tests must cover below-threshold normal rendering and above-threshold lazy/virtual rendering without relying on real layout measurements that JSDOM cannot provide.

- [x] Add focused automated tests and regression evidence (AC: 1-4)
  - [x] Backend/controller/proxy tests for streaming headers, event order, completion persistence, provider error recovery, tenant scoping, and no regression to existing JSON message submission.
  - [x] Frontend client parser tests for split SSE frames, named events, JSON parse errors, aborts, and completion/error handling.
  - [x] Frontend RTL tests for incremental deltas, streaming indicator, live-region batching, scroll-anchor behavior, Markdown/code rendering, identity labels, and lazy rendering.
  - [x] Run focused backend/frontend tests, `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit`, and pre-commit-equivalent validation before marking done.

## Dev Notes

### Source Requirements

- Story 2.7 owns streaming message experience: SSE token arrival, incremental rendering, streaming state, readable Markdown/code, scroll anchoring, and long-conversation performance. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.7]
- FR17 requires real-time streamed AI output during workflow execution. NFR1 requires first-token latency under 3 seconds P95; NFR6 requires the user submission-to-AI-start path under 5 seconds. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR17 / NFR1 / NFR6]
- UX-DR14 requires ChatMessage/MessageBubble with streaming state, Markdown rendering, code highlighting, copy/select support, role labels, 3px identity border, and screen-reader labels. UX-DR21 requires typing/streaming state, scroll usability during streaming, cursor removal after completion, and `aria-live="polite"`. UX-DR35 requires long-conversation performance testing and optimization such as virtual scrolling or lazy loading. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR14 / UX-DR21 / UX-DR35]
- Architecture chooses REST + SSE, not WebSocket, and says SSE must handle proxy buffering/`flushHeaders` and browser reconnect behavior. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Decision 3]
- Architecture says SSE updates should account for ordering/race conditions and can update frontend server state manually; current code has not introduced TanStack Query, so match existing local-state patterns unless this story deliberately adds the missing provider/dependency with tests. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Decision 4; `frontend/package.json`]

### Scope Boundaries

Do not implement these future capabilities in Story 2.7:

| Capability | Owning story |
| --- | --- |
| Live document drawer content, `workflow_outputs`, and AI-labeled report draft | Story 2.8 |
| Report viewing/export and PDF/Word generation | Story 2.9 |
| Prompt cache hit/miss and cost-aware workflow calls | Story 2.10 |
| Checkpoint persistence, recovery summaries, and interrupted session resume | Epic 4 |
| Party Mode expert orchestration and expert message rounds | Epic 5 |
| Workflow step advancement/continue endpoint | Not owned by Story 2.7 unless already introduced by an accepted predecessor |
| Conversation compression policy | Story 4.6 |

### Previous Story Intelligence

- Story 2.6 added `conversation_messages`, tenant-scoped repository, message list/submit endpoints, Next proxy route, `sendThinkTankSessionMessage()`, and guided conversation UI in `AdvisoryWorkspaceShell.tsx`.
- Story 2.6 deliberately collected provider chunks server-side and returned JSON; Story 2.7 should replace the user-visible waiting gap with true incremental browser rendering while keeping the JSON path for compatibility.
- Story 2.6 code review fixed message sequence monotonicity and duplicate shortcut registration. Do not reintroduce `count + 1` sequence logic or duplicate keydown listeners.
- Story 2.6 tests use role/label/text/title selectors and no production `data-testid`; continue that approach.
- Recent commits: `cebd6d1` Story 2.6 guided conversation, `28605e5` Story 2.5 workflow launch, `9bd9d22` Story 2.4 runtime file loading.

### Existing Patterns To Reuse

- Backend session orchestration: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
- Backend session routes: `backend/src/modules/advisory/sessions/advisory-session.controller.ts`.
- Provider gateway: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts` and `.types.ts`.
- Tenant-scoped messages: `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`.
- Frontend advisory client types: `frontend/lib/advisory/workflows.ts`.
- Next proxy pattern: `frontend/app/api/advisory/sessions/[sessionId]/messages/route.ts`.
- Workspace extension point: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
- UI primitives: shadcn-style local components in `frontend/components/ui/`, lucide icons, Tailwind tokens in the advisory shell.

### Backend Implementation Guidance

- Prefer adding `streamMessage(...)` or equivalent beside `submitMessage(...)`; share validation, tenant session lookup, message history conversion, provider gateway call, decision options, and metadata builders.
- SSE event payloads should be small and stable:
  - `message.started`: `{ sessionId, localCorrelationId?, currentStep }`
  - `message.delta`: `{ index, delta }`
  - `message.completed`: `{ sessionId, assistantMessage, currentStep, decisionOptions, usage? }`
  - `message.error`: `{ code, message }`
- Do not send provider metadata fields that are not already safe in Story 2.6. Do not send raw system prompt, assembled runtime source text, or hidden provider request details.
- If using manual Nest/Express streaming for a POST body, write frames as `event: name\ndata: json\n\n` and test serialization separately from HTTP plumbing where possible.
- If using `@Sse()`, remember NestJS expects an `Observable<MessageEvent>` and native `EventSource` is GET-oriented; do not contort the UX into query-string message content just to use EventSource.

### Frontend Implementation Guidance

- Prefer a small streaming state machine over scattered booleans: `idle | submitting | streaming | completing | error`.
- Keep optimistic user-message behavior from Story 2.6, but add a pending assistant message that is updated by deltas.
- Preserve focus on the textarea or conversation focus target after completion; keyboard shortcuts from Story 2.6 must still work.
- Do not use visible instructional text to explain streaming mechanics. Use compact states, labels, and accessible names.
- Ensure longest Markdown/code words cannot break layout: use `overflow-x-auto`, `break-words`, or code block scrolling with stable dimensions.
- Keep the conversation surface unframed and avoid nested cards. Individual messages can be bordered list items/articles.

### Latest Technical Notes

- Installed repo versions: NestJS 10.4.x, Next.js 14.2.x, React 18.3.x, TypeScript 5.6.x, Jest 29.7.x. Match these versions unless a dependency is intentionally added and locked.
- NestJS SSE official docs use `@Sse()` returning `Observable<MessageEvent>`; POST body streaming may require manual response handling instead. [Source: https://docs.nestjs.com/techniques/server-sent-events]
- Next.js 14 Route Handlers use standard Web `Request`/`Response` APIs and can return streams created with Web `ReadableStream`. [Source: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]
- MDN documents SSE as UTF-8 text blocks separated by double newlines, with named `event` fields and `data` lines; `text/event-stream`, no-cache, close/error handling, and connection limits matter. [Source: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events]
- `react-markdown` follows CommonMark by default and typically escapes or ignores raw HTML because raw HTML is dangerous; keep this default for AI-generated content. [Source: https://github.com/remarkjs/react-markdown]

### Testing Requirements

- Follow TDD: add failing backend/frontend tests before production changes.
- Focused backend commands:
  - `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand`
  - `cd backend && npx tsc --noEmit`
- Focused frontend commands:
  - `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`
  - `cd frontend && npx tsc --noEmit`
- If Markdown dependencies or Jest transforms change:
  - `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`
  - `cd frontend && npm run test --coverage -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand` if coverage risk is unclear.
- Pre-commit equivalent before commit:
  - `cd backend && npx lint-staged`
  - `cd frontend && npx lint-staged`
  - `node backend/scripts/detect-orm-risk-changes.js --staged`
- No test may depend on live LLM/network availability. Use deterministic async iterables and mocked stream readers.
- No production `data-testid`; tests must query by role, label, text, title, status, alert, accessible names, and semantic structure.

### Project Structure Notes

- Keep advisory UI components under `frontend/components/advisory/`; do not create generic chat components outside the module unless they are genuinely reusable.
- Keep frontend client helpers under `frontend/lib/advisory/`.
- Keep Next proxy routes under `frontend/app/api/advisory/sessions/[sessionId]/messages/`.
- Keep backend changes inside the existing advisory `sessions/` subdomain.
- BMAD artifacts belong under `_bmad-output/test-artifacts/` and are ignored by default; force-add them when committing.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 Story 2.7, UX-DR14, UX-DR21, UX-DR35.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR17, NFR1, NFR6.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - REST + SSE decision, frontend state management, SSE data flow, frontend quality gates.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - ChatMessage streaming/Markdown/code, typography, aria-live, long-conversation performance.
- `_bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md` - prior story implementation and compatibility boundary.
- `backend/src/modules/advisory/sessions/` - current session message orchestration and tests.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - current workspace message rendering to extract/refine.
- `frontend/lib/advisory/workflows.ts` - current message client types and JSON submit function.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.7, ThinkTank PRD FR17/NFR1/NFR6, architecture REST+SSE and frontend state notes, UX streaming/Markdown/long-conversation requirements, previous Story 2.6 implementation learnings, current backend/frontend advisory code, and official NestJS/Next.js/MDN/react-markdown references.
- 2026-05-20: ATDD artifact created before production code: `_bmad-output/test-artifacts/atdd-checklist-2-7-streaming-message-experience.md`.
- 2026-05-20: Backend RED/GREEN coverage added for SSE headers, event order, completion persistence, provider error recovery, tenant scoping, and JSON message regression.
- 2026-05-20: Frontend RED/GREEN coverage added for streaming proxy behavior, split SSE parsing, abort/error handling, incremental rendering, live-region status, scroll anchoring, Markdown/code rendering, identity labels, and lazy rendering.
- 2026-05-20: Verification passed: `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand`.
- 2026-05-20: Verification passed: `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`.
- 2026-05-20: Verification passed: `cd backend && npx tsc --noEmit`.
- 2026-05-20: Verification passed: `cd frontend && npx tsc --noEmit`.
- 2026-05-20: Code review patch findings fixed for abort propagation, pre-stream errors, SSE backpressure, empty streams, sequence races, malformed EOF recovery, Markdown code fences, aria-live throttling, scroll/lazy behavior, and stale stream guards.
- 2026-05-20: Traceability gate passed with 100% P0/P1/overall coverage; artifacts created under `_bmad-output/test-artifacts/`.

### Implementation Plan

- Generate ATDD artifacts before production code.
- Add RED backend/proxy/frontend tests for streaming transport, incremental UI, scroll anchoring, Markdown/code, and lazy rendering.
- Implement backend stream path while preserving existing JSON message submit.
- Add Next proxy and frontend streaming parser/client.
- Extract/refine message rendering and streaming state in the advisory workspace.
- Run focused tests, TypeScript validation, code review, traceability, status update, and commit.

### Completion Notes List

- Added tenant-scoped backend SSE streaming for advisory session messages using the existing provider gateway, message repository, and session validation path.
- Preserved existing JSON `POST /messages` submission behavior and regression coverage.
- Added a Next App Router streaming proxy and a typed frontend SSE parser/client with abort and recoverable error handling.
- Updated the advisory workspace to render optimistic user messages, pending assistant messages, incremental deltas, completion replacement, streaming cursor removal, polite live-region status, scroll anchoring, and a keyboard-accessible new-reply affordance.
- Extracted advisory message rendering into `AdvisoryChatMessage` with visible role labels for user, assistant, system, and expert identities.
- Implemented a deliberately small internal Markdown renderer for headings, lists, inline code, fenced code blocks, and safe links to avoid dependency and Jest transform churn in this story.
- Added long-conversation lazy rendering behind `THINKTANK_MESSAGE_LAZY_RENDER_THRESHOLD` while preserving semantic message roles and accessible controls.
- Fixed code-review hardening items: end-to-end abort propagation, controller pre-stream error handling, SSE backpressure, empty provider stream recovery, sequence transaction locking, malformed stream EOF recovery, throttled live-region announcements, stable scroll/lazy behavior, and stale-stream submit guards.
- Passed traceability quality gate with no remaining blocking gaps.

### File List

- `_bmad-output/implementation-artifacts/2-7-streaming-message-experience.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-7-streaming-message-experience.md`
- `_bmad-output/test-artifacts/code-review-story-2-7-streaming-message-experience.md`
- `_bmad-output/test-artifacts/traceability-story-2-7-streaming-message-experience-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-2-7-streaming-message-experience.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-7-streaming-message-experience.yaml`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-2-7-2026-05-20T07-25-00+08-00.json`
- `backend/src/database/migrations/1772000000032-MakeConversationMessageSequenceUnique.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.test.ts`
- `frontend/components/advisory/AdvisoryChatMessage.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/jest.setup.js`
- `frontend/lib/advisory/streaming.test.ts`
- `frontend/lib/advisory/streaming.ts`
- `frontend/lib/advisory/workflows.ts`

## Change Log

- 2026-05-20: Story context created and marked ready-for-dev.
- 2026-05-20: Implemented streaming message transport, frontend streaming experience, Markdown/code rendering, scroll anchoring, lazy rendering, and focused verification; marked ready for review.
- 2026-05-20: Completed code review fixes, traceability PASS gate, and marked story done.
