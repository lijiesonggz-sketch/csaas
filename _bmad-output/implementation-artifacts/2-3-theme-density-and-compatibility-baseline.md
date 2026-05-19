# Story 2.3: Theme, Density, and Compatibility Baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want the advisory workspace to follow CSAAS visual conventions and my reading preferences,
so that long advisory sessions remain readable and consistent with the host product.

## Acceptance Criteria

1. Given the workspace is implemented, when design and component conventions are reviewed, then custom advisory components use the repo-local `frontend/components/advisory/` convention, shadcn/Radix foundations, Tailwind, TypeScript, and variant patterns, and the UI supports existing CSAAS theme behavior including dark mode where available.
2. Given users read long advisory content, when they change reading density or font-size preference, then compact, default, and comfortable reading modes can be persisted per user, and the layout keeps nav height, sidebar width, chat minimum width, document drawer width, and input height within the UX-defined desktop constraints.
3. Given the workspace is tested, when compatibility and accessibility checks run, then current and previous two versions of Chrome, Firefox, Safari, and Edge are in scope, and axe-core, keyboard navigation, contrast, and screen-reader checks pass for the shell and custom components.

## Tasks / Subtasks

- [x] Establish the advisory theme/token baseline without replacing CSAAS design language (AC: 1)
  - [x] Keep `AdvisoryWorkspaceShell` under `frontend/components/advisory/`; do not create `src/`, `components/thinktank/`, or a parallel component system.
  - [x] Reuse shadcn/ui, Radix-backed primitives, Tailwind, `class-variance-authority`/variant patterns where a reusable mode class is warranted, and existing lucide icons.
  - [x] Replace advisory-only hard-coded visual values with CSAAS/shadcn token classes or advisory semantic CSS variables where that improves dark-mode and density compatibility.
  - [x] Preserve the professional CSAAS palette and restrained shell style from Stories 2.1/2.2: no landing hero, no decorative AI visuals, no gamification, no one-off theme.
  - [x] Support `.dark` / CSAAS dark-token behavior for the advisory shell when the host product supplies dark mode; do not add a global visible theme switch unless an existing project pattern already owns it.

- [x] Add persisted reading density and font-size preferences for advisory content (AC: 2)
  - [x] Define explicit density modes: `compact`, `default`, and `comfortable`, with stable labels in Chinese.
  - [x] Persist the selected mode per signed-in user using a frontend preference store or utility; if no backend preference API exists, use scoped browser storage keyed by the current user identity and document the backend-persistence deferral.
  - [x] Apply density to advisory reading surfaces through data attributes, CSS variables, or typed variant helpers; do not scale font size with viewport width.
  - [x] Add an accessible mode control in the advisory workspace header using existing shadcn/Radix primitives; it must be keyboard reachable, have a clear accessible name, and not introduce fake workflow actions.
  - [x] Keep loading, denied, tenant-disabled, desktop-required, and authorized shell states stable during preference hydration; avoid SSR/client markup mismatch.

- [x] Codify desktop layout constraints for the shell (AC: 2)
  - [x] Resolve the current `/advisory` route composition so exactly one `MainLayout` wraps the advisory page in real Next.js routing; `frontend/app/advisory/layout.tsx` and `frontend/app/advisory/page.tsx` must not both own the global frame.
  - [x] Define reusable advisory layout constants or CSS variables for `navHeight: 56px`, advisory sidebar about `240px`, `chatMinWidth: 480px`, collapsed document rail `64px`, future drawer min/default/max `320px` / `38vw` / `50vw`, and input max height `200px`.
  - [x] Apply the constraints to the current three-column shell without implementing future drawer expansion from Story 2.8 or input behavior from Story 2.6.
  - [x] Preserve the `1024px` desktop-required gate and the guarded `matchMedia` / legacy listener fallback from Stories 2.1 and 2.2.
  - [x] Ensure long labels and density controls do not overlap the header or resize fixed-format shell areas at desktop widths.

- [x] Add automated theme, density, compatibility, and accessibility coverage (AC: 1, 2, 3)
  - [x] Extend focused advisory tests to cover density control keyboard interaction, per-user persistence, and class/token changes for each mode.
  - [x] Add dark-mode smoke coverage by rendering the shell with a `.dark` root class and asserting readable landmark/state content remains present with no axe violations.
  - [x] Keep existing Story 2.2 axe coverage for loading, denied, desktop-required, and authorized states; update it for any new density control or tokenized shell markup.
  - [x] Record a browser compatibility matrix artifact under `_bmad-output/test-artifacts/` that maps Chrome, Edge, Firefox, and Safari support to Playwright/browser-engine coverage and any environment limitation.
  - [x] If a real browser smoke test is practical in this workspace, add or update a narrowly scoped Playwright test for the advisory shell across desktop Chromium, Firefox, and WebKit projects; otherwise document the exact blocker and keep Jest/axe coverage as the automated baseline.

