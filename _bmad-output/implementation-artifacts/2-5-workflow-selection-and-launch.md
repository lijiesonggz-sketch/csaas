# Story 2.5: Workflow Selection and Launch

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want to choose and start one of the eight structured workflows,
so that I can move from an unclear problem into a guided consulting process.

## Acceptance Criteria

1. Given the user opens the advisory workspace, when they view available workflows, then the eight MVP workflows are available by user-understandable scenario labels and canonical workflow names, and the system can start Brainstorming, Domain Research, Market Research, Product Brief, PRD, Problem Solving, Design Thinking, and Storytelling through the same file-driven runtime launch path, with no workflow-specific branching except metadata/configuration selected by the runtime registry.
2. Given the user starts a workflow, when the first workflow step loads, then the conversation area shows the first AI prompt from the runtime definition, the horizontal stepper shows the current step without exposing unrevealed future steps, and audit event `thinktank.workflow.started` is emitted with tenant, actor, session, workflow type, and outcome.
3. Given automated launch tests run for the MVP workflow registry, when each of the eight workflows loads its first prompt, then parameterized tests prove every workflow uses the same file provider, parser/assembler, brand mapper, session creation, and launch path; if any workflow requires custom code, that custom work must be split into a separate story before Story 2.5 is accepted.
4. Given `workflow_sessions` is introduced by this story, when session records are created, read, updated, or failed during launch, then tests prove tenant A cannot read, update, delete, or infer tenant B session records, and `tenant_id` is supplied only through the shared tenant context/BaseRepository contract.
5. Given a workflow cannot be started because the runtime or provider is unavailable, when the user attempts to launch it, then the user receives a clear recovery message, and the failure emits audit event `thinktank.workflow.start_failed` without creating a corrupted session.

## Tasks / Subtasks

- [x] Add Story 2.5 ATDD coverage artifacts before production code (AC: 1-5)
  - [x] Create an ATDD checklist under `_bmad-output/test-artifacts/` that maps all five ACs to backend and frontend tests.
  - [x] Define RED tests for eight-workflow catalog visibility, launch success, failure audit, and tenant isolation.
  - [x] Do not begin implementation until the acceptance coverage artifact exists.

- [x] Introduce tenant-scoped workflow session persistence (AC: 2, 4, 5)
  - [x] Add `backend/src/database/entities/advisory-workflow-session.entity.ts` with UUID primary key, `tenantId`, `actorId`, `workflowKey`, `workflowDisplayName`, `scenarioLabel`, `status`, current-step snapshot, `sourceRefs`, privacy-safe metadata, failure code/message, and timestamps.
  - [x] Add a TypeORM migration creating `workflow_sessions` with `tenant_id`, actor/workflow/status indexes, JSONB source metadata, and no nullable `tenant_id`.
  - [x] Register the entity in `backend/src/database/entities/index.ts`, `backend/src/config/typeorm.entities.ts`, and `TypeOrmModule.forFeature(...)` in `backend/src/modules/advisory/advisory.module.ts`.
  - [x] Implement `backend/src/modules/advisory/sessions/advisory-session.repository.ts` extending `BaseRepository<AdvisoryWorkflowSession>`.
  - [x] Tests must prove BaseRepository strips caller-supplied `tenantId`, scopes reads/updates/deletes by current tenant, and returns not-found behavior for cross-tenant session ids.

- [x] Add workflow catalog and launch backend API (AC: 1-5)
  - [x] Create `backend/src/modules/advisory/sessions/advisory-session.service.ts` and `advisory-session.controller.ts` under `backend/src/modules/advisory/sessions/`.
  - [x] Expose `GET /advisory/workflows` for registry-backed catalog metadata and `POST /advisory/workflows/:workflowKey/launch` for launch.
  - [x] Protect both endpoints with `@UseGuards(JwtAuthGuard, TenantGuard)`, `@CurrentUser()`, and `@CurrentTenant()`; never accept `tenantId` from request body.
  - [x] Launch flow must call `AdvisoryAccessService.assertThinkTankModuleAvailable(user, tenantId)` before runtime work.
  - [x] Launch flow must call `ThinkTankWorkflowRegistryService.findWorkflow(workflowKey)` and `ThinkTankPromptAssemblerService.assemblePrompt({ workflowKey, includeMethodLibraries: true, includeAgentSources: true })`.
  - [x] Persist an `active` launch session only after runtime assembly succeeds; return `{ data: { sessionId, workflow, status, sourceRefs, firstPrompt, currentStep } }`.
  - [x] If workflow key is invalid, runtime files are missing/malformed, or assembly fails, emit `thinktank.workflow.start_failed`, return a recovery-safe error message, and do not leave a corrupted session row.

