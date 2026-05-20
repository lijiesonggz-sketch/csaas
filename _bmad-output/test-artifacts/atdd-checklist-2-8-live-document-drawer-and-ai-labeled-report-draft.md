---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T08:34:00+08:00'
storyId: 2-8-live-document-drawer-and-ai-labeled-report-draft
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/2-8-live-document-drawer-and-ai-labeled-report-draft.md
  - _bmad-output/implementation-artifacts/2-7-streaming-message-experience.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md
  - _bmad-output/planning-artifacts/schema.sql
  - _bmad-output/planning-artifacts/ux-design-specification-thinktank.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/ci-burn-in.md
  - _bmad/tea/testarch/knowledge/overview.md
  - _bmad/tea/testarch/knowledge/api-request.md
  - _bmad/tea/testarch/knowledge/network-recorder.md
  - _bmad/tea/testarch/knowledge/auth-session.md
  - _bmad/tea/testarch/knowledge/intercept-network-call.md
  - _bmad/tea/testarch/knowledge/recurse.md
  - _bmad/tea/testarch/knowledge/log.md
  - _bmad/tea/testarch/knowledge/file-utils.md
  - _bmad/tea/testarch/knowledge/network-error-monitor.md
  - _bmad/tea/testarch/knowledge/fixtures-composition.md
  - _bmad/tea/testarch/knowledge/playwright-cli.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-overview.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-consumer-helpers.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-provider-verifier.md
  - _bmad/tea/testarch/knowledge/pactjs-utils-request-filter.md
  - _bmad/tea/testarch/knowledge/pact-mcp.md
---

# ATDD Checklist: Story 2.8 Live Document Drawer and AI-Labeled Report Draft

## Step 1: Preflight and Context

- Detected stack: fullstack repository.
- Story file loaded: `_bmad-output/implementation-artifacts/2-8-live-document-drawer-and-ai-labeled-report-draft.md`.
- Acceptance criteria extracted: live report section append with visible `[AI Generated]` labeling and machine metadata, tenant-scoped `workflow_outputs`, collapsed drawer new-content hint, open drawer scroll/resize/keyboard behavior, completion feedback and focus restoration, and `thinktank.workflow.completed` audit privacy.
- Test frameworks detected:
  - Backend: Jest/ts-jest via `backend/package.json`.
  - Frontend: Jest + React Testing Library via `frontend/jest.config.js`.
  - Browser E2E framework exists at `frontend/playwright.config.ts`; existing `frontend/e2e` tests use `page.goto`/`page.locator`, so the Playwright full UI+API knowledge profile was loaded.
- TEA config loaded from `_bmad/tea/config.yaml`:
  - `test_stack_type: auto`
  - `tea_use_playwright_utils: true`
  - `tea_use_pactjs_utils: true`
  - `tea_pact_mcp: mcp`
  - `tea_browser_automation: auto`
- Pact/CDC note: Pact utilities and MCP guidance were loaded because config enables them. This story stays within in-repo backend and Next proxy contracts; no live broker or network dependency is required.
- Browser recording: not opened during Step 1. Frontend acceptance tests will use semantic role/label/text/title/status/alert selectors and existing mocked API patterns; no production `data-testid` is allowed.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: Story 2.8 has explicit backend, API/proxy, and UI acceptance criteria, the provider/source contracts are in this repository, and deterministic RED tests can be generated from the current advisory session/message patterns without live browser discovery.
- Recording decision: skipped. The drawer has resize and keyboard behavior, but selectors and state transitions can be driven from source-level RTL tests with roles, labels, status regions, alerts, and mocked route/client helpers.
- Pact decision: no live Pact Broker/MCP call. Use in-repo controller/service/proxy contract tests for the backend-to-frontend boundary.

## Step 3: Test Strategy

