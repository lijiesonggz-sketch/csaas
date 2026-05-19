---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-19T09:06:28+08:00'
workflowType: testarch-atdd
storyId: 2-2-advisory-ui-state-and-accessibility-baseline
storyTitle: Advisory UI State and Accessibility Baseline
inputDocuments:
  - _bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md
  - _bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md
  - _bmad-output/test-artifacts/code-review-story-2-1.md
  - frontend/app/advisory/page.tsx
  - frontend/app/advisory/__tests__/page.test.tsx
  - frontend/components/advisory/AdvisoryWorkspaceShell.tsx
  - frontend/components/layout/MainLayout.tsx
  - frontend/package.json
  - frontend/jest.config.js
  - frontend/playwright.config.ts
  - _bmad/tea/config.yaml
---

# ATDD Checklist - Story 2.2: Advisory UI State and Accessibility Baseline

**Date:** 2026-05-19T09:06:28+08:00  
**Author:** leo  
**Primary Test Level:** Frontend route/component with automated accessibility checks

## Story Summary

Story 2.2 hardens the Story 2.1 ThinkTank advisory shell for keyboard and assistive technology users. It covers semantic landmarks, skip behavior, visible focus, ARIA labels, loading/empty/error/success state semantics, automated axe checks, and manual accessibility evidence. It does not add runtime workflow launching, live document drawer behavior, provider calls, persistence, SSE streaming, export, or prompt caching.

## Step 1: Preflight & Context

- TEA config uses `test_stack_type=auto`; repository detection is `fullstack`.
- Story file loaded from `_bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md`.
- Acceptance criteria are clear and testable.
- Frontend test framework exists: `frontend/jest.config.js`, `frontend/playwright.config.ts`, Testing Library, user-event, and Jest.
- Existing Story 2.1 tests and shell implementation reviewed.
- Required Story 2.1 boundaries preserved in test intent:
  - `/advisory` remains the access-gating route using `fetchThinkTankAccess()`.
  - `MainLayout` remains the single top-level `<main>` owner.
  - Landmark names remain `咨询工作流导航`, `咨询对话工作区`, `咨询文档抽屉`, and nested `咨询工作流`.
  - Workflow placeholders remain non-interactive until Story 2.5.
  - Document drawer trigger remains disabled until Story 2.8.
  - Hydration-safe desktop gate and `matchMedia` fallback remain required.
- Knowledge fragments applied: `data-factories`, `component-tdd`, `test-quality`, `test-healing-patterns`, `selector-resilience`, `timing-debugging`, `fixture-architecture`, `network-first`, `test-levels-framework`, `test-priorities-matrix`.
- Browser recording was skipped. Current source and semantic role expectations provide stable selectors; no live complex interaction was needed.
- CLI sessions cleaned up: N/A, no CLI session opened.

## Step 2: Generation Mode

- Selected mode: AI generation.
- Reason: Story 2.2 scenarios are semantic accessibility and state-pattern checks over known React components.
- Execution mode: API worker ran as a subagent and completed. Frontend worker timed out, so Step 4B was rerun sequentially in the current agent to produce the required RED artifact.
- Pact/CDC: N/A. Story 2.2 introduces no API or provider contract.

## Step 3: Test Strategy

| Scenario | AC | Level | Priority | RED behavior |
| --- | --- | --- | --- | --- |
| Skip link receives keyboard focus and targets the only `main#main-content` | 1 | Route/layout component | P0 | Fails until focus-visible skip behavior is asserted and protected |
| Authorized shell exposes stable landmarks, nested workflow nav, and accessible status regions | 1 | Route/component | P0 | Fails until success/no-history/empty states use status semantics |
| Loading, denied, disabled tenant, desktop-required, and empty states use consistent live-region semantics | 1 | Route/component | P0 | Fails until all state variants expose `role=status` or `role=alert` appropriately |
| Desktop viewport gate changes do not lose or trap keyboard focus | 1, 2 | Route/component | P0 | Fails until focus remains contained in the document after media-query transitions |
| Disabled drawer and unavailable workflow placeholders do not create misleading interactivity | 1, 2 | Component | P1 | Fails until disabled drawer has a description and placeholders remain non-tab controls |
| axe checks pass for authorized, loading, denied, and desktop-required states | 2 | Component accessibility | P0 | Fails until `jest-axe` is installed and states have no blocking violations |

