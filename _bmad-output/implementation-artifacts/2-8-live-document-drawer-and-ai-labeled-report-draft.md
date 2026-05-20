# Story 2.8: Live Document Drawer and AI-Labeled Report Draft

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want the report to build alongside the conversation,
so that each completed step creates visible progress toward a usable decision document.

## Acceptance Criteria

1. Given a workflow step is completed, when the system summarizes the step output, then a corresponding section is appended to the live report draft, and the report content includes visible AI-generated labeling and machine-readable metadata.
2. Given `workflow_outputs` is introduced by this story, when report draft records are created, appended, viewed, or listed, then tests prove output records and metadata remain tenant-scoped, and cross-tenant direct-id access does not leak report metadata.
3. Given the document drawer is collapsed, when a new section is appended, then the right-edge document trigger shows a lightweight new-content hint, and opening the drawer displays the latest generated section.
4. Given the document drawer is open, when new report content is appended, then the drawer can scroll to the new section without disrupting the conversation input, and the drawer can be closed with Escape, toggled with Ctrl+D, and resized within the defined width constraints.
5. Given a workflow step is completed, when report content is appended and the stepper advances, then the user receives short completion feedback, and focus returns to the input with an accessible announcement of the completed step.
6. Given the final workflow step is completed, when the report draft reaches a completed workflow state, then audit event `thinktank.workflow.completed` is emitted with tenant, actor, session, workflow type, output id, and outcome, and the event confirms AI labeling metadata exists without copying raw report content.

## Tasks / Subtasks

- [x] Add Story 2.8 ATDD coverage artifacts before production code (AC: 1-6)
  - [x] Create `_bmad-output/test-artifacts/atdd-checklist-2-8-live-document-drawer-and-ai-labeled-report-draft.md`.
  - [x] Define RED backend tests for `workflow_outputs` entity/repository/service/controller behavior, tenant isolation, append/view/list operations, AI metadata, and completion audit.
  - [x] Define RED frontend tests for drawer open/close/resize shortcuts, collapsed new-content hint, latest-section visibility, scroll-to-new-section behavior, accessible announcement, and input focus restoration.
  - [x] Do not begin production implementation until the acceptance coverage artifact exists.

- [x] Introduce tenant-scoped `workflow_outputs` persistence (AC: 1, 2, 6)
  - [x] Add `AdvisoryWorkflowOutput` entity under `backend/src/database/entities/` and register it in the shared entity roster plus `AdvisoryModule` TypeORM feature registration.
  - [x] Add a TypeORM migration that creates `workflow_outputs` with UUID primary key, `tenant_id`, `session_id`, `actor_id`, `workflow_key`, `status`, `title`, `summary`, `content_markdown`, `sections` JSONB, `ai_label_metadata` JSONB, `metadata` JSONB, `created_at`, and `updated_at`.
  - [x] Use indexes aligned to the current advisory tables: tenant, tenant/session, tenant/workflow/status, tenant/created, and JSONB GIN where useful for metadata/sections.
  - [x] Add `AdvisoryWorkflowOutputRepository` using `BaseRepository`; never accept or mutate caller-provided `tenantId`.
  - [x] Tests must prove cross-tenant direct-id reads/listing/append attempts return not found or empty results without leaking metadata.

- [x] Add backend output draft orchestration beside existing session/message flow (AC: 1, 2, 6)
  - [x] Extend the existing advisory sessions subdomain rather than creating a parallel workflow engine.
  - [x] Add service methods to get/create the active draft for a session, append a completed-step section, list session outputs, and mark a draft completed.
  - [x] Derive draft title, section heading, visible `[AI Generated]` label, and JSON-LD style machine metadata from the session/workflow/step context and safe provider metadata already exposed by Story 2.7.
  - [x] Do not copy raw system prompt, runtime source content, telemetry internals, or raw report content into audit metadata.
  - [x] Emit `thinktank.workflow.completed` only when the draft reaches completed workflow state; include tenant, actor, session id, workflow type, output id, outcome, and AI-label metadata presence.