Primary test level: fullstack integration with focused backend Jest, Next route handler tests, frontend lib unit tests, and RTL component/workspace tests.

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | `workflow_outputs` active draft is created for a tenant/session and appends a completed-step section with visible `[AI Generated]` label plus machine-readable `ai_label_metadata` | Backend service/repository integration | P0 | Missing entity/repository/service APIs fail compilation |
| AC1 | Appended section derives heading, Markdown content, section count, source step metadata, and safe provider/model metadata from the session/message context without copying raw prompts | Backend service unit/integration | P0 | Missing output orchestration and metadata shaping fails |
| AC2 | Direct-id reads, list by session, and append attempts for another tenant return not found/empty without leaking title, summary, sections, or metadata | Backend repository/service | P0 | Missing tenant-scoped repository behavior fails |
| AC2 | TypeORM entity roster, module registration, and fresh migration create expected table/index/JSONB defaults | ORM/entity tests + migration checks | P0 | Missing entity/migration registration fails ORM checks |
| AC1/2/6 | Backend guarded endpoints `GET /advisory/sessions/:sessionId/output`, `POST /output/sections`, and `POST /output/complete` return `{ data }` envelopes and ignore caller-supplied tenant fields | Backend controller/API contract | P0 | Missing routes and DTO behavior fail compilation |
| AC6 | Completing a draft emits `thinktank.workflow.completed` with tenant, actor, session, workflow type, output id, outcome, and AI-label metadata presence; audit metadata excludes raw report content and section text | Backend service/audit | P0 | Missing completion audit fails |
| AC1/2/6 | Next proxy routes under `frontend/app/api/advisory/sessions/[sessionId]/output/...` forward auth, preserve backend status/errors, and strip caller-supplied tenant fields | Frontend route handler | P0 | Missing proxy routes fail compilation |
| AC1/3/5 | Typed frontend output client loads current draft, appends sections, completes output, unwraps envelopes, handles backend errors, and validates minimal response shape | Frontend lib unit | P0 | Missing `frontend/lib/advisory/outputs.ts` fails |
| AC3 | Collapsed right-edge document trigger shows a lightweight new-content hint after a section append; opening clears the hint and displays the latest section | Frontend RTL/workspace | P0 | Current drawer is disabled placeholder |
| AC4 | Open drawer scrolls newly appended section into view without stealing textarea focus, closes with Escape, toggles with Ctrl+D, and clamps resize to min 320px/default 38vw/max 50vw | Frontend component + RTL | P0 | Current shell consumes Ctrl+D as no-op and has no drawer state |
| AC5 | Completed step append shows concise status feedback, updates polite announcement, and restores input focus | Frontend RTL/workspace | P0 | Current completion announcement only covers message streaming |
| AC6 | Final completion path moves output status to completed and shows professional completion feedback without export implementation | Backend service + frontend RTL | P1 | Missing explicit complete output action fails |

Duplicate coverage guard:

- Backend service/repository tests own tenant isolation, metadata shaping, and audit privacy.
- Controller/API tests only verify guarded route contract, envelope shape, and tenant/body stripping.
- Next route tests only verify proxy forwarding/error handling and do not retest backend business logic.
- Frontend lib tests verify client normalization; RTL tests verify user-visible drawer behavior, focus, keyboard, and announcement states.
- Story 2.7 streaming parser and message-rendering tests remain regression coverage and are not duplicated except where output append consumes a completed message event.

Expected RED files:

- `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts`
- `frontend/lib/advisory/outputs.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts`
- `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts`
- `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx`
- `frontend/app/advisory/__tests__/page.test.tsx`

## Step 4C: Aggregate ATDD Test Generation Results

- Subagent outputs read:
  - `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-2-8-2026-05-20T07-44-42+08-00.json`
  - `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-2-8-2026-05-20T07-44-42+08-00.json`
- TDD red phase validation: PASS.
  - API/backend tests: 32, all `test.skip()`.
  - UI/component/workspace tests: 10, all `test.skip()`.
  - No `expect(true).toBe(true)` placeholder assertions found.
  - Every generated test entry is marked `expected_to_fail: true`.
- Test files materialized:
  - `backend/src/modules/advisory/outputs/advisory-workflow-output.repository.spec.ts`
  - `backend/src/modules/advisory/sessions/advisory-session.outputs.spec.ts`
  - `backend/src/modules/advisory/sessions/advisory-session.outputs.controller.spec.ts`
  - `frontend/lib/advisory/outputs.test.ts`
  - `frontend/app/api/advisory/sessions/[sessionId]/output/route.test.ts`
  - `frontend/app/api/advisory/sessions/[sessionId]/output/sections/route.test.ts`
  - `frontend/app/api/advisory/sessions/[sessionId]/output/complete/route.test.ts`
  - `frontend/components/advisory/AdvisoryDocumentDrawer.test.tsx`
  - `frontend/app/advisory/__tests__/page.test.tsx`
- Existing `frontend/app/advisory/__tests__/page.test.tsx` was not overwritten. The Story 2.8 mock block and nested skipped integration specs were merged into the existing `AdvisoryPage` test context.
- Fixture needs were aggregated and documented in the summary JSON. No separate fixture file was created because the RED specs are self-contained or reuse existing page test fixtures; green-phase implementation can extract shared factories if these skipped specs are activated.
- Summary JSON saved to `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-8-2026-05-20T07-44-42+08-00.json`.

## Step 5: Validate & Complete

- Validation checklist reviewed against generated ATDD outputs.
- Prerequisites satisfied:
  - Story 2.8 file exists with acceptance criteria.
  - Backend Jest, frontend Jest/RTL, and Playwright framework configuration are present.
  - Temp artifacts are stored under `_bmad-output/test-artifacts/tmp/`.
  - No browser or CLI session was opened during ATDD generation, so there are no orphaned browser sessions to clean up.
- Output quality checks:
  - Checklist now includes Step 4C aggregation and Step 5 validation.
  - Generated tests are intentionally skipped for RED phase handoff.
  - No production `data-testid` requirement was introduced; selectors are role, label, text, title, status, alert, and accessible-name based.
  - Page test snippet was merged rather than replacing the existing file.
- ATDD completion summary:
  - Total tests: 42 skipped RED tests.
  - API/backend/Next/client coverage: 32 tests.
  - UI/component/workspace coverage: 10 tests.
  - Key implementation risks: tenant-scoped output persistence, privacy-safe audit metadata, proxy body sanitization, focus-safe drawer updates, and keeping AI labels visible plus machine-readable.
  - Next workflow: `bmad-dev-story 2-8`.