- [x] Emit privacy-safe workflow audit events (AC: 2, 5)
  - [x] On success, use `AdvisoryEventService.emitAudit` with `ThinkTankEventName.WorkflowStarted`, `ThinkTankSubjectType.Session`, `ThinkTankEventOutcome.Success`, `ThinkTankPrivacyClassification.Operational`, `optional.sessionId`, and `optional.workflowType`.
  - [x] Audit target should use `AuditAction.CREATE`, `entityType: 'ThinkTankWorkflowSession'`, and `entityId: session.id`.
  - [x] On failure, use `ThinkTankEventName.WorkflowStartFailed`, `ThinkTankEventOutcome.Failure`, `ThinkTankSubjectType.Workflow`, and `subjectId` equal to the normalized workflow key when no session exists.
  - [x] Metadata must include only operational fields such as `workflow_key`, `runtime_error_code`, and `source_ref_count`; never include raw prompt, conversation, messages, report, document, user attachments, or full file content.

- [x] Wire workflow selection into the advisory workspace UI (AC: 1, 2, 5)
  - [x] Add `frontend/lib/advisory/workflows.ts` with typed catalog/launch clients using `getAuthHeadersAsync()`, `fetch('/api/advisory/...')`, `unwrapAdvisoryEnvelope()`, and `readAdvisoryMessage()`.
  - [x] Add Next proxy routes `frontend/app/api/advisory/workflows/route.ts` and `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.ts`; use `dynamic = 'force-dynamic'`, pass the authorization token through, and return backend status/body without exposing server internals.
  - [x] Update `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` to load the runtime catalog, render eight workflow options with scenario labels and canonical names, and launch exactly one active workflow at a time.
  - [x] Replace the current non-interactive placeholder list only after catalog loading succeeds or fails; preserve the desktop viewport gate, reading-density control, and document drawer disabled state.
  - [x] Show catalog loading with one `role="status"` live region, launch errors with `role="alert"`, and disable launch controls while a workflow is pending to prevent duplicate sessions.
  - [x] After launch success, render the returned first prompt in the conversation area and render a horizontal stepper that shows only the current step; do not reveal future workflow steps.

- [x] Add focused automated tests and regression evidence (AC: 1-5)
  - [x] Backend unit/integration tests for `AdvisorySessionService`, repository tenant isolation, controller route guards/contracts, success audit, failure audit, and no-corrupted-session behavior.
  - [x] Parameterized backend launch test over all eight workflow keys: `brainstorming`, `domain-research`, `market-research`, `product-brief`, `prd`, `problem-solving`, `design-thinking`, `storytelling`.
  - [x] Frontend tests in `frontend/app/advisory/__tests__/page.test.tsx` for catalog loading/success/error, eight workflow labels, launch disabled/pending state, first prompt rendering, stepper current-step-only behavior, and failure recovery message.
  - [x] Accessibility tests must use role/label/text selectors and must not add production `data-testid`.
  - [x] Run focused backend and frontend tests, `cd backend && npx tsc --noEmit`, and the repository pre-commit-equivalent validation before marking done.

## Dev Notes

### Source Requirements

