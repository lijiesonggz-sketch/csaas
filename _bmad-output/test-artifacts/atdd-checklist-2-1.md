---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-05-19T08:10:38+08:00'
workflowType: 'testarch-atdd'
storyId: '2.1'
storyTitle: 'Desktop Advisory Workspace Shell'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification-thinktank.md
  - _bmad-output/planning-artifacts/architecture-thinktank.md
  - _bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md
  - frontend/app/advisory/page.tsx
  - frontend/app/advisory/__tests__/page.test.tsx
  - frontend/lib/advisory/access.ts
  - frontend/components/layout/MainLayout.tsx
  - frontend/components/layout/Header.tsx
  - frontend/components/layout/Sidebar.tsx
  - frontend/package.json
  - frontend/playwright.config.ts
  - frontend/jest.config.js
  - _bmad/tea/config.yaml
---

# ATDD Checklist - Epic 2, Story 1: Desktop Advisory Workspace Shell

**Date:** 2026-05-19T08:10:38+08:00
**Author:** leo
**Primary Test Level:** Frontend route/component

## Story Summary

Story 2.1 upgrades the authorized `/advisory` ThinkTank placeholder into a desktop-first advisory workspace shell. It keeps Story 1.1 access gating, renders inside the CSAAS application frame, introduces advisory-owned shell regions, blocks broken narrow layouts below 1024px, and keeps the MVP tone professional and restrained.

This story does not introduce workflow runtime, API endpoints, provider calls, persistence tables, streaming, report generation, export, prompt caching, or Party Mode.

## Acceptance Criteria

1. Authorized desktop users see the CSAAS top navigation, global left navigation, advisory left sidebar, central conversation area, and collapsed right document drawer using existing shadcn/ui and CSAAS tokens.
2. Viewports below `1024px` show a clear desktop-required/recommended state and do not render a squeezed three-column shell.
3. MVP shell copy and empty/completion-ready states remain concise and professional, with no gamification, heavy celebration, decorative AI visuals, or "workspace not open" placeholder behavior.

## Step 1: Preflight & Context

- TEA config uses `test_stack_type=auto`; repository detection is `fullstack`.
- Story 2.1 has clear, testable AC and an implementation story file at `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md`.
- Frontend Jest/RTL and Playwright configs exist in `frontend/`.
- Affected components:
  - `frontend/app/advisory/page.tsx`
  - `frontend/app/advisory/__tests__/page.test.tsx`
  - `frontend/lib/advisory/access.ts`
  - `frontend/components/layout/MainLayout.tsx`
  - new `frontend/components/advisory/*`
- Legacy `_bmad-output/test-artifacts/atdd-story-2-1-api-red.spec.ts`, `atdd-story-2-1-backend-red.spec.ts`, and `atdd-story-2-1-fixtures.ts` belong to an older Knowledge Graph planning set and are not used for this ThinkTank story. They were left in place to avoid deleting test artifacts; the active artifacts are `atdd-story-2-1-frontend-red.spec.tsx` and `atdd-story-2-1-advisory-fixtures.ts`.
- Browser recording was not used. The current `/advisory` route is a placeholder, and target selectors are generated from intended semantic roles/labels.
- CLI sessions cleaned up: N/A, no CLI session opened.

## Step 2: Generation Mode

- Selected mode: AI generation.
- Reason: AC are clear, current UI is known from source, and selector targets are semantic shell landmarks rather than complex live interactions.
- Execution mode: sequential in the current agent, because this story pipeline is running in the current workspace and no explicit user delegation was requested.
- Pact/CDC: N/A. No consumer/provider HTTP contract is introduced.

## Step 3: Test Strategy

| Scenario | AC | Level | Priority | RED behavior |
| --- | --- | --- | --- | --- |
| Authorized desktop route renders CSAAS frame plus advisory shell regions | 1 | Frontend route/component | P0 | Fails until `/advisory` wraps authorized content with `MainLayout` and renders advisory shell regions |
| Narrow viewport below 1024px renders desktop-required state and suppresses shell columns | 2 | Frontend component | P0 | Fails until viewport gate exists |
| Denied and disabled tenant states remain alerts and never leak workspace UI | 1, 2 | Frontend route/component regression | P1 | Guards Story 1.1 behavior while shell is added |
| Shell removes unavailable placeholder and uses concise professional empty state | 3 | Frontend component | P1 | Fails until placeholder button/copy are replaced |