- [x] Add ThinkTank output APIs and Next proxy routes (AC: 1, 2, 6)
  - [x] Add backend endpoints under existing guarded advisory controllers, for example `GET /advisory/sessions/:sessionId/output`, `POST /advisory/sessions/:sessionId/output/sections`, and `POST /advisory/sessions/:sessionId/output/complete`.
  - [x] Keep `JwtAuthGuard`, `TenantGuard`, `@CurrentUser()`, and `@CurrentTenant()` on every backend output route.
  - [x] Return ThinkTank-owned envelopes as `{ data, meta? }` and errors as `{ error: { code, message, details? } }`, matching existing advisory route behavior.
  - [x] Add Next App Router proxy routes under `frontend/app/api/advisory/sessions/[sessionId]/output/...` using Web `Request`/`Response` APIs and `dynamic = 'force-dynamic'`.
  - [x] Tests must prove proxy routes do not relay caller-supplied tenant fields and safely forward backend status/error responses.

- [x] Add typed frontend output client and state integration (AC: 1, 3, 5)
  - [x] Add output types and helpers under `frontend/lib/advisory/outputs.ts` or extend `frontend/lib/advisory/workflows.ts` only if it keeps the module easier to scan.
  - [x] Load the current session draft when a workflow launch is active and reset output state when a different workflow starts.
  - [x] Wire completed-step/decision behavior to append a draft section without auto-advancing workflow steps outside accepted Story 2.8 scope.
  - [x] Preserve Story 2.7 streaming state, abort handling, scroll anchoring, lazy message rendering, and JSON fallback behavior.
  - [x] Keep tests based on role/label/text/title selectors; no production `data-testid`.

- [x] Replace the disabled placeholder with an interactive DocumentDrawer (AC: 3, 4, 5)
  - [x] Create a focused component such as `frontend/components/advisory/AdvisoryDocumentDrawer.tsx`.
  - [x] Use the existing right rail trigger, `PanelRightOpen`/close icons, and advisory visual tokens; do not use nested cards or a decorative marketing panel.
  - [x] Support collapsed, expanded, and resizing states with min `320px`, default `38vw`, max `50vw`, and stable layout constraints.
  - [x] Support Escape to close and Ctrl+D to toggle without duplicating shortcut listeners already owned by the workspace shell.
  - [x] Show an accessible new-content hint when collapsed; opening the drawer clears the hint and displays the latest generated section.
  - [x] Render an empty state before the first section and a structured Markdown-like draft with title, sections, visible AI label, and metadata summary after content exists.

- [x] Preserve focus, announcements, and step-completion feedback (AC: 4, 5)
  - [x] When content appends while the drawer is open, scroll the drawer to the new section without moving conversation input focus.
  - [x] When content appends while collapsed, keep conversation focus/input usable and announce the completed step with `aria-live="polite"`.
  - [x] Add a short completion feedback surface using existing alert/status patterns; avoid heavy celebration or gamification.
  - [x] If the final workflow completion path is represented in this story, keep completion feedback professional and concise.

- [x] Add focused automated tests and regression evidence (AC: 1-6)
  - [x] Backend tests for entity/repository/service/controller/proxy contracts, tenant isolation, metadata labeling, and audit event privacy.
  - [x] Frontend RTL tests for drawer behavior, keyboard shortcuts, resize boundaries, new-content hint, rendered draft structure, announcements, and focus restoration.
  - [x] Run focused backend/frontend tests, `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit`, ORM parity/metadata/fresh migration checks when migrations/entities change, and pre-commit-equivalent validation before marking done.

## Dev Notes

### Source Requirements

