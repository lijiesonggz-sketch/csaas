---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T04:58:42+08:00'
storyId: 2-5-workflow-selection-and-launch
inputDocuments:
  - _bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/fixture-architecture.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
---

# ATDD Checklist: Story 2.5 Workflow Selection and Launch

## Step 1: Preflight and Context

- Detected stack: fullstack repository.
- Story file loaded: `_bmad-output/implementation-artifacts/2-5-workflow-selection-and-launch.md`.
- Acceptance criteria extracted: eight-workflow catalog, shared file-driven launch, first prompt rendering, current-step-only stepper, success/failure audit, tenant-scoped `workflow_sessions`, and no corrupted failed sessions.
- Test frameworks detected:
  - Backend: Jest/ts-jest via `backend/package.json`.
  - Frontend: Jest + React Testing Library + jest-axe via `frontend/package.json`.
  - Browser E2E framework exists at `frontend/playwright.config.ts`, but Story 2.5 ATDD uses existing advisory RTL coverage first because the current advisory shell tests are colocated Jest specs.
- Pact/CDC note: `tea_use_pactjs_utils` is enabled in TEA config, but this repo has no Pact dependency or pact scripts. Contract testing is deferred; provider-side route/controller tests cover the new in-repo consumer/provider boundary for this story.
- Browser recording: skipped. The route already has a stable RTL test harness and Story 2.5 must not require a running dev server for RED.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: acceptance criteria are explicit, target APIs/components are in-repo, and RED tests can be generated directly from story context plus existing advisory test patterns.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | Authorized users list exactly eight MVP workflows from runtime registry metadata | Backend service + frontend RTL | P0 | Missing session/catalog service and workflow client fail compilation |
| AC1/AC3 | Every workflow key launches through one shared registry/assembler/session path | Backend service parameterized unit/integration | P0 | Missing launch service fails compilation |
| AC2 | Launch success returns session id, active status, first prompt, source refs, current-step-only snapshot | Backend service + frontend RTL | P0 | Missing implementation fails compilation and UI cannot render prompt |
| AC2 | `thinktank.workflow.started` audit emitted with tenant, actor, session, workflow type, outcome | Backend service | P0 | Missing audit path fails assertions |
| AC4 | `workflow_sessions` repository injects tenant scope and strips caller-supplied tenant/id fields | Backend repository | P0 | Missing entity/repository fails compilation |
| AC4 | Cross-tenant update/delete/read cannot reveal or mutate another tenant session | Backend repository | P0 | Missing BaseRepository wrapper fails compilation |
| AC5 | Runtime launch failure emits `thinktank.workflow.start_failed`, creates no active/corrupted session, and hides raw prompt/content | Backend service + frontend RTL | P0 | Missing failure path fails compilation |
| UX-DR5/DR9 | Workflow controls are accessible buttons, pending launch disables duplication, failure uses `role="alert"` | Frontend RTL | P1 | Existing placeholder UI does not satisfy new assertions |
| UX-DR5/DR9 | Horizontal stepper exposes only current step and does not leak future steps | Frontend RTL | P1 | Existing UI has no stepper |

## Step 4: Failing Tests Generated

Created RED backend tests:

- `backend/src/modules/advisory/sessions/advisory-session.service.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.repository.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.controller.spec.ts`

Updated RED frontend tests:

- `frontend/app/advisory/__tests__/page.test.tsx`

No production `data-testid` requirements are introduced. This project requires role/label/text selectors for advisory UI tests.

Expected RED commands:

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand
```

Actual RED evidence:

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
```

Result: failed before implementation because `advisory-session.service`, `advisory-session.repository`, `advisory-session.controller`, and `advisory-workflow-session.entity` do not exist.

```bash
cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand
```

Result: failed before implementation because `@/lib/advisory/workflows` does not exist.

## Green Phase Checklist For Dev

- Implement `AdvisoryWorkflowSession` entity and `workflow_sessions` migration.
- Register the new entity in TypeORM entity exports/config and `AdvisoryModule`.
- Implement `AdvisorySessionRepository` using `BaseRepository`.
- Implement `AdvisorySessionService` catalog and launch methods.
- Implement `AdvisorySessionController` routes:
  - `GET /advisory/workflows`
  - `POST /advisory/workflows/:workflowKey/launch`
- Emit `WorkflowStarted` and `WorkflowStartFailed` audit events with privacy-safe metadata.
- Add frontend workflow client and Next proxy routes.
- Replace placeholder workflow list with eight accessible launch controls.
- Render first prompt and current-step-only stepper after successful launch.
- Render recovery-safe `role="alert"` on failed launch.
- Keep document drawer disabled and do not add message input/SSE/report behavior.

## Step 5: Validate and Complete

- Prerequisites satisfied: Story 2.5 has testable ACs and both backend/frontend test frameworks exist.
- Test files created/updated in existing project locations rather than generic `tests/` because the repository uses colocated Jest/RTL specs.
- Checklist maps every Story 2.5 AC to RED tests and implementation tasks.
- RED phase verified locally before production implementation.
- CLI/browser sessions: N/A; no browser automation session opened.
- Temp artifacts stored under `_bmad-output/test-artifacts/tmp/`.

## Next Commands

```bash
cd backend && npm run test -- src/modules/advisory/sessions --runInBand
cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand
cd backend && npx tsc --noEmit
```

**Generated by BMad TEA Agent** - 2026-05-20T04:58:42+08:00