- [x] Verify and document completion (AC: 1, 2, 3)
  - [x] Run focused advisory tests.
  - [x] Run `cd frontend && npx tsc --noEmit`.
  - [x] Run focused ESLint for changed frontend files.
  - [x] Run full Jest and build where feasible; if blocked by existing repo lint debt or Google Fonts network failures, document the exact command and failure.
  - [x] Update this story's Dev Agent Record, File List, Change Log, and Status according to the dev workflow.

## Dev Notes

### Source Requirements

- Epic 2 turns ThinkTank into a unified desktop advisory workspace. Story 2.3 owns visual convention, reading-density preference, layout constants, and compatibility evidence only. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 / Story 2.3]
- Story 2.3 acceptance criteria require advisory components to use shadcn/Radix, Tailwind, TypeScript, variant patterns, and existing CSAAS theme behavior including dark mode where available. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.3]
- UX-DR25 requires shadcn/ui new-york + slate token inheritance and advisory semantic colors for user, agent, system, and Party Mode experts; Party colors cannot be the only way information is conveyed. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR25]
- UX-DR26 requires CSAAS fonts and compact/default/comfortable reading-size modes persisted per user. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR26]
- UX-DR27 requires layout dimensions: nav `56px`, sidebar about `240px`, chat min `480px`, document drawer min `320px` / default `38vw` / max `50vw`, input max `200px`, desktop minimum `1024px`. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR27]
- UX-DR31 requires browser support for current and previous two versions of Chrome, Firefox, Safari, and Edge; IE 11 and old mobile browsers are out of scope. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR31]
- UX-DR33 requires custom components to use shadcn/Radix foundations, Tailwind, TypeScript, `cva` variants, and a project-aligned advisory component directory. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR33]
- UX-DR36 requires dark mode through existing CSAAS theme behavior using `next-themes` / background-foreground tokens if the host application exposes theme switching. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR36]

### Scope Boundaries

Do not implement these future capabilities in this story:

| Capability | Owning story |
| --- | --- |
| Runtime file loading and ThinkTank brand mapping | Story 2.4 |
| Workflow catalog, selection, session creation, and launch | Story 2.5 |
| Conversation input, active decision controls, and message persistence | Story 2.6 |
| SSE streaming and Markdown message rendering | Story 2.7 |
| Live document drawer opening, resize behavior, and report draft content | Story 2.8 |
| Report export | Story 2.9 |
| Prompt caching and provider-cost behavior | Story 2.10 |
| Global account settings page for preferences | Post-MVP unless a later story adds it |

### Previous Story Intelligence

- Story 2.1 created `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` and the authorized `/advisory` route composition. Preserve `/advisory` as the `fetchThinkTankAccess()` gate and keep `MainLayout` as the only top-level `main` owner.
- Current code has a route-composition risk: `frontend/app/advisory/layout.tsx` wraps children in `MainLayout`, while `frontend/app/advisory/page.tsx` also wraps each access state in `MainLayout`. Story 2.3 should resolve this to one real Next.js route frame before validating layout dimensions; direct Jest rendering of `page.tsx` does not expose the duplicate frame.
- Story 2.1 review rerun fixed hydration risk by using `boolean | null` desktop state and a stable viewport-preparation status before `matchMedia` resolves. Do not read `window`, `localStorage`, or theme state during SSR in a way that changes initial markup.
- `matchMedia` must remain guarded and must keep both `addEventListener/removeEventListener` and legacy `addListener/removeListener` fallbacks.
- Story 2.2 consolidated authorized-shell announcements into a single `role="status"` named `ThinkTank 工作台状态`. Do not add multiple static live regions for density/theme updates.
- Story 2.2 fixed contrast issues by replacing weak slate text and focus outline colors. Any new token/dark-mode work must preserve WCAG 2.1 AA contrast and record evidence.
- Current workflow placeholders are non-interactive `<li>` elements and the document drawer button is disabled. Story 2.3 may restyle them for density/theme, but must not make them interactive.
- Existing known verification risks: full frontend lint has unrelated legacy failures; `npm run build` can fail while fetching Google Fonts (`Inter` / `Plus Jakarta Sans`) from `fonts.gstatic.com`. Document exact results instead of masking them.

