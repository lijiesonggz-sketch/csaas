# Story 2.2: Advisory UI State and Accessibility Baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user using keyboard or assistive technology,
I want the advisory workspace to expose accessible navigation, feedback, and state patterns,
so that I can complete guided workflows without inaccessible or ambiguous UI.

## Acceptance Criteria

1. Given keyboard or assistive technology users operate the shell, when they navigate the workspace, then semantic landmarks, focus states, skip behavior, and ARIA labels support WCAG 2.1 AA expectations, and loading, empty, error, and success states use consistent accessible patterns.
2. Given accessibility checks run for custom advisory components introduced in Epic 2, when axe-core, keyboard navigation, contrast, and screen-reader smoke checks execute, then each custom component in scope passes without WCAG 2.1 AA blocking violations, and any accepted accessibility exception is documented with a remediation owner and target story.

## Tasks / Subtasks

- [x] Preserve and harden the Story 2.1 advisory shell accessibility baseline (AC: 1)
  - [x] Keep `/advisory` as the access-gating route container using `fetchThinkTankAccess()`; do not move authorization into advisory UI components.
  - [x] Keep `MainLayout` as the only top-level page landmark owner, including `#main-content` and the existing skip link; do not add a nested `<main>` inside `AdvisoryWorkspaceShell`.
  - [x] Preserve existing shell landmark names unless a test-backed improvement requires a change: `咨询工作流导航`, `咨询对话工作区`, `咨询文档抽屉`, nested `咨询工作流`.
  - [x] Ensure skip-link behavior, focus order, and visible focus states work for the advisory page entry path.

- [x] Establish reusable advisory state patterns for loading, empty, error, and success feedback (AC: 1)
  - [x] Use native semantics first: `role="status"` / `aria-live="polite"` for loading and non-blocking success/info updates, `role="alert"` for blocking errors.
  - [x] Apply the pattern to current Story 2.1 states: access verification loading, viewport checking, desktop-required fallback, authorized empty conversation, no-history sidebar, empty document drawer placeholder, and access denied/tenant-disabled errors.
  - [x] Add screen-reader descriptions where visible compact UI is insufficient, especially disabled or not-yet-connected affordances.
  - [x] Do not introduce fake interactivity: workflow placeholders remain non-interactive until Story 2.5; document drawer expansion remains disabled until Story 2.8.

- [x] Add keyboard and focus smoke coverage for the advisory shell (AC: 1, 2)
  - [x] Verify the skip link can receive keyboard focus and targets `#main-content`.
  - [x] Verify disabled/not-yet-connected controls do not create misleading tab stops or keyboard actions.
  - [x] Verify keyboard focus is not trapped or lost when desktop gate states change.
  - [x] Continue using Testing Library role/label/text selectors; do not add production `data-testid` attributes.

- [x] Add automated accessibility checks for custom advisory components (AC: 2)
  - [x] Add a direct accessibility test dependency if needed instead of relying on transitive `axe-core`.
  - [x] Run axe-core or equivalent against the rendered authorized advisory shell and its loading/error/desktop-required states.
  - [x] Document known automated-test limits, especially that JSDOM axe checks do not fully prove visual color contrast.
  - [x] Record manual keyboard, screen-reader, and contrast smoke evidence in `_bmad-output/test-artifacts/`.

- [x] Verify and document completion (AC: 1, 2)
  - [x] Run focused advisory tests.
  - [x] Run `cd frontend && npx tsc --noEmit`.
  - [x] Run lint/build where feasible; if blocked by existing repo or network issues, document the exact command and failure.
  - [x] Update this story's Dev Agent Record, File List, Change Log, and Status according to the dev workflow.

## Dev Notes

### Source Requirements