- Story 2.8 owns the live document drawer, `workflow_outputs`, report draft section appending, AI-generated labeling, and workflow completion audit. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.8]
- FR16 requires structured report generation, FR19 requires users to view structured report documents, and FR33 requires visible plus metadata AI labeling for AI-generated content. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - FR16 / FR19 / FR33]
- NFR10 requires automatic explicit `[AI Generated]` labeling plus metadata marking that cannot be disabled and must be verified by automated tests. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - NFR10]
- UX-DR11 requires the right-edge document trigger, collapsed default, 50vw maximum drawer, draggable resizing, close button, Escape close, and Ctrl+D toggle. UX-DR12 requires real-time Markdown preview, section append after each completed step, chapter/scroll sync, collapsed new-content hints, and export availability from any stage. UX-DR22 requires step completion feedback, document append, auto-scroll when open, toast/status feedback, screen-reader announcement, and focus return. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR11 / UX-DR12 / UX-DR22]
- Architecture says `workflow_outputs` is introduced by Story 2.8 and every first-use entity story must include cross-tenant isolation tests. [Source: `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - Entity Ownership by First Use]
- MVP tenant isolation source of truth is `tenant_id + BaseRepository`; RLS references are historical/post-MVP and must not block this story. [Source: `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - MVP Tenant Isolation Source of Truth]

### Scope Boundaries

Do not implement these future capabilities in Story 2.8:

| Capability | Owning story |
| --- | --- |
| Markdown/PDF export implementation and export audit | Story 2.9 |
| Output rating, favorites, and asset state | Story 4.4 |
| Knowledge-base association and retryable pending association | Story 4.5 |
| Automatic checkpoint persistence and full interrupted-session resume | Story 4.1 / Story 4.2 |
| Party Mode section integration | Epic 5 |
| Prompt cache hit/miss and cost-aware workflow calls | Story 2.10 |
| Full workflow-step engine with branch advancement | Later workflow orchestration story unless already needed by accepted ACs |

### Previous Story Intelligence

- Story 2.7 added backend SSE streaming through `AdvisorySessionService.streamMessage(...)`, the `POST /advisory/sessions/:sessionId/messages/stream` backend route, Next proxy route, `frontend/lib/advisory/streaming.ts`, and streaming UI in `AdvisoryWorkspaceShell.tsx`.
- Story 2.7 introduced `AdvisoryChatMessage` and a small internal Markdown renderer. Reuse this rendering approach for draft sections if it keeps dependencies stable; do not add Markdown dependencies unless tests and lockfiles are updated in the same story.
- Story 2.7 hardened abort propagation, pre-stream validation, SSE backpressure, empty stream recovery, sequence locking, malformed EOF recovery, aria-live throttling, scroll anchoring, and stale stream guards. Do not regress these behaviors while adding drawer state.
- Story 2.7 changed `conversation_messages` sequence allocation to `createMessageWithNextSequence()` with a transaction and advisory lock; any ordered output-section append should use a deterministic sequence/order strategy and tests for concurrent appends if implemented.
- Recent commits: `f348c11` Story 2.7 streaming, `cebd6d1` Story 2.6 guided conversation, `28605e5` Story 2.5 workflow launch.

### Existing Patterns To Reuse

- Backend session orchestration: `backend/src/modules/advisory/sessions/advisory-session.service.ts`.
- Backend session routes and manual SSE pattern: `backend/src/modules/advisory/sessions/advisory-session.controller.ts`.
- Tenant-scoped session/message repositories: `backend/src/modules/advisory/sessions/advisory-session.repository.ts` and `backend/src/modules/advisory/sessions/advisory-conversation-message.repository.ts`.
- Entity style: `backend/src/database/entities/advisory-workflow-session.entity.ts` and `backend/src/database/entities/advisory-conversation-message.entity.ts`.
- Migration style: `backend/src/database/migrations/1772000000030-CreateAdvisoryWorkflowSessions.ts`, `1772000000031-CreateAdvisoryConversationMessages.ts`, and `1772000000032-MakeConversationMessageSequenceUnique.ts`.
- Advisory module registration: `backend/src/modules/advisory/advisory.module.ts`.
- Frontend workspace extension point and disabled placeholder: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
- Frontend message/draft state patterns: `frontend/lib/advisory/workflows.ts`, `frontend/lib/advisory/streaming.ts`, and `frontend/app/advisory/__tests__/page.test.tsx`.
- Next proxy pattern: `frontend/app/api/advisory/sessions/[sessionId]/messages/route.ts` and `frontend/app/api/advisory/sessions/[sessionId]/messages/stream/route.ts`.
- UI primitives: shadcn-style local `Button`, `Textarea`, `Separator`, `Label`, `RadioGroup`, lucide icons, and advisory layout tokens in `frontend/lib/advisory/layout.ts`.