### Existing Patterns To Reuse

- Route/access container: `frontend/app/advisory/page.tsx`.
- Advisory shell component: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`.
- Advisory route tests and `matchMedia` helper: `frontend/app/advisory/__tests__/page.test.tsx`.
- Global app frame and skip link: `frontend/components/layout/MainLayout.tsx`.
- Existing shadcn/Radix primitives: `frontend/components/ui/button.tsx`, `radio-group.tsx`, `select.tsx`, `tooltip.tsx`, `separator.tsx`, `badge.tsx`, `card.tsx`.
- Existing client provider stack: `frontend/lib/providers.tsx`; it currently contains `SessionProvider`, `BrandProvider`, and the Radix dialog cleanup hook.
- Brand token injection pattern: `frontend/components/layout/BrandProvider.tsx` dynamically writes brand CSS variables, but it does not currently map those values into shadcn `--primary` / `--secondary` tokens.
- Existing Tailwind/shadcn tokens: `frontend/app/globals.css` and `frontend/tailwind.config.ts`.
- Existing client-state dependency: `zustand` is already in `frontend/package.json`; use it for local advisory UI preferences if a store is warranted.

### Frontend Implementation Guidance

- Prefer typed constants and variant helpers over scattering literal dimensions and density class names through JSX.
- If adding advisory semantic CSS variables, define light and `.dark` values under `@layer base` in `frontend/app/globals.css` and consume them through Tailwind arbitrary values or stable class names.
- Do not add `next-themes` unless implementation determines a real host-level theme provider is necessary. The current repo already has `darkMode: ['class']` and `.dark` token blocks but no installed `next-themes` dependency. Supporting `.dark` token compatibility is enough unless a visible host theme toggle exists.
- `frontend/app/globals.css` currently forces OS dark preference back to light RGB values at the top of the file, while later shadcn `.dark` variables exist. Treat this as host behavior to document/test; do not silently convert the whole app to OS-driven dark mode in Story 2.3.
- If a `ThemeProvider` is added in a later decision, put it in a client provider wrapper and add `suppressHydrationWarning` to `<html>` to avoid expected root-class hydration warnings from `next-themes`.
- Density labels should be user-facing and short, for example `紧凑`, `默认`, `舒适`; the accessible group/control name should identify this as `阅读密度`.
- User-scoped browser storage is acceptable for this baseline when no backend preference API exists. Use a key scoped to ThinkTank/advisory and the session user email or stable id; avoid leaking preferences across users on the same browser.
- Do not use viewport-width-based font scaling. Apply density through discrete sizes/line-heights/spacing tokens.
- Keep cards at `rounded-sm`/small radius and avoid nested page-section cards. The advisory workspace remains a dense work surface, not a marketing page.

### Accessibility and Compatibility Guidance

- Use native semantics first. A density control should expose either radio-group semantics or select semantics; do not build clickable `div` controls.
- Ensure density changes are keyboard operable and do not trap focus. A single polite status update is acceptable if it announces that the reading preference changed.
- Automated `jest-axe` in JSDOM does not fully prove color contrast. Record manual or computed contrast evidence for any new semantic colors and dark-mode tokens.
- Existing Playwright config covers `chromium`, `firefox`, and `webkit` desktop projects, plus mobile projects. Story 2.3 is desktop-only; mobile projects are not acceptance blockers except that the desktop-required fallback must remain stable below `1024px`.
- Playwright's Chromium coverage is the practical automation proxy for Chrome and Edge engine behavior; if branded Chrome/Edge channels are not installed locally, document that limitation in the compatibility artifact.

### Latest Technical Notes

- shadcn/ui dark mode guidance for Next.js uses `next-themes`, a client `ThemeProvider`, and class-based theme application; this repo currently has token/dark-class support but not the dependency. [Source: https://ui.shadcn.com/docs/dark-mode]
- shadcn/ui theming is CSS-variable driven, so components should consume background/foreground/muted/border tokens instead of hard-coded colors when they need theme compatibility. [Source: https://ui.shadcn.com/docs/theming]
- Tailwind dark mode can be driven by a selector/class strategy, matching this repo's `darkMode: ['class']` Tailwind config. [Source: https://tailwindcss.com/docs/dark-mode]
- `next-themes` modifies the root HTML attribute/class before hydration; its README documents using `suppressHydrationWarning` on `<html>` when it is installed. [Source: https://github.com/pacocoursey/next-themes]
- Playwright supports Chromium, Firefox, and WebKit projects, and can also run branded Chrome/Edge channels when those browsers are available on the host. [Source: https://playwright.dev/docs/browsers]

### Testing Requirements

- Follow TDD: add/update failing tests before production code changes.
- Focused tests:
  - `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand`
  - Add a store/unit test if a new advisory preference utility or Zustand store is introduced.
- Accessibility:
  - Keep `jest-axe` assertions for loading, denied, desktop-required, and authorized shell states.
  - Add coverage for the density control and dark-token smoke state.
- Static validation:
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npx eslint <changed frontend files>`
- Broader regression where feasible:
  - `cd frontend && npm run test -- --runInBand`
  - `cd frontend && npm run build`
  - If E2E is added and a dev server is available: `cd frontend && npx playwright test <advisory spec> --project=chromium --project=firefox --project=webkit`