Duplicate backend/API coverage is intentionally avoided because this story is frontend-only.

## Step 4: RED Phase Artifacts

### API RED Tests

No API tests were generated.

Reason: Story 2.2 has no new endpoint, no backend service behavior, and no CDC/provider contract. The API worker returned `success=true`, `test_count=0`, and `provider_scrutiny=not-applicable`.

### Frontend RED Tests

**File:** `_bmad-output/test-artifacts/atdd-story-2-2-advisory-frontend-red.spec.tsx`

- `[P0][2.2-A11Y-001] exposes a keyboard-visible skip link targeting the single MainLayout main landmark`
- `[P0][2.2-A11Y-002] renders authorized advisory landmarks and state regions with stable accessible names`
- `[P0][2.2-A11Y-003] uses consistent live-region semantics for loading, denied, desktop-required, and empty states`
- `[P0][2.2-A11Y-004] preserves keyboard focus when the desktop viewport gate changes state`
- `[P1][2.2-A11Y-005] keeps unavailable workflow and document drawer affordances non-misleading`
- `[P0][2.2-A11Y-006] has no axe blocking violations across authorized, loading, denied, and desktop-required states`

All RED tests use `it.skip()` and assert expected behavior, not placeholders. DEV should translate these into active coverage in `frontend/app/advisory/__tests__/page.test.tsx` and/or a colocated advisory component test during the green phase.

### Fixtures

**File:** `_bmad-output/test-artifacts/atdd-story-2-2-advisory-fixtures.ts`

Exports deterministic access/session fixtures, expected landmark labels, expected state copy, and a media-query helper that supports runtime changes.

### Summary

**File:** `_bmad-output/test-artifacts/atdd-story-2-2-advisory-summary.json`

Records total test count, API/frontend split, TDD phase, and generated files.

## Implementation Checklist

- [ ] Add direct accessibility test dependency, preferably `jest-axe` and its types, instead of relying on transitive `axe-core`.
- [ ] Extend active route/component tests using Testing Library role/name selectors and user-event keyboard traversal.
- [ ] Add axe checks for authorized, loading, denied, desktop-required, and relevant shell states.
- [ ] Ensure route loading state has explicit `aria-live="polite"`.
- [ ] Ensure desktop-required fallback is exposed as a non-blocking status pattern.
- [ ] Ensure enabled, no-history, empty-conversation, and empty-document-drawer states use consistent status semantics.
- [ ] Ensure blocking access failures remain `role="alert"` and never render workspace regions.
- [ ] Ensure document drawer trigger remains disabled but has a screen-reader description explaining that the behavior is not yet connected.
- [ ] Ensure workflow placeholders remain non-interactive list items and are not tabbable fake controls.
- [ ] Add manual accessibility evidence artifact covering keyboard, screen-reader smoke, and contrast limitations.

## Running Tests

```bash
cd frontend
npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

`npm run build` may fail on Google Fonts network `ECONNRESET`; if so, record the exact failure in the story Dev Agent Record instead of masking it.

## Validation Against ATDD Checklist

- Story loaded and AC extracted: complete.
- Framework config present: complete.
- Existing test pattern reviewed: complete.
- Tests designed for RED phase: complete.
- API/CDC not applicable documented: complete.
- All RED tests are skipped: complete.
- All RED tests assert expected behavior: complete.
- Temp/random external output avoided: complete; artifacts are under `_bmad-output/test-artifacts/`.
- CLI sessions cleaned up: N/A.

## Assumptions and Risks

- JSDOM axe checks do not fully prove visual color contrast; manual contrast evidence is required.
- Automated screen-reader behavior is only a smoke proxy through roles, names, and descriptions; manual screen-reader smoke evidence is required.
- Full E2E browser coverage is not required for this baseline story unless focused component/route tests expose a browser-only issue.

## Next Step

Run `bmad-dev-story` for Story 2.2. The DEV step should activate the relevant RED expectations, implement the accessibility baseline, run focused tests, run TypeScript validation, and document manual accessibility evidence.
