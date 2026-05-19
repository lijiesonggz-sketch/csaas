# Story 2.6: Guided Step Conversation and Decision Controls

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want each workflow step to guide me with questions, summaries, and explicit continuation choices,
so that I stay in control of the consulting process.

## Acceptance Criteria

1. Given a workflow step is active, when the user answers the AI prompt, then the system sends the answer through the governed AI gateway and streams the advisor response, and the response can include step-specific options such as continue, deepen, revise, or Party Mode where the workflow definition allows it.
2. Given `conversation_messages` is introduced by this story, when user and advisor messages are persisted or retrieved, then tests prove cross-tenant reads, updates, and deletes are rejected, and raw message content is never copied into telemetry payloads.
3. Given the AI indicates a step is ready to proceed, when the user has not confirmed continuation, then the workflow does not advance automatically, and the input remains available for follow-up questions or deeper exploration.
4. Given keyboard shortcuts are active, when the user uses Enter, Shift+Enter, Escape, Ctrl+D, or active decision keys, then the expected action occurs without breaking focus management, and shortcut hints are discoverable through tooltips or accessible labels.

## Tasks / Subtasks

- [x] Add Story 2.6 ATDD coverage artifacts before production code (AC: 1-4)
  - [x] Create `_bmad-output/test-artifacts/atdd-checklist-2-6-guided-step-conversation-and-decision-controls.md`.
  - [x] Define RED backend tests for message persistence, tenant isolation, provider gateway streaming, no raw content telemetry, and no auto-advance.
  - [x] Define RED frontend tests for message input, submitted/advisor messages, in-message decision controls, shortcuts, focus, draft persistence, and accessibility labels/tooltips.
  - [x] Do not begin implementation until acceptance coverage artifacts exist.

- [x] Introduce tenant-scoped `conversation_messages` persistence (AC: 2)
  - [x] Add `backend/src/database/entities/advisory-conversation-message.entity.ts` mapped to table `conversation_messages`.
  - [x] Include UUID `id`, `tenantId`, `sessionId`, `actorId`, `role`, raw `content`, `sequence`, `workflowKey`, `stepIndex`, `decisionOptions`, privacy-safe `metadata`, `providerMetadata`, `createdAt`, and `updatedAt`.
  - [x] Add a TypeORM migration creating `conversation_messages` with non-null `tenant_id`, `session_id`, `role`, `content`, sequence ordering, JSONB option/metadata columns, indexes on tenant/session/sequence and tenant/session/created_at, and FK to `workflow_sessions(id)`.
  - [x] Register the entity in `backend/src/database/entities/index.ts`, `backend/src/config/typeorm.entities.ts`, and `TypeOrmModule.forFeature(...)` in `backend/src/modules/advisory/advisory.module.ts`.
  - [x] Implement `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts` extending `BaseRepository<AdvisoryConversationMessage>`.
  - [x] Repository tests must prove BaseRepository strips caller-supplied `tenantId`, scopes reads/updates/deletes by current tenant, and rejects cross-tenant inference.

- [x] Add message submission and retrieval backend APIs (AC: 1-3)
  - [x] Extend the existing `sessions/` subdomain instead of creating a separate workflow stack.
  - [x] Expose `GET /advisory/sessions/:sessionId/messages` and `POST /advisory/sessions/:sessionId/messages`.
  - [x] Protect endpoints with `@UseGuards(JwtAuthGuard, TenantGuard)`, `@CurrentUser()`, and `@CurrentTenant()`; never accept `tenantId` from request body or query.
  - [x] Validate submitted content: trimmed non-empty string, maximum 5000 characters, and current active session must belong to the tenant.
  - [x] Persist the user message first, then call `ThinkTankProviderGatewayService.stream(...)` with tenant, actor, session subject id, current-step prompt/history, and a privacy-safe `metadata` object.
  - [x] Collect streamed chunks into the assistant message for Story 2.6 response persistence; expose chunk metadata in a minimal response shape without implementing Story 2.7 polished incremental UI.
  - [x] Persist the advisor response as an assistant message with AI-generated metadata and decision options derived from the current step/runtime rules.
  - [x] Do not increment `workflow_sessions.currentStep.index` unless an explicit continue decision endpoint/action is implemented and invoked by the user; user follow-up/deepen/revise keeps the same step.
  - [x] Return `{ data: { sessionId, messages, assistantMessage, stream, currentStep, decisionOptions } }` with no raw prompt or file content in audit/telemetry.