### Project Structure Notes

- The planning docs mention `src/components/advisory/`; this repository's frontend does not use `frontend/src`, so the correct local path is `frontend/components/advisory/`.
- Keep route-level advisory tests under `frontend/app/advisory/__tests__/`.
- New advisory-specific utilities may live under `frontend/lib/advisory/` or `frontend/lib/stores/` if they are shared beyond one component.
- Evidence artifacts for compatibility/accessibility belong under `_bmad-output/test-artifacts/`, for example `compatibility-evidence-story-2-3-theme-density-and-compatibility-baseline.md`.
- No backend migrations, advisory tables, provider calls, SSE endpoints, or export code are needed in this story.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.3 requirements.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR11, FR12, FR19 and ThinkTank workflow/report context.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - visual foundation, layout constraints, accessibility, dark mode, and reading adaptation.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - frontend structure, shadcn/Tailwind, Zustand client state, and advisory boundaries.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - custom advisory component quality gates.
- `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md` - shell, desktop gate, and review learnings.
- `_bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md` - accessibility baseline and live-region/focus/contrast learnings.
- `_bmad-output/test-artifacts/code-review-story-2-1.md` - viewport and false-affordance review fixes to preserve.
- `_bmad-output/test-artifacts/code-review-story-2-2.md` - accessibility/dependency findings to preserve.
- `frontend/app/advisory/page.tsx` - access-gating route container.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - custom advisory shell to theme and densify.
- `frontend/app/advisory/__tests__/page.test.tsx` - current route/accessibility test pattern.
- `frontend/app/globals.css` and `frontend/tailwind.config.ts` - CSAAS/shadcn theme tokens.
- `frontend/playwright.config.ts` - current browser project matrix.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 2 Story 2.3, ThinkTank PRD/UX/architecture, Story 2.1 and 2.2 implementation/review learnings, current frontend theme/provider/test config, and official shadcn/Tailwind/next-themes/Playwright references.

### Implementation Plan

- Add RED coverage for density mode selection, per-user preference persistence, dark-token smoke behavior, layout constraints, and updated axe coverage.
- Implement advisory theme/density baseline with existing shadcn/Tailwind primitives and repo-local advisory components.
- Record compatibility evidence and run focused tests plus TypeScript validation.

### Completion Notes List