Duplicate backend/API coverage is intentionally avoided because this story is UI shell only.

## Step 4: RED Phase Artifacts

### API RED Tests

No API/browser-service contract tests were generated. Story 2.1 creates no endpoint and no backend service behavior.

Temporary output:

- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-2-1-2026-05-19T08-10-38+08-00.json`

### Frontend RED Tests

**File:** `_bmad-output/test-artifacts/atdd-story-2-1-frontend-red.spec.tsx`

- `[P0][2.1-SHELL-001] authorized desktop users see the CSAAS frame and full advisory workspace shell`
- `[P0][2.1-SHELL-002] narrow viewports show the desktop-required state and do not render broken shell columns`
- `[P1][2.1-SHELL-003] denied and disabled tenant states remain friendly alerts and do not leak workspace UI`

All tests are intentionally `test.skip()` and contain expected-behavior assertions, not placeholders. DEV should translate these into active coverage in `frontend/app/advisory/__tests__/page.test.tsx` during the green phase.

### Fixtures

**File:** `_bmad-output/test-artifacts/atdd-story-2-1-advisory-fixtures.ts`

Exports deterministic ThinkTank access results, authenticated session, expected semantic region labels, desktop-required message, empty-state copy, and a `matchMedia` test helper.

### Temporary Summary Artifacts

- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-2-1-2026-05-19T08-10-38+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-1-2026-05-19T08-10-38+08-00.json`

## Implementation Checklist

### Test: `[P0][2.1-SHELL-001]`

- [ ] Keep `fetchThinkTankAccess()` loading/authorized/denied flow in `frontend/app/advisory/page.tsx`.
- [ ] Wrap authorized content with `MainLayout` so `Header` and global `Sidebar` remain visible.
- [ ] Add `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
- [ ] Render advisory sidebar, central conversation workspace, and collapsed document drawer with semantic labels.
- [ ] Use shadcn/ui, lucide icons, Tailwind, and existing CSAAS colors/radius/border conventions.

### Test: `[P0][2.1-SHELL-002]`

- [ ] Add client viewport gate using `matchMedia('(min-width: 1024px)')` or equivalent.
- [ ] Render desktop-required/recommended state below `1024px`.
- [ ] Do not render the advisory shell columns below the desktop threshold.

### Test: `[P1][2.1-SHELL-003]`

- [ ] Preserve access denied and tenant-disabled alert behavior.
- [ ] Ensure denied/disabled states do not render shell regions or drawer controls.
- [ ] Remove the disabled "咨询工作台暂未开放" button from authorized state.

## Required Real Test Updates During DEV

- Update `frontend/app/advisory/__tests__/page.test.tsx` with active tests corresponding to the RED artifact.
- Mock `next-auth/react`, `next/navigation`, `useRadarUnreadCount`, `fetchThinkTankAccess`, and `window.matchMedia`.
- Prefer role/name assertions over CSS selectors.
- Do not add `data-testid` to production code unless no semantic selector can express the assertion.

## Running Tests

```bash
cd frontend
npm run test -- app/advisory/__tests__/page.test.tsx --runInBand
npx tsc --noEmit
npm run test -- --runInBand
npm run build
```

## Validation Against ATDD Checklist

- Story loaded and AC extracted: complete.
- Framework config present: complete (`frontend/jest.config.js`, `frontend/playwright.config.ts`).
- Existing test pattern reviewed: complete (`frontend/app/advisory/__tests__/page.test.tsx`).
- Knowledge applied: `component-tdd`, `data-factories`, `fixture-architecture`, `selector-resilience`, `test-quality`, `timing-debugging`, `test-levels-framework`.
- Tests designed to fail before implementation: complete. They expect semantic shell regions and desktop gate that do not exist in the current placeholder.
- Tests are skipped for RED handoff: complete.
- Temp artifacts stored under `{test_artifacts}/tmp`: complete.
- CLI sessions cleaned up: N/A, no browser session opened.

## Assumptions and Risks

- Story 2.1 is frontend-only. If implementation discovers a backend need, it must be split or explicitly justified because no API ATDD coverage was generated.
- Full WCAG/axe coverage is Story 2.2; Story 2.1 includes only smoke-level semantic region assertions.
- Existing legacy Story 2.1 KG test artifacts remain in the folder but are not active for this ThinkTank story.

## Next Step

Run `bmad-dev-story` for Story 2.1. The DEV step should turn the RED expectations into active Jest/RTL tests, implement the shell, and run focused frontend verification.