- Epic 2 turns ThinkTank into a unified desktop advisory workspace for selecting and running structured workflows, streaming AI guidance, and producing a first professional report. Story 2.2 is the accessibility and UI-state baseline for that workspace, not the runtime implementation story. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2]
- Story 2.2 explicitly covers semantic landmarks, focus states, skip behavior, ARIA labels, consistent loading/empty/error/success states, and WCAG 2.1 AA blocking checks for custom advisory components. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.2]
- UX-DR24 requires loading and empty states for AI-thinking, no-history sessions, and empty document drawer states, each with a clear next action and accessible labels. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR24]
- UX-DR29 requires WCAG 2.1 AA, semantic HTML, full keyboard navigation, focus management, ARIA labels/live regions, 44x44px minimum targets, contrast thresholds, and no color-only status communication. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR29]
- UX-DR30 defines future keyboard shortcuts: Enter submit, Shift+Enter newline, Escape close modal/drawer, Ctrl+D document drawer toggle, arrow keys for session cards, and A/P/C decision actions. In Story 2.2 only establish baseline and avoid conflicts; implement active workflow shortcuts in their owning stories. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR30]
- UX-DR32 requires custom components to pass axe-core or equivalent automated checks, manual keyboard testing, screen-reader testing, contrast checks, and color-blindness simulation where relevant. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR32]

### Scope Boundaries

Do not implement these future capabilities in this story:

| Capability | Owning story |
| --- | --- |
| Theme, density persistence, and browser compatibility matrix | Story 2.3 |
| Runtime file loading and BMAD-to-ThinkTank brand mapping | Story 2.4 |
| Workflow catalog, session creation, and launch | Story 2.5 |
| Active conversation input, decision controls, and message persistence | Story 2.6 |
| SSE streaming and Markdown message rendering | Story 2.7 |
| Live document drawer behavior, report sections, and drawer resize/toggle | Story 2.8 |
| Export | Story 2.9 |
| Prompt caching and provider-cost behavior | Story 2.10 |

### Previous Story Intelligence

- Story 2.1 created `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` and upgraded `frontend/app/advisory/page.tsx` inside `MainLayout`.
- Preserve the access order from Story 2.1: loading/denied/disabled tenant states are resolved before the authorized shell renders. Access denied must not leak workspace UI.
- Story 2.1 review rerun fixed a hydration risk by using `boolean | null` desktop state and a stable `role="status"` viewport preparation state. Do not reintroduce SSR/client `matchMedia` mismatches.
- `matchMedia` must remain guarded. `AdvisoryWorkspaceShell` falls back to the desktop-required state when unavailable; `MainLayout` falls back to non-mobile.
- `MediaQueryList` listener handling must retain both `addEventListener/removeEventListener` and legacy `addListener/removeListener`.
- Current workflow labels are non-interactive `<li>` placeholders with `待接入`. Do not turn them into tabbable controls until Story 2.5 implements launch behavior.
- Current document drawer trigger is disabled because drawer behavior belongs to Story 2.8. Story 2.2 may improve descriptions and a11y state, but must not implement live drawer opening/report generation.
- Full validation has known non-story risks: `npm run build` can be blocked by Google Fonts `ECONNRESET`; full Jest has an unrelated order-dependent admin failure-modes flaky test that passes in isolation. Document exact rerun results instead of masking them.

### Existing Patterns To Reuse

- Route/access container: `frontend/app/advisory/page.tsx`.
- Advisory shell component: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
- Existing route tests: `frontend/app/advisory/__tests__/page.test.tsx`.
- Global app frame and skip link: `frontend/components/layout/MainLayout.tsx`.
- Shared layout/navigation: `frontend/components/layout/Header.tsx`, `frontend/components/layout/Sidebar.tsx`.
- shadcn/ui primitives: `frontend/components/ui/button.tsx`, `alert.tsx`, `card.tsx`, `dialog.tsx`, `toast.tsx`, `tooltip.tsx`, `separator.tsx`, `textarea.tsx`.
- Existing notification stack: root `frontend/app/layout.tsx` uses `sonner` `Toaster`; avoid adding a parallel toast system.

### Frontend Implementation Guidance