- 2026-05-19: Implemented advisory semantic theme variables with light/dark token compatibility and updated the shell to consume CSAAS/shadcn CSS variables instead of advisory-only hard-coded colors.
- 2026-05-19: Added user-scoped browser preference persistence for advisory reading density (`compact`, `default`, `comfortable`) with Chinese labels. Backend persistence is intentionally deferred because no backend preference API exists in this story scope.
- 2026-05-19: Added accessible Radix radio-group density control in the advisory header and applied density through typed `cva` variants, discrete classes, and `data-reading-density`; no viewport-width font scaling was introduced.
- 2026-05-19: Resolved `/advisory` route composition so `layout.tsx` owns the single `MainLayout` frame and `page.tsx` renders only access states or the advisory shell.
- 2026-05-19: Codified advisory layout constants and CSS custom properties for nav height, host sidebar width, advisory sidebar width, chat minimum width, document rail width, future drawer bounds, input max height, and the 1032px default-frame desktop gate.
- 2026-05-19: Added focused RTL/Jest/axe coverage for density keyboard interaction, per-user persistence, density mode classes, dark-mode smoke, single frame ownership, layout variables, and loading/denied/desktop-required/authorized accessibility states.
- 2026-05-19: Added desktop Playwright smoke coverage for Chromium, Firefox, and WebKit projects. Initial execution was blocked before page load because required Playwright browser binaries were missing; the exact blocker was recorded in the compatibility evidence artifact.
- 2026-05-19: Follow-up verification updated: `npm run build` now passes after removing the `next/font/google` network dependency, regenerating pnpm junctions from canonical `D:\Csaas\frontend` to eliminate duplicate React instances, and adding the Windows standalone symlink fallback. TypeScript (`npx tsc --noEmit`), focused ESLint, full Jest, and frontend build are now green; Playwright real-browser smoke remains blocked by missing browser binaries as documented in the compatibility evidence artifact.
- 2026-05-19: Code-review fixes applied for Story 2.3: desktop gate now accounts for the host frame width, density persistence uses stable authenticated identity only, the document drawer disabled affordance remains focusable with `aria-disabled`, route frame dark-mode classes were added, Playwright assertions no longer depend on project display names, dark-mode smoke checks contrast ratio, compatibility evidence now records version-slot policy, and screen-reader semantics evidence is documented. Follow-up verification passed: `npx tsc --noEmit`, focused ESLint, focused Jest (4 suites / 39 tests), full Jest (119 suites passed / 2 skipped; 1270 tests passed / 23 skipped), and `npm run build`.
- 2026-05-19: Test automation expansion added Story 2.3 layout-contract unit coverage for the full desktop constraint set and CSS variable exposure. Verification passed: `npm --workspace frontend run test -- lib/advisory/layout.test.ts --runInBand`, `npx tsc --noEmit`, focused ESLint for `lib/advisory/layout.test.ts` / `lib/advisory/layout.ts`, and focused advisory Jest (4 suites / 33 tests). Playwright CLI live exploration of `http://localhost:3001/advisory` was attempted and closed cleanly, but the running local Next dev server returned `500` with `TypeError: __webpack_modules__[moduleId] is not a function`; real browser smoke was still blocked at that time by the previously documented missing Playwright browser binaries.
- 2026-05-20: Resolved the Playwright browser-binary blocker for Story 2.3. Installed/verified Chromium full and headless shell revision `1217`, Firefox revision `1511`, and WebKit revision `2272`; fixed E2E selector robustness for Radix radio labels and Next route announcer; Story 2.3 desktop engine smoke passed across Chromium/Firefox/WebKit (18/18). Added a Story-specific branded config and ran installed Chrome stable `148.0.7778.168` plus Edge stable `146.0.3856.97` smoke (12/12). Compatibility evidence and trace gate were updated to PASS; Safari branded/version-slot coverage remains macOS browser-lab scope with local WebKit proxy evidence.

### File List

- `_bmad-output/implementation-artifacts/2-3-theme-density-and-compatibility-baseline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/compatibility-evidence-story-2-3-theme-density-and-compatibility-baseline.md`
- `_bmad-output/test-artifacts/automation-summary-story-2-3-theme-density-and-compatibility-baseline.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-3-theme-density-and-compatibility-baseline.md`
- `_bmad-output/test-artifacts/traceability-story-2-3-theme-density-and-compatibility-baseline-phase1.json`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/advisory/layout.tsx`
- `frontend/app/advisory/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/components/layout/Header.tsx`
- `frontend/components/layout/MainLayout.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/__tests__/Header.test.tsx`
- `frontend/e2e/advisory-theme-density-baseline.spec.ts`
- `frontend/lib/advisory/layout.ts`
- `frontend/lib/advisory/layout.test.ts`
- `frontend/lib/advisory/preferences.test.ts`
- `frontend/lib/advisory/preferences.ts`
- `frontend/package.json`
- `frontend/playwright.config.ts`
- `frontend/playwright.story-2-3-branded.config.ts`
- `frontend/pnpm-lock.yaml`
- `frontend/scripts/windows-symlink-fallback.js`

## Change Log

- 2026-05-19: Story context created and marked ready-for-dev.
- 2026-05-19: Implemented Story 2.3 theme, density, layout-constraint, compatibility, and accessibility baseline; status moved to review.
- 2026-05-20: Cleared browser-binary compatibility blocker, stabilized Story 2.3 E2E selectors, added branded Chrome/Edge smoke config, updated compatibility/trace artifacts, and moved gate evidence to PASS.