- Epic 2 requires a unified advisory workspace that can run eight structured workflows, stream AI guidance later, and produce a first professional report. Story 2.5 owns workflow catalog selection, first-prompt launch, `workflow_sessions`, and launch audit only. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 / Story 2.5]
- FR11 requires users to start the eight MVP workflows. FR40/FR43/FR44 require the launch path to interpret file-backed ThinkTank runtime definitions and method libraries without workflow-specific hardcoding. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - ThinkTank Runtime 与 Agent 系统]
- Architecture assigns `workflow_sessions` first use to Story 2.5 and requires tenant isolation through `tenant_id + BaseRepository`; PostgreSQL RLS is not an MVP blocker. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Correct Course Clarifications]
- Custom advisory frontend components belong under `frontend/components/advisory/`; Story 2.5 must preserve WCAG 2.1 AA blocking checks, keyboard navigation, visible focus, and live-region patterns established by Stories 2.1-2.3. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Frontend Quality Gates]

### Scope Boundaries

Do not implement these future capabilities in Story 2.5:

| Capability | Owning story |
| --- | --- |
| User message persistence, multi-turn decision controls, and conversation state machine | Story 2.6 |
| SSE streaming response UI or provider streaming calls | Story 2.7 |
| Live document drawer content and `workflow_outputs` | Story 2.8 |
| Markdown/PDF export | Story 2.9 |
| Prompt cache hits/misses and cost-aware workflow calls | Story 2.10 |
| Party Mode advisor selection or persona migration | Epic 5 |
| Direct Anthropic/GLM SDK calls from workflow launch | Existing provider gateway / later workflow stories |

### Previous Story Intelligence

- Story 2.1-2.3 established the desktop-only advisory shell, semantic status regions, reading-density persistence, shadcn/Radix/Tailwind styling, and the rule that workflow placeholders remain non-interactive until Story 2.5.
- Story 2.4 added `backend/src/modules/advisory/runtime/` with `ThinkTankRuntimeFileProviderService`, `ThinkTankBrandMapperService`, `ThinkTankWorkflowParserService`, `ThinkTankWorkflowRegistryService`, and `ThinkTankPromptAssemblerService`. Reuse those services directly; do not re-parse runtime files inside controllers or frontend code.
- Story 2.4 hardened runtime file loading: approved roots only, stable runtime error codes, canonical source de-duplication, method-library CSV validation, and brand mapping that preserves technical paths/logs/code fences.
- Story 1.4 established ThinkTank audit event contracts and raw-sensitive metadata protection. Use `AdvisoryEventService`; do not write audit rows manually.
- Story 1.5 established the governed provider gateway. Story 2.5 must not call providers; it only returns the runtime first prompt.

### Existing Patterns To Reuse

- Backend module registration: `backend/src/modules/advisory/advisory.module.ts`.
- Access guard and response envelope pattern: `backend/src/modules/advisory/access/advisory-access.controller.ts`.
- Access assertion: `AdvisoryAccessService.assertThinkTankModuleAvailable(user, tenantId)`.
- Tenant repository pattern: `backend/src/database/repositories/base.repository.ts`.
- Advisory module config repository pattern: `backend/src/modules/advisory/admin/advisory-module-config.repository.ts`.
- Event contracts: `backend/src/modules/advisory/events/thinktank-event-contract.ts` and `advisory-event.service.ts`.
- Runtime catalog config: `_bmad/_config/thinktank-runtime-workflows.csv`.
- Frontend API patterns: `frontend/lib/advisory/access.ts`, `frontend/lib/advisory/envelope.ts`, and `frontend/app/api/advisory/access/route.ts`.
- Workspace shell and tests: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`, `frontend/app/advisory/page.tsx`, and `frontend/app/advisory/__tests__/page.test.tsx`.

### Backend Implementation Guidance

- Prefer a narrow `sessions/` subdomain:
  - `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
  - `backend/src/modules/advisory/sessions/advisory-session.service.ts`
  - `backend/src/modules/advisory/sessions/advisory-session.repository.ts`
  - `backend/src/modules/advisory/sessions/dto/launch-workflow.dto.ts`
- Use a stable workflow status union such as `active | launch_failed | completed`; Story 2.5 should only create `active` sessions and may persist failure rows only if explicitly needed for audit, but failure must never produce an apparently usable/corrupted session.
- The launch response may include the full `firstPrompt` for immediate UI rendering. Audit metadata and logs must not include that prompt.
- `currentStep` should be a minimal snapshot for the first revealed step, for example `{ index: 1, label: '当前步骤', sourceRef: workflow.firstPromptSource }`. Do not expose the full runtime step list.
- Normalize and validate `workflowKey` at the service boundary. Runtime registry already normalizes keys; controller should reject missing/blank path params with a stable 400/404 response.
- Error responses should be clear and recoverable, for example `暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。`; do not expose absolute filesystem paths or raw runtime content.