- Keep custom advisory components under `frontend/components/advisory/`. The architecture examples mention `src/components/advisory/`, but this repo has no `frontend/src`; use the established local path.
- Prefer shadcn/Radix and native HTML semantics. Radix primitives already handle many ARIA, focus-management, and keyboard behaviors; do not rebuild those primitives with custom `div` handlers.
- Use concise Chinese labels and screen-reader text. Avoid visible copy that explains keyboard shortcuts or implementation details unless the UI control naturally needs it.
- Use visible focus styles through existing shadcn `focus-visible` patterns. Do not remove outlines without a replacement.
- Do not add new global server-state infrastructure in this story. Architecture calls for TanStack Query + Zustand later, but current Story 2.2 work can stay local unless a focused UI-state helper is warranted.
- Keep the desktop gate as Story 2.1 defined it: viewport width below `1024px` shows the professional desktop-required state. Container-query behavior is deferred to Story 2.3.

### Accessibility Testing Guidance

- Add direct dev dependencies for the chosen automated a11y layer if absent; do not rely on transitive `axe-core` already present in the lockfile.
- For Jest + React Testing Library, `jest-axe` is the simplest fit: render a component/page state, pass `container` to `axe`, and assert no violations.
- JSDOM axe tests are useful for ARIA/landmark/name failures, but they do not fully prove color contrast. Manual contrast evidence must be recorded in a test artifact.
- Keyboard smoke tests should use `@testing-library/user-event` where practical and assert focus movement on actual role/label targets.
- Keep tests aligned with production UI. Per project rules, do not add production `data-testid` solely for tests.

### Latest Technical Notes