- [x] Keep telemetry and audit privacy-safe (AC: 2)
  - [x] Reuse `AdvisoryEventService` and existing provider gateway telemetry; do not write audit rows manually.
  - [x] Metadata keys must avoid `conversation`, `message`, `messages`, `prompt`, `content`, `raw_content`, `report`, `document`, `enterprise_context`, and `attachments`.
  - [x] Tests must assert message text is not present in emitted telemetry/audit payloads, including nested metadata.
  - [x] Operational metadata may include only values such as `session_id`, `workflow_key`, `step_index`, `decision_action`, `message_count`, `provider`, `latency_ms`, token/cost values, and error category/code.

- [x] Wire guided conversation into the advisory workspace UI (AC: 1, 3, 4)
  - [x] Extend `frontend/lib/advisory/workflows.ts` or a narrow `messages.ts` client with typed message submit/retrieve functions using `getAuthHeadersAsync()`, `fetch('/api/advisory/...')`, `unwrapAdvisoryEnvelope()`, and `readAdvisoryMessage()`.
  - [x] Add Next proxy route(s) under `frontend/app/api/advisory/sessions/[sessionId]/messages/route.ts`; use `dynamic = 'force-dynamic'`, pass authorization through, and return backend status/body without exposing server internals.
  - [x] Update `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` to render the first prompt plus persisted user/advisor messages in a single conversation column.
  - [x] Add a controlled Textarea input with min height 52px, max height 200px, auto-expand, Enter submit, Shift+Enter newline, empty-submit prevention, 5000-character limit, draft autosave per active session, and submit pending/error states.
  - [x] Render decision controls inside the advisor message, not as a fixed bottom bar. Include continue, deepen, revise, and Party Mode only when allowed by current response/runtime option metadata.
  - [x] A/P/C or equivalent active decision keys must trigger visible enabled controls, preserve focus, and expose hints through `title`, tooltip text, or accessible labels.
  - [x] Escape must close transient UI/focus states only; Ctrl+D must toggle the document drawer availability state without breaking the disabled drawer behavior owned by later stories.

- [x] Add focused automated tests and regression evidence (AC: 1-4)
  - [x] Backend tests for `AdvisoryConversationMessageRepository`, `AdvisorySessionService`, and `AdvisorySessionController` message flows.
  - [x] Backend tests for cross-tenant read/update/delete rejection, invalid session/message validation, provider stream usage, no auto-advance without explicit continue, and privacy-safe telemetry.
  - [x] Frontend tests for textarea behavior, keyboard shortcuts, draft autosave, submitted/advisor message rendering, decision controls, loading/error states, and no production `data-testid`.
  - [x] Run focused backend and frontend tests, `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit`, and pre-commit-equivalent validation before marking done.

## Dev Notes

### Source Requirements

- Story 2.6 owns guided step conversation, governed AI gateway submission, explicit continuation choices, `conversation_messages`, tenant isolation tests, telemetry privacy, and keyboard controls. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.6]
- FR12 requires step-level follow-up questions and AI advisor insights. FR40 requires faithfully interpreting BMAD workflow definitions without hardcoding or degrading the workflow structure. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR12 / FR40]
- FR31 and FR33 are relevant guardrails: all session messages and workflow artifacts must be persisted by tenant, and AI-generated advisor replies must carry explicit AI-generated metadata/labeling. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR31 / FR33]
- Architecture assigns `conversation_messages` first use to Story 2.6 and requires tenant isolation through `tenant_id + BaseRepository`; PostgreSQL RLS is not an MVP blocker. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Correct Course Clarifications]
- UX source of truth: workflow decision controls are rendered in-message from workflow definitions; the input area may show lightweight shortcut hints and action availability. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - UX Decision Resolution]

### Scope Boundaries

Do not implement these future capabilities in Story 2.6:

