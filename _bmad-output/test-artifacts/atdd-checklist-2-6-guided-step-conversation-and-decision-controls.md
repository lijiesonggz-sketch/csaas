---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T05:45:13+08:00'
storyId: 2-6-guided-step-conversation-and-decision-controls
inputDocuments:
  - _bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md
  - _bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md
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
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist: Story 2.6 Guided Step Conversation and Decision Controls

## Step 1: Preflight and Context

- Detected stack: fullstack repository.
- Story file loaded: `_bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md`.
- Acceptance criteria extracted: governed AI gateway streaming path, `conversation_messages`, cross-tenant isolation, telemetry privacy, no automatic workflow advancement, in-message decision controls, and keyboard shortcuts.
- Test frameworks detected:
  - Backend: Jest/ts-jest via `backend/package.json`.
  - Frontend: Jest + React Testing Library + jest-axe via `frontend/package.json`.
  - Browser E2E framework exists at `frontend/playwright.config.ts`, but Story 2.6 ATDD uses existing advisory RTL/Jest coverage first because the shell tests are colocated Jest specs and do not need a live server.
- Pact/CDC note: `tea_use_pactjs_utils` is enabled in TEA config, but this repo has no Pact dependency or pact scripts. Contract coverage is provided by in-repo controller/proxy tests for this story.
- Browser recording: skipped. Existing semantic roles/labels in the advisory shell give stable selectors without a running browser session.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: acceptance criteria are explicit, target APIs/components are in-repo, and RED tests can be generated directly from story context plus existing advisory session/workflow patterns.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | User answer is persisted, sent through `ThinkTankProviderGatewayService.stream`, and assistant chunks are collected into an advisor message | Backend service | P0 | Missing message repository/provider orchestration fails compilation |
| AC1 | Backend response exposes assistant message, stream chunk metadata, current step, and step options | Backend service/controller | P0 | Missing submit endpoint/service method fails compilation |
| AC1 | Frontend submits through `/api/advisory/sessions/:id/messages` and renders user/advisor messages | Frontend client + RTL | P0 | Missing client/proxy/UI fails compilation |
| AC2 | `conversation_messages` repository injects tenant scope, strips caller-supplied tenant, and orders by sequence | Backend repository | P0 | Missing entity/repository fails compilation |
| AC2 | Cross-tenant read/update/delete returns not-found/false without inference | Backend repository/service | P0 | Missing tenant-scoped repository methods fail compilation |
| AC2 | Provider metadata and event payloads do not contain raw content/message/prompt keys or submitted text | Backend service | P0 | Missing privacy assertions fail |
| AC3 | Advisor response with ready-to-proceed options does not increment `workflow_sessions.currentStep` without explicit confirmation | Backend service + frontend RTL | P0 | Missing no-auto-advance guard fails |
| AC4 | Enter submits, Shift+Enter inserts newline, empty submit is blocked, draft is autosaved | Frontend RTL/client | P0 | Existing UI has no Textarea |
| AC4 | In-message decision controls expose C/A/R/P shortcuts and disabled Party Mode state | Frontend RTL | P0 | Existing UI has no decision controls |
| AC4 | Escape and Ctrl+D keep focus/draft stable and expose shortcut hints through labels/tooltips | Frontend RTL | P1 | Existing UI has no message input shortcut handling |

## Step 4: Failing Tests Generated

Created RED backend tests:

- `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`

Created/updated RED frontend tests:

- `frontend/lib/advisory/messages.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/route.test.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`

No production `data-testid` requirements are introduced. Advisory UI tests must use role, label, title, text, status, alert, and accessible-name selectors.

Expected RED commands:

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand
```

Actual RED evidence:

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
```

Result: failed before implementation because `advisory-conversation-message.entity`, `AdvisoryConversationMessageRepository`, `submitMessage`, `listMessages`, and message controller methods do not exist yet. Existing Story 2.5 session suites still passed.

```bash
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand
```

Result: passed with 10 Story 2.6 RED tests skipped intentionally by `test.skip`; existing advisory suites passed.

## Green Phase Checklist For Dev

- Implement `AdvisoryConversationMessage` entity and `conversation_messages` migration.
- Register the entity in backend TypeORM entity exports/config and `AdvisoryModule`.
- Implement `AdvisoryConversationMessageRepository` using `BaseRepository`.
- Extend `AdvisorySessionService` with `listMessages` and `submitMessage`.
- Use `ThinkTankProviderGatewayService.stream(...)`; do not call Anthropic/GLM SDK directly.
- Persist user messages before provider call and advisor messages after successful stream collection.
- Keep `workflow_sessions.currentStep` unchanged unless explicit continuation is implemented and invoked.
- Ensure provider/audit/telemetry metadata excludes raw message content and raw-sensitive keys.
- Add backend controller routes:
  - `GET /advisory/sessions/:sessionId/messages`
  - `POST /advisory/sessions/:sessionId/messages`
- Add frontend message client and Next proxy route.
- Update `AdvisoryWorkspaceShell` to render conversation messages, Textarea input, submit state, draft autosave, decision controls, and shortcut hints.
- Remove `test.skip` from the RED tests after implementation, then run focused backend/frontend suites.

## Step 5: Validate and Complete

- Prerequisites satisfied: Story 2.6 has testable ACs and both backend/frontend test frameworks exist.
- Test files created/updated in existing project locations rather than generic `tests/` because this repository uses colocated Jest/RTL specs.
- Checklist maps every Story 2.6 AC to RED tests and implementation tasks.
- RED tests are intentionally marked with `test.skip` until dev-story implements the missing behavior; backend missing imports/methods also prove the feature is absent before implementation.
- CLI/browser sessions: N/A; no browser automation session opened.
- Temp artifacts stored under `_bmad-output/test-artifacts/tmp/`.

## Next Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

**Generated by BMad TEA Agent** - 2026-05-20T05:45:13+08:00