### Backend Implementation Guidance

- Prefer placing `AdvisoryWorkflowOutputRepository` under `backend/src/modules/advisory/outputs/` if the output domain becomes more than a thin helper; otherwise keep it next to sessions only if it is tightly coupled to session completion. Do not create a second top-level advisory engine.
- A practical `workflow_outputs` shape for this story:
  - `id`, `tenant_id`, `session_id`, `actor_id`, `workflow_key`
  - `status`: `draft | completed`
  - `title`, `summary`, `content_markdown`
  - `sections`: JSONB array with `{ id, stepIndex, heading, contentMarkdown, aiLabel, metadata, createdAt }`
  - `ai_label_metadata`: JSONB with machine-readable AI label, generator, model/provider when safe, source session/workflow, and generated timestamp
  - `metadata`: JSONB for operational fields such as `section_count`, `last_step_index`, `completed_at`
- Use `timestamptz` for dates and JSONB defaults matching existing entities.
- If creating JSONB GIN indexes manually, remember TypeORM index decorators cannot express every database-specific index shape; create the SQL in the migration and mark unsupported entity indexes with `synchronize: false` only if needed. [Source: TypeORM Indexes docs]
- Keep audit metadata privacy-safe. Completion audit may report `ai_label_metadata_present: true`, `section_count`, `workflow_key`, and `output_id`, but must not include `content_markdown` or raw section text.
- For final workflow completion in MVP, a deterministic test hook can call an explicit complete endpoint; do not infer completion from arbitrary assistant text.

### Frontend Implementation Guidance

- Extract drawer logic from `AdvisoryWorkspaceShell.tsx` as soon as it grows beyond simple state plumbing. The shell is already large after Story 2.7.
- Keep state explicit: `documentDrawerOpen`, `documentDrawerWidth`, `hasUnreadDocumentContent`, `workflowOutput`, `outputStatus`, `outputAnnouncement`.
- Use stable CSS constraints instead of viewport-scaled typography: min width 320px, default width from `ADVISORY_LAYOUT.documentDrawerDefaultWidth`, max 50vw.
- Implement resizing with pointer events and clamp width. If `ResizeObserver` is used, avoid resize loops by not mutating the observed size in the observer callback or by deferring with `requestAnimationFrame`. [Source: MDN ResizeObserver]
- Keyboard handling should use `KeyboardEvent.key` plus modifier state for Escape/Ctrl+D and should ignore text-editing targets where appropriate. [Source: MDN KeyboardEvent.key]
- When content appends, schedule drawer scroll with `requestAnimationFrame` after React paints; keep the textarea focus unless the user explicitly opens/closes the drawer.
- Do not add visible instructional copy that explains shortcuts or mechanics beyond existing compact UI labels/tooltips/accessibility names.

### Latest Technical Notes

- Installed repo versions: NestJS 10.4.x, Next.js 14.2.x, React 18.3.x, TypeScript 5.6.x, Jest 29.7.x, TypeORM 0.3.x. Match current dependencies unless a dependency is intentionally added and tested.
- Next.js 14 Route Handlers use Web `Request` and `Response` APIs, support `GET`/`POST` handlers in `app/**/route.ts`, and `POST` handlers are evaluated dynamically. [Source: Next.js 14 Route Handlers docs]
- TypeORM entity decorators support special timestamp columns such as `@CreateDateColumn` and `@UpdateDateColumn`; match existing advisory entities. [Source: TypeORM Entities docs]
- TypeORM supports `@Index`, but custom database-specific indexes should be created in migrations when decorator support is insufficient. [Source: TypeORM Indexes docs]
- MDN documents `KeyboardEvent.key` as layout-aware and modifier-aware; prefer it over deprecated keyCode-style handling. [Source: MDN KeyboardEvent.key]