| Capability | Owning story |
| --- | --- |
| Full SSE incremental rendering polish, scroll anchoring, Markdown/code rendering, and long-message streaming state | Story 2.7 |
| Live document drawer content, `workflow_outputs`, and AI-labeled report draft | Story 2.8 |
| Report viewing/export and PDF/Word generation | Story 2.9 |
| Prompt cache hit/miss and cost-aware workflow calls | Story 2.10 |
| Checkpoint persistence and session resume | Epic 4 |
| Party Mode advisor orchestration, persona selection, budgets, and expert message rounds | Epic 5 |
| New workflow launch/catalog behavior or first-prompt assembly | Story 2.5 already done |
| Direct Anthropic/GLM SDK calls from the session service | Existing governed provider gateway |

### Previous Story Intelligence

- Story 2.5 introduced `workflow_sessions`, `AdvisorySessionRepository`, `AdvisorySessionService`, `AdvisorySessionController`, workflow catalog/launch routes, frontend workflow clients, and launch UI. Reuse these paths and patterns; do not build a parallel workflow controller.
- Story 2.5 launch returns `sessionId`, workflow metadata, `firstPrompt`, and a `currentStep` snapshot. Story 2.6 should continue from that active session and must not re-run launch to answer a user message.
- Story 2.5 audit fixes made prompt/source data response-safe and metadata privacy-safe. Story 2.6 must be stricter because raw message content is persisted in `conversation_messages` but never copied into audit or telemetry payloads.
- Story 2.4 runtime file loading and prompt assembly live under `backend/src/modules/advisory/runtime/`. Reuse `ThinkTankPromptAssemblerService` / registry context if step prompt construction needs runtime source data.
- Story 1.5 established `ThinkTankProviderGatewayService.complete(...)` and `.stream(...)`. Story 2.6 must use `.stream(...)`; tests can use deterministic fake provider behavior and must not call live LLM/network services.

### Existing Patterns To Reuse

- Backend module registration: `backend/src/modules/advisory/advisory.module.ts`.
- Existing session files: `backend/src/modules/advisory/sessions/advisory-session.service.ts`, `advisory-session.repository.ts`, and `advisory-session.controller.ts`.
- Tenant repository pattern: `backend/src/database/repositories/base.repository.ts`.
- Session entity/migration pattern: `backend/src/database/entities/advisory-workflow-session.entity.ts` and `backend/src/database/migrations/1772000000030-CreateAdvisoryWorkflowSessions.ts`.
- Provider gateway: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts` and `.types.ts`.
- Event contract raw-sensitive guard: `backend/src/modules/advisory/events/thinktank-event-contract.ts`.
- Frontend workflow client and proxy patterns: `frontend/lib/advisory/workflows.ts`, `frontend/app/api/advisory/workflows/route.ts`, and `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.ts`.
- Workspace shell extension point: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.

### Backend Implementation Guidance

- Prefer a narrow `sessions/` implementation:
  - `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`
  - `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
  - Extend `advisory-session.service.ts` for message submit/retrieve orchestration.
  - Extend `advisory-session.controller.ts` for session message endpoints.
- Suggested entity shape:
  - `role`: `user | assistant`
  - `content`: raw persisted message text only in the database entity/API response, never in telemetry metadata.
  - `sequence`: per-session monotonically increasing integer; repository can calculate `max(sequence) + 1` inside tenant/session scope.
  - `decisionOptions`: JSONB array such as `{ key, label, shortcut, action, enabled }`.
  - `metadata`: privacy-safe operational flags such as `ai_generated`, `workflow_key`, `step_index`, `provider`, and `finish_reason`.
- Message history sent to the provider should be bounded for Story 2.6 tests, but no compression/checkpoint logic belongs here.
- If no workflow-specific step option parser exists yet, implement a deterministic conservative mapping from current workflow metadata/assistant result to generic options: `continue`, `deepen`, `revise`, and disabled `party-mode` unless runtime metadata explicitly allows it. Do not hardcode per-workflow branches.
- Provider gateway `.stream(...)` returns an async iterable. Story 2.6 may collect chunks server-side and return a chunk list/assembled assistant message while leaving polished browser token rendering to Story 2.7.
- Failure behavior: user message persistence can remain as submitted history, but failed assistant generation must return a clear recoverable error and no corrupted assistant message. If a partial assistant is persisted, it must be explicitly marked failed and tests must cover it.

