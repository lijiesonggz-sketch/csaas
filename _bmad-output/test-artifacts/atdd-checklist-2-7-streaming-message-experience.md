---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T06:54:00+08:00'
storyId: 2-7-streaming-message-experience
inputDocuments:
  - _bmad-output/implementation-artifacts/2-7-streaming-message-experience.md
  - _bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad-output/planning-artifacts/ux-design-specification-thinktank.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/ci-burn-in.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-overview.md
  - _bmad/tea/testarch/knowledge/contract-testing.md
---

# ATDD Checklist: Story 2.7 Streaming Message Experience

## Step 1: Preflight and Context

- Detected stack: fullstack repository.
- Story file loaded: `_bmad-output/implementation-artifacts/2-7-streaming-message-experience.md`.
- Acceptance criteria extracted: SSE incremental rendering, streaming indicator and polite announcements, scroll anchoring, Markdown/code rendering, non-color-only identities, and lazy rendering for long conversations.
- Test frameworks detected:
  - Backend: Jest/ts-jest via `backend/package.json`.
  - Frontend: Jest + React Testing Library via `frontend/package.json`.
  - Browser E2E framework exists at `frontend/playwright.config.ts`, but this story uses existing colocated Jest/RTL advisory suites first because streaming parser, proxy, and shell behavior can be tested deterministically without a live browser.
- Pact/CDC note: `tea_use_pactjs_utils` is enabled, but this repo has no Pact dependencies or scripts. Contract coverage is provided by backend controller/service tests and Next proxy tests with provider source scrutiny from in-repo handlers.
- Browser recording: skipped. Existing advisory shell tests already use semantic roles, labels, text, titles, status, and alert selectors; no production `data-testid` is required.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: Story 2.7 has explicit API and UI requirements, provider source is in-repo, and deterministic RED tests can be generated from existing Story 2.6 message patterns.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | Backend `POST /advisory/sessions/:sessionId/messages/stream` emits `message.started`, ordered `message.delta`, and `message.completed` SSE events with `text/event-stream` headers | Backend controller/service | P0 | Missing stream method/route fails compilation |
| AC1 | Provider failure emits `message.error` and does not persist a corrupted assistant message | Backend service | P0 | Missing recoverable stream error path fails |
| AC1 | Existing JSON `POST /messages` still returns collected response data | Backend/frontend regression | P0 | Existing Story 2.6 tests must continue passing |
| AC1 | Next proxy streams backend SSE without relaying caller-supplied tenant fields | Frontend route handler | P0 | Missing stream proxy fails compilation |
| AC1 | Client parser handles split SSE frames, named events, completion/error events, JSON parse errors, and abort signals | Frontend unit | P0 | Missing parser/client fails compilation |
| AC1 | UI renders pending assistant content incrementally, shows/removes streaming indicator, and uses polite live-region updates | Frontend RTL | P0 | Current JSON submit path waits for completion |
| AC2 | User scrolling upward during streaming is not forced to bottom; keyboard-accessible new content affordance appears | Frontend RTL | P0 | Current shell has no scroll anchoring |
| AC3 | Markdown headings, lists, links, inline code, and fenced code blocks render safely without raw HTML | Frontend component/RTL | P0 | Current shell only uses `white-space: pre-wrap` |
| AC3 | User, AI, system, and future expert messages are distinguishable by visible labels and structure, not color alone | Frontend component/RTL | P1 | Current type only supports user/assistant |
| AC4 | Long conversation threshold lazy-renders older messages behind an accessible boundary while retaining latest streaming behavior | Frontend RTL | P1 | Current shell renders all messages |

## Step 4: Failing Tests Created

Created/updated RED backend tests:

- `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`

Created/updated RED frontend tests:

- `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.test.ts`
- `frontend/lib/advisory/streaming.test.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`

No production `data-testid` attributes are introduced. Selectors must remain role/label/text/title/status/alert based.

Expected RED commands before implementation:

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand
```

Expected RED failures:

- Backend: `streamMessage`, `writeSseEvent`, and stream controller route do not exist yet.
- Frontend: stream proxy route, `streamThinkTankSessionMessage`, and streaming-aware message UI do not exist yet.

## Green Phase Checklist For Dev

- Add backend streaming event types and stable SSE serializer.
- Add `AdvisorySessionService.streamMessage(...)` beside existing `submitMessage(...)`, reusing tenant session lookup, message repository, and `ThinkTankProviderGatewayService.stream(...)`.
- Preserve JSON `submitMessage(...)` behavior and current tests.
- Add `POST /advisory/sessions/:sessionId/messages/stream` with `JwtAuthGuard`, `TenantGuard`, `@CurrentUser()`, and `@CurrentTenant()`.
- Set SSE headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, and flush headers when supported.
- Add Next App Router stream proxy under `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.ts`.
- Add a typed streaming parser/client under `frontend/lib/advisory/streaming.ts`; support split frames and abort.
- Update `AdvisoryWorkspaceShell` to use the streaming client, render pending assistant deltas, live-region updates, scroll anchoring, and lazy rendering.
- Add safe internal Markdown/code rendering without raw HTML unless dependencies are deliberately added.
- Run focused backend/frontend suites and TypeScript checks.

## Step 5: Validate and Complete

- Prerequisites satisfied: Story 2.7 has testable ACs and both backend/frontend test frameworks exist.
- Test files are placed in existing project locations rather than generic `tests/` because this repository uses colocated Jest/RTL specs.
- Checklist maps all Story 2.7 ACs to executable acceptance tests and concrete implementation tasks.
- CLI/browser sessions: N/A; no browser automation session opened.
- Temp artifacts: N/A; the final checklist is stored under `_bmad-output/test-artifacts/`.

## Next Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

**Generated by BMad TEA Agent** - 2026-05-20T06:54:00+08:00