- Next.js includes route announcements for client-side transitions and recommends descriptive page titles/headings; it also includes `eslint-plugin-jsx-a11y` rules for ARIA and role mistakes. [Source: https://nextjs.org/docs/architecture/accessibility]
- Radix Primitives follow WAI-ARIA authoring practices and cover many ARIA, focus-management, and keyboard-navigation details, but developers remain responsible for accessible names/descriptions. [Source: https://www.radix-ui.com/primitives/docs/overview/accessibility]
- axe-core is an automated accessibility engine for HTML UIs with WCAG 2.0/2.1/2.2 A/AA/AAA rule tags; it integrates into existing test environments, but JSDOM support has known limits such as color contrast. [Source: https://github.com/dequelabs/axe-core]
- `jest-axe` supports React Testing Library by running `axe(container)` and extending Jest with `toHaveNoViolations`. [Source: https://github.com/NickColley/jest-axe]
- `:focus-visible` is broadly available and is the right CSS hook for keyboard-visible focus indicators; WCAG 2.1 non-text contrast expects visible focus indicators to meet at least 3:1 contrast. [Source: https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible]

### Project Structure Notes

- Use `frontend/app/advisory/` and `frontend/components/advisory/`; do not create a parallel `src/` folder.
- Unit/component tests can remain in the existing colocated `__tests__` route test pattern for `/advisory`; new reusable component tests may live next to the component or in `__tests__` following local convention.
- Any a11y evidence artifact should live under `_bmad-output/test-artifacts/`, for example `accessibility-checklist-story-2-2.md`.
- No backend migrations, advisory tables, provider calls, SSE endpoints, or live LLM calls are needed for this story.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.2 requirements.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR11, FR12, FR19 and CSAAS integration context.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - accessibility, feedback, loading/empty state, and desktop strategy.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - state management, API boundaries, file structure, and quality gates.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - frontend quality gates and MVP scope overrides.
- `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md` - previous story implementation and review learnings.
- `_bmad-output/test-artifacts/code-review-story-2-1.md` - Story 2.1 subagent review rerun findings and fixes.
- `frontend/app/advisory/page.tsx` - access-gating route container.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - custom advisory shell component to harden.
- `frontend/app/advisory/__tests__/page.test.tsx` - existing route-level test patterns.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 2 Story 2.2, ThinkTank PRD/UX/architecture, Story 2.1 implementation notes, Story 2.1 code-review rerun findings, current frontend config, and latest official Next.js/Radix/axe/jest-axe/MDN accessibility references.
- 2026-05-19: ATDD artifacts generated for advisory semantic landmarks, state announcements, skip-link keyboard reachability, non-interactive placeholders, disabled drawer description, and axe coverage.
- 2026-05-19: RED pass confirmed against missing Story 2.2 semantics, then implementation added advisory state patterns and direct `jest-axe` coverage.
- 2026-05-19: Focused GREEN validation passed: `npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand` (19/19), `npx tsc --noEmit`, and focused ESLint.
- 2026-05-19: Code review rerun completed with Blind Hunter, Edge Case Hunter, and Acceptance Auditor; HIGH/MEDIUM blockers were fixed and final pass found no HIGH/MEDIUM findings.
- 2026-05-19: Full Jest validation passed: `npm run test -- --runInBand` (118 suites passed, 1261 tests passed, 2 suites / 23 tests skipped); `git diff --check` passed.
- 2026-05-19: Traceability and quality gate completed for Story 2.2 with AC1/AC2 FULL coverage and PASS decision.
- 2026-05-19: Full frontend lint remains blocked by existing unrelated lint debt outside Story 2.2; `npm run build` remains blocked by Google Fonts `ECONNRESET` in `frontend/app/layout.tsx`, consistent with Story 2.1.

### Implementation Plan

- Add RED acceptance coverage for advisory landmarks, skip link, keyboard focus, state semantics, and automated axe checks.
- Harden the current advisory shell and route states without implementing future workflow runtime or drawer behavior.
- Record manual accessibility evidence and run focused tests plus TypeScript validation.

### Completion Notes List

- Added named `role="status"` / `aria-live="polite"` semantics for access verification, viewport preparation, desktop-required fallback, and a consolidated authorized-shell state announcement.
- Kept access gating in `/advisory`, preserved `MainLayout` as the only top-level `main`, and retained Story 2.1 landmark names.
- Added assertive alert semantics for access denied and tenant-disabled states without leaking workspace landmarks.
- Added disabled drawer screen-reader description plus visible empty/not-yet-open copy, and kept workflow placeholders/document drawer non-interactive until their owning stories.
- Added `jest-axe` plus keyboard/focus smoke tests and captured manual accessibility evidence with known JSDOM contrast limits.
- Added skip-link activation focus transfer, desktop-gate focus handling, contrast fixes, root npm lock synchronization, and a local `jest-axe` type declaration.
- Completed traceability matrix and quality gate with 100% acceptance-criteria coverage and no blocking gaps.

### File List

- `_bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-2-2-advisory-ui-state-and-accessibility-baseline.md`
- `_bmad-output/test-artifacts/atdd-story-2-2-advisory-frontend-red.spec.tsx`
- `_bmad-output/test-artifacts/atdd-story-2-2-advisory-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-2-2-advisory-summary.json`
- `_bmad-output/test-artifacts/accessibility-evidence-story-2-2-advisory-ui-state-and-accessibility-baseline.md`
- `_bmad-output/test-artifacts/code-review-story-2-2.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-2-advisory-ui-state-and-accessibility-baseline.md`
- `_bmad-output/test-artifacts/traceability-matrix-story-2-2-advisory-ui-state-and-accessibility-baseline.json`
- `_bmad-output/test-artifacts/quality-gate-story-2-2-advisory-ui-state-and-accessibility-baseline.json`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/advisory/page.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/components/layout/MainLayout.tsx`
- `frontend/components/layout/__tests__/MainLayout.test.tsx`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/types/jest-axe.d.ts`
- `package-lock.json`

## Change Log

- 2026-05-19: Story context created and marked ready-for-dev.
- 2026-05-19: Generated Story 2.2 advisory ATDD artifacts and accessibility checklist.
- 2026-05-19: Implemented advisory UI state and accessibility baseline, added automated axe/focus tests, recorded accessibility evidence, and moved story to review.
- 2026-05-19: Addressed Story 2.2 code-review findings and reran final code review with no HIGH/MEDIUM blockers.
- 2026-05-19: Completed traceability/gate PASS and marked Story 2.2 done.