### Frontend Implementation Guidance

- Keep the desktop advisory shell and reading density controls intact.
- Message rendering should stay quiet and work-focused: a single conversation column, compact message surfaces, visible author labels, and no decorative chat bubbles that fight the product UI.
- Decision controls belong inside the relevant assistant message. Prefer `Button` controls with clear `aria-label`, `title`, visible shortcut hints, and disabled states.
- Textarea must be controlled with synchronous `onChange` updates; React requires controlled textareas to pass both `value` and `onChange`.
- Draft autosave can use local storage scoped by user/session id. Avoid storing more than the current draft; persisted conversation belongs to the backend.
- Keyboard expectations:
  - Enter submits when draft is valid and not pending.
  - Shift+Enter inserts a newline.
  - Escape clears/defocuses transient error or decision state without losing the draft.
  - Ctrl+D toggles the document drawer open/closed state or disabled hint.
  - Active decision shortcut keys trigger only when focus is not inside text editing with modifier conflicts.

### Latest Technical Notes

- Installed versions for this repo: NestJS 10.4.x, TypeORM 0.3.20, Next.js 14.2.x, React 18.3.x, TypeScript 5.6.x, Jest 29.7.x. Match local versions; do not introduce new framework assumptions.
- NestJS SSE routes use `@Sse()` and must return an `Observable<MessageEvent>`, but Story 2.6 can collect provider stream chunks server-side if Story 2.7 owns polished browser streaming. [Source: https://docs.nestjs.com/techniques/server-sent-events]
- Next.js 14 App Router route handlers live in `route.ts`, support dynamic segments, and can stream with Web `ReadableStream` APIs if needed later. [Source: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]
- TypeORM entities require primary columns and must be registered in the data source; `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn`, and `@UpdateDateColumn` match existing local entity patterns. [Source: https://typeorm.io/docs/entity/entities/]
- React controlled textareas require a string `value` and synchronous `onChange`; use `maxLength` and accessible labels for the Story 2.6 input. [Source: https://react.dev/reference/react-dom/components/textarea]

### Testing Requirements

- Follow TDD: add failing backend and frontend tests before production changes.
- Focused backend commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand`
  - `cd backend && npx tsc --noEmit`
- Focused frontend commands:
  - `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand`
  - `cd frontend && npx tsc --noEmit`
- ORM validation:
  - `cd backend && npm run orm:entities:parity`
  - `cd backend && npm run orm:metadata:check`
- Pre-commit equivalent before commit:
  - `cd backend && npx lint-staged`
  - `cd frontend && npx lint-staged`
  - `node backend/scripts/detect-orm-risk-changes.js --staged`
- No test may depend on live LLM/network availability. Use deterministic provider gateway/fake provider tests.
- No production `data-testid`; tests must query by role, label, text, status, alert, and accessible names.

### Project Structure Notes

- Use the actual repository layout: `backend/src/modules/advisory/` and `frontend/app/advisory/`; do not create architecture example paths such as `src/advisory/`.
- `conversation_messages` entity belongs in `backend/src/database/entities/` because current TypeORM config loads shared entity exports from there.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; BMAD artifacts are ignored by default and must be force-added when committing.
- This story may update existing `AdvisoryWorkspaceShell.tsx` instead of creating a new page. Keep page sections unframed and avoid nested cards.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.6 requirements.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR12, FR31, FR33, FR40.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - `conversation_messages`, data flow, entity ownership, tenant isolation, API boundaries.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - in-message decision controls, textarea behavior, keyboard shortcuts.
- `_bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md` - prior story implementation and reuse boundaries.
- `backend/src/modules/advisory/provider-gateway/` - governed provider gateway.
- `backend/src/modules/advisory/events/` - audit/telemetry event contracts.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - workspace shell to extend.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.6, ThinkTank PRD FR12/FR31/FR33/FR40, architecture conversation message/data-flow notes, UX decision/input/keyboard requirements, previous Story 2.5 implementation learnings, local backend/frontend advisory patterns, and official NestJS/Next.js/TypeORM/React references.
- 2026-05-20: ATDD artifacts generated before production implementation; RED backend/frontend tests added for message persistence, tenant isolation, provider streaming, telemetry privacy, guided conversation UI, shortcuts, draft persistence, and proxy behavior.
- 2026-05-20: GREEN implementation completed for tenant-scoped `conversation_messages`, sessions message APIs, provider gateway stream orchestration, privacy-safe metadata, Next proxy route, typed frontend client, and guided workspace conversation UI.
- 2026-05-20: Validation passed: `cd backend && npm run test -- src/modules/advisory/provider-gateway src/modules/advisory/sessions --runInBand`; `cd backend && npx tsc --noEmit`; `cd backend && npm run orm:entities:parity`; `cd backend && npm run orm:metadata:check`; `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory --runInBand`; `cd frontend && npx tsc --noEmit`; no Story 2.6 skips or production `data-testid` found.
- 2026-05-20: Code review completed with two patch findings fixed: max-sequence message ordering and single-registration decision shortcut handling. Revalidation passed after fixes.
- 2026-05-20: Traceability and quality gate completed with PASS; all 4 acceptance criteria have FULL automated coverage and no critical/high gaps remain.

### Implementation Plan

- Generate ATDD artifacts before production code.
- Add RED backend tests for `conversation_messages`, message endpoints, provider streaming orchestration, tenant isolation, and privacy-safe telemetry.
- Add RED frontend tests for guided conversation rendering, input/shortcuts, draft autosave, decision controls, and accessible hints.
- Implement backend entity/migration/repository/service/controller first, then frontend client/proxy/UI.
- Run focused tests, TypeScript validation, ORM checks, code review, traceability, status update, and commit.

### Completion Notes List

- Story context ready for ATDD and implementation.
- Added tenant-scoped `conversation_messages` entity, migration, repository, registrations, and tests proving tenant scoping and cross-tenant rejection through the existing BaseRepository pattern.
- Extended the existing advisory sessions service/controller with `GET/POST /advisory/sessions/:sessionId/messages`, guarded by JWT and Tenant guards, with trimmed 5000-character validation and no request `tenantId` trust.
- Message submission persists the user answer, calls `ThinkTankProviderGatewayService.stream(...)`, collects Story 2.6 response chunks, persists the assistant message, returns decision options, and leaves `currentStep` unchanged until explicit continuation work exists.
- Provider/audit telemetry metadata stays privacy-safe; tests assert raw user message content is not copied into emitted metadata.
- Workspace UI now renders the launch prompt, persisted conversation messages, controlled autosaved textarea, Enter/Shift+Enter behavior, pending/error states, and in-message decision controls with discoverable shortcut labels/titles.
- Code review findings are resolved; `_bmad-output/test-artifacts/code-review-story-2-6.md` records the findings, fixes, and verification evidence.
- Traceability gate passed; `_bmad-output/test-artifacts/traceability-report-story-2-6.md` records the AC-to-test matrix, gap analysis, and deterministic PASS decision.

### File List

- `_bmad-output/implementation-artifacts/2-6-guided-step-conversation-and-decision-controls.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-6-guided-step-conversation-and-decision-controls.md`
- `_bmad-output/test-artifacts/code-review-story-2-6.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-6.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-6-guided-step-conversation-and-decision-controls.md`
- `_bmad-output/test-artifacts/traceability-story-2-6-guided-step-conversation-and-decision-controls-phase1.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-2-6-2026-05-20T05-45-13+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-2-6-2026-05-20T05-45-13+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-6-2026-05-20T05-45-13+08-00.json`
- `backend/src/config/typeorm.entities.ts`
- `backend/src/database/entities/advisory-conversation-message.entity.ts`
- `backend/src/database/entities/index.ts`
- `backend/src/database/migrations/1772000000031-CreateAdvisoryConversationMessages.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.messages.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/messages/route.ts`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/lib/advisory/messages.test.ts`
- `frontend/lib/advisory/workflows.ts`

## Change Log

- 2026-05-20: Story context created and marked ready-for-dev.
- 2026-05-20: Development started; status marked in-progress.
- 2026-05-20: Story 2.6 implementation completed and marked ready for review with guided conversation backend/frontend coverage and validation evidence.
- 2026-05-20: Code review patch findings resolved and validation rerun successfully.
- 2026-05-20: Traceability gate passed and story marked done.