### Testing Requirements

- Follow TDD: add failing backend/frontend tests before production changes.
- Focused backend commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs --runInBand`
  - `cd backend && npx tsc --noEmit`
- Focused frontend commands:
  - `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`
  - `cd frontend && npx tsc --noEmit`
- Entity/migration commands required for this story:
  - `cd backend && npm run orm:entities:parity`
  - `cd backend && npm run orm:metadata:check`
  - `cd backend && npm run migration:check:fresh`
- Pre-commit equivalent before commit:
  - `cd frontend && npx lint-staged`
  - `cd backend && npx lint-staged`
  - `node backend/scripts/detect-orm-risk-changes.js --staged`
- No test may depend on live LLM/network availability. Mock output append responses and provider metadata deterministically.
- No production `data-testid`; tests must query by role, label, text, title, status, alert, accessible names, and semantic structure.

### Project Structure Notes

- Keep advisory UI components under `frontend/components/advisory/`.
- Keep frontend output helpers under `frontend/lib/advisory/`.
- Keep Next proxy routes under `frontend/app/api/advisory/sessions/[sessionId]/output/`.
- Keep backend output persistence in the advisory module and register the new entity in `APP_ENTITIES` / TypeORM feature lists.
- BMAD artifacts belong under `_bmad-output/test-artifacts/` and are ignored by default; force-add them when committing.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 Story 2.8, UX-DR11, UX-DR12, UX-DR22.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR16, FR19, FR33, NFR10, NFR13.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - tenant isolation, entity first-use ownership, MVP export scope, frontend quality gates.
- `_bmad-output/planning-artifacts/schema.sql` - historical `workflow_outputs` baseline; adapt to current entity style and MVP Markdown/PDF scope.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - DocumentDrawer, layout dimensions, keyboard shortcuts, empty/loading states, step completion feedback.
- `_bmad-output/implementation-artifacts/2-7-streaming-message-experience.md` - prior story implementation and review learnings.
- `backend/src/modules/advisory/sessions/` - current session/message orchestration and tests.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - current workspace and disabled drawer placeholder.
- `frontend/components/advisory/AdvisoryChatMessage.tsx` - current Markdown/message renderer to reuse or adapt.
- `frontend/lib/advisory/streaming.ts` - Story 2.7 stream parser/client patterns.
- `https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers`
- `https://typeorm.io/docs/entity/entities/`
- `https://dev.typeorm.io/docs/indexes/`
- `https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key`
- `https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.8, ThinkTank PRD FR16/FR19/FR33/NFR10, architecture correct-course addendum, UX DocumentDrawer requirements, previous Story 2.7 implementation learnings, current advisory backend/frontend code, and official Next.js/TypeORM/MDN references.

### Implementation Plan

- Generate ATDD artifacts before production code.
- Add RED backend tests for `workflow_outputs`, repository/service/controller/proxy behavior, AI metadata, tenant isolation, and completion audit privacy.
- Add RED frontend tests for DocumentDrawer interaction, layout constraints, keyboard behavior, new-content hints, rendered draft sections, announcements, and focus restoration.
- Implement output persistence, API/proxy/client helpers, and interactive drawer UI.
- Run focused tests, TypeScript validation, ORM migration checks, code review, traceability, status update, and commit.

### Completion Notes List

- Implemented tenant-scoped `workflow_outputs` persistence with entity registration, migration, `BaseRepository`-backed output repository, and cross-tenant read/list/append/complete coverage.
- Extended advisory session orchestration and guarded controller routes for active draft load, section append, output listing, completion, and privacy-safe `thinktank.workflow.completed` audit metadata.
- Added Next proxy routes and typed frontend output client helpers that sanitize caller input and avoid forwarding tenant/output ownership fields.
- Replaced the disabled document placeholder with an interactive live document drawer, collapsed new-content hint, accessible status announcements, resize clamp behavior, Escape/Ctrl+D support, and focus restoration after step completion.
- Preserved Story 2.7 streaming behavior while appending completed assistant outputs into the live draft with visible `[AI Generated]` labels and machine-readable metadata.
- Validation passed: `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs --runInBand`; `cd backend && npm run test -- src/modules/advisory/admin/advisory-module-config.metadata.spec.ts --runInBand`; `cd backend && npx tsc --noEmit`; `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`; `cd frontend && npx tsc --noEmit`; `cd backend && npm run orm:entities:parity`; `cd backend && npm run orm:metadata:check`; `cd backend && npm run migration:check:fresh`.
- Code review fixes added active draft uniqueness, transactional output append/completion, active-session gating, persisted assistant-message source validation, empty draft and invalid outcome rejection, audit failure propagation, frontend explicit-continue append behavior, final-step completion calls, drawer listener cleanup, and stream completion decision-option preservation.
- Review-fix validation passed: `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/advisory/AdvisoryDocumentDrawer.test.tsx --runInBand`; `cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand`; `cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs --runInBand`; `cd backend && npx tsc --noEmit`; `cd frontend && npx tsc --noEmit`; `cd backend && npm run orm:entities:parity`; `cd backend && npm run orm:metadata:check`; `cd backend && npm run migration:check:fresh`; `git diff --check`.
- Traceability gate passed with 6/6 ACs fully covered, P0 coverage 100%, P1 coverage 100%, and overall coverage 100%.

### Senior Developer Review (AI)

- Blocking review findings addressed: one active draft per tenant/session is enforced by repository fallback plus a partial unique index; append and complete paths now use transactions where the real TypeORM repository is available.
- Output mutations now reject completed/non-active sessions, validate source messages from persisted assistant messages, reject empty draft completion, whitelist completion outcomes, and propagate completion audit/session update failures.
- Frontend report append now happens only after explicit `continue`, preserves event-level decision options on completed stream messages, completes the output on final workflow steps, and avoids refetching session history when only the current step changes.
- Drawer resize listeners are cleaned up on pointer completion, cancellation, blur, and unmount.
- No remaining HIGH/MEDIUM review findings are open.

### File List

- `_bmad-output/implementation-artifacts/2-8-live-document-drawer-and-ai-labeled-report-draft.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-8-live-document-drawer-and-ai-labeled-report-draft.md`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-8-2026-05-20T07-44-42+08-00.json`
- `_bmad-output/test-artifacts/traceability-report-story-2-8-live-document-drawer-and-ai-labeled-report-draft.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-8-live-document-drawer-and-ai-labeled-report-draft.yaml`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-2-8-2026-05-20T10-32-00+08-00.json`
- `backend/src/config/typeorm.entities.ts`
- `backend/src/database/entities/advisory-workflow-output.entity.ts`
- `backend/src/database/entities/index.ts`
- `backend/src/database/migrations/1772000000033-CreateAdvisoryWorkflowOutputs.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts`
- `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/route.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.ts`
- `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx`
- `frontend/components/advisory/AdvisoryDocumentDrawer.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/lib/advisory/envelope.ts`
- `frontend/lib/advisory/outputs.test.ts`
- `frontend/lib/advisory/outputs.ts`

## Change Log

- 2026-05-20: Story context created and marked ready-for-dev.
- 2026-05-20: Implemented live document drawer, workflow output persistence/API/proxy/client integration, AI labeling, completion audit, and focused automated validation; story moved to review.
- 2026-05-20: Applied code-review fixes for draft uniqueness, transactional append/complete, active-session/source-message validation, explicit frontend append/complete behavior, drawer cleanup, and regression validation.
- 2026-05-20: Added traceability matrix and PASS gate decision; story moved to done.