### Frontend Implementation Guidance

- Render workflow options as real controls only when Story 2.5 data is available. Use buttons or listbox/radio semantics with visible focus states; keep scenario label and canonical workflow name both visible.
- Preserve the single live-status pattern from Story 2.2; avoid multiple simultaneous `aria-live` regions announcing conflicting launch states.
- During launch, disable all workflow launch controls or at least the active pending control so repeated clicks cannot create duplicate sessions.
- The first prompt should render as assistant/AI content with explicit ThinkTank branding already supplied by the runtime. Do not add message input, regenerate controls, report drawer content, or streaming placeholders in this story.
- Horizontal stepper must be compact and current-step-only. If the runtime later exposes future steps, this story must still hide them until the relevant workflow step is reached.

### Latest Technical Notes

- Installed versions for this repo: NestJS 10.4.x, TypeORM 0.3.20, Next.js 14.2.x, React 18.3.x, TypeScript 5.6.x, Jest 29.7.x. Match these local versions rather than introducing new framework assumptions.
- NestJS controllers should keep request handling in decorated classes and delegate business logic to providers; modules must export providers that other modules need to consume. [Source: https://docs.nestjs.com/controllers, https://docs.nestjs.com/modules]
- TypeORM migrations should use the 0.3 QueryRunner API for table/index creation; entity definitions remain the source TypeORM metadata used by repository tests and migration parity checks. [Source: https://typeorm.io/docs/migrations/api/, https://typeorm.io/docs/entity/entities]
- Next.js 14 App Router Route Handlers live in `route.ts`, can expose `GET`/`POST`, and support dynamic route segment params in folders such as `[workflowKey]`. [Source: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]

### Testing Requirements

- Follow TDD: add failing backend and frontend tests before production changes.
- Focused backend commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/runtime src/modules/advisory/sessions --runInBand`
  - `cd backend && npx tsc --noEmit`
- Focused frontend commands:
  - `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand`
  - Run the relevant accessibility assertions already present in advisory tests.
- Pre-commit equivalent before commit:
  - `cd backend && npx lint-staged`
  - `cd frontend && npx lint-staged`
  - `node backend/scripts/detect-orm-risk-changes.js --staged`
- No test may depend on live LLM/network availability. Runtime file reads must use the committed `_bmad` assets or deterministic fixtures.

### Project Structure Notes

- Use the actual repository layout: `backend/src/modules/advisory/` and `frontend/app/advisory/`; do not create the architecture example path `src/advisory/`.
- Backend session entity belongs in `backend/src/database/entities/` because current TypeORM config loads shared entity exports from there.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; BMAD artifacts are ignored by default and must be force-added when committing.
- Avoid production-only test hooks. Tests should query by role, label, text, and status/alert semantics.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.5 requirements.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR11, FR40, FR43, FR44.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - runtime strategy, entity ownership, tenant isolation, frontend quality gates.
- `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md` - advisory shell boundary.
- `_bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md` - accessible UI state patterns.
- `_bmad-output/implementation-artifacts/2-3-theme-density-and-compatibility-baseline.md` - theme/density constraints.
- `_bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md` - runtime service contracts and launch handoff.
- `backend/src/modules/advisory/runtime/` - runtime services to reuse.
- `backend/src/modules/advisory/events/` - audit event contracts.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - workspace shell to extend.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.5, ThinkTank PRD FR11/FR40/FR43/FR44, architecture runtime/entity ownership notes, Story 2.1-2.4 implementation learnings, current backend advisory module patterns, current frontend advisory shell/API proxy patterns, and official NestJS/TypeORM/Next.js references.
- 2026-05-20: ATDD RED evidence captured for missing advisory sessions backend implementation and missing frontend workflow client.
- 2026-05-20: Implemented `workflow_sessions`, shared runtime launch service, workflow catalog/launch endpoints, privacy-safe audit events, frontend workflow client/proxy routes, and workspace launch UI.
- 2026-05-20: Verification passed: backend sessions tests, backend advisory runtime+sessions regression, backend full advisory regression, backend TypeScript, TypeORM parity/metadata checks, frontend advisory page tests, frontend advisory regression, and frontend TypeScript.
- 2026-05-20: Code review raised runtime prompt leakage, audit failure handling, duplicate active launch, partial catalog, proxy session-boundary, and immutable-field issues; all were fixed and reverified.
- 2026-05-20: Traceability matrix and deterministic gate decision completed with PASS; all five ACs have FULL P0 coverage.

### Implementation Plan

- Generate ATDD artifacts for Story 2.5 before implementation.
- Add RED backend tests for session entity/repository/service/controller launch behavior and tenant isolation.
- Add RED frontend tests for catalog display, launch pending/success/failure, first prompt rendering, and current-step-only stepper.
- Implement backend sessions/catelog/launch APIs, then frontend catalog/launch UI and clients.
- Run focused tests, TypeScript validation, code review, traceability, status update, and commit.

### Completion Notes List

- Story context ready for ATDD and implementation.
- Story 2.5 now exposes the eight MVP workflows through the registry-backed runtime catalog and launches each workflow through the same assembler/session/audit path.
- `workflow_sessions` is tenant scoped through `BaseRepository`; tests cover tenant id stripping, scoped read/update/delete, and cross-tenant not-found behavior.
- Launch success persists an active session only after prompt assembly succeeds and emits `thinktank.workflow.started`; launch failure emits `thinktank.workflow.start_failed` without raw prompt/content metadata and without creating a corrupted session.
- Advisory workspace now loads runtime workflow options, disables duplicate launches while pending, renders the first runtime prompt, and shows only the current step.
- Regression evidence: `backend npm run test -- src/modules/advisory --runInBand`, `backend npx tsc --noEmit`, `frontend npm run test -- app/advisory app/api/advisory lib/advisory --runInBand`, and `frontend npx tsc --noEmit` passed.
- Code review fixes added response-level prompt/source sanitization, one-active-session backend and UI guards, full eight-workflow catalog validation, best-effort success audit behavior, stricter proxy session-token forwarding, and create-only session ownership fields.
- Traceability gate decision: PASS with 5/5 P0 acceptance criteria fully covered; only residual note is a non-blocking maintainability warning about the aggregated advisory RTL suite length.

### File List

- `_bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-5-workflow-selection-and-launch.md`
- `_bmad-output/test-artifacts/code-review-story-2-5.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-5-workflow-selection-and-launch.yaml`
- `_bmad-output/test-artifacts/traceability-report-story-2-5.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-5-workflow-selection-and-launch.md`
- `_bmad-output/test-artifacts/traceability-story-2-5-workflow-selection-and-launch-phase1.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-2-5-2026-05-20T04-58-42+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-2-5-2026-05-20T04-58-42+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-5-2026-05-20T04-58-42+08-00.json`
- `backend/src/config/typeorm.entities.ts`
- `backend/src/database/entities/advisory-workflow-session.entity.ts`
- `backend/src/database/entities/index.ts`
- `backend/src/database/migrations/1772000000030-CreateAdvisoryWorkflowSessions.ts`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.ts`
- `backend/src/modules/advisory/sessions/advisory-session.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.repository.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.test.ts`
- `frontend/app/api/advisory/workflows/[workflowKey]/launch/route.ts`
- `frontend/app/api/advisory/workflows/route.test.ts`
- `frontend/app/api/advisory/workflows/route.ts`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/lib/advisory/workflows.ts`

## Change Log

- 2026-05-20: Story context created and marked ready-for-dev.
- 2026-05-20: Implemented workflow selection and launch, added tenant-scoped session persistence, audit events, frontend launch UI, and regression tests; marked ready for review.
- 2026-05-20: Addressed code review findings and reverified backend/frontend advisory regression suites.
- 2026-05-20: Completed traceability and gate decision, then marked Story 2.5 done.
