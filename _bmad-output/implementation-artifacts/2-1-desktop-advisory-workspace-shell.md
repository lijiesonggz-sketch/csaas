# Story 2.1: Desktop Advisory Workspace Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want a focused desktop advisory workspace,
so that I can think through complex work without being distracted by marketing pages or unrelated UI.

## Acceptance Criteria

1. Given an authorized user opens ThinkTank on a desktop-width viewport, when the workspace loads, then it upgrades the authorized ThinkTank module route from Story 1.1 into the full advisory workspace, shows the CSAAS top navigation, left advisory sidebar, central conversation area, and collapsed right document drawer, and uses existing shadcn/ui and CSAAS visual tokens rather than a separate design language.
2. Given the viewport is narrower than 1024px, when the user opens ThinkTank, then the UI displays a clear desktop-required or desktop-recommended message and does not attempt a broken mobile layout.
3. Given the MVP interface is complete, when users complete a workflow, then completion feedback remains professional and concise and the UI avoids gamification, heavy celebration, or decorative AI-product visuals.

## Tasks / Subtasks

- [x] Replace the authorized `/advisory` placeholder with a real desktop workspace shell (AC: 1)
  - [x] Keep the existing Story 1.1 access check through `fetchThinkTankAccess()` and preserve loading, denied, and disabled tenant behavior.
  - [x] Render the shell inside the existing `MainLayout` so CSAAS top navigation and global left navigation remain present.
  - [x] Add an advisory-owned shell component under `frontend/components/advisory/` rather than expanding route-only JSX.
  - [x] Include a left advisory sidebar, central conversation workspace, and collapsed right document drawer using shadcn/Radix/Tailwind patterns already present in the frontend.
  - [x] Use CSAAS tokens already used in the app: `#FEFDFB`, `#1E3A5F`, `#059669`, `#E2E8F0`, muted slate text, `rounded-sm`, restrained borders, and no marketing hero treatment.

- [x] Add desktop-width gating for the MVP shell (AC: 2)
  - [x] Detect viewport width on the client and treat widths below `1024px` as unsupported for the MVP advisory shell.
  - [x] Show a professional desktop-required/recommended state below `1024px`.
  - [x] Do not render a squeezed three-column shell on narrow viewports.
  - [x] Keep the access denied state independent from the desktop-gate state.

- [x] Seed professional empty and completion-ready shell states without implementing workflow runtime (AC: 1, 3)
  - [x] Show an empty conversation state that makes clear no workflow has started yet, without adding workflow selection or launch behavior from Story 2.5.
  - [x] Show collapsed document drawer affordance and report placeholder only; do not implement live report generation from Story 2.8.
  - [x] Include concise professional status copy and remove the existing "workspace not open" disabled button.
  - [x] Avoid gamification, confetti, celebratory badges, decorative AI visuals, large hero panels, and one-off design language.

- [x] Add focused automated coverage for shell behavior (AC: 1-3)
  - [x] Update `frontend/app/advisory/__tests__/page.test.tsx` or add colocated advisory component tests for authorized desktop shell rendering.
  - [x] Test that widths below `1024px` show the desktop-required/recommended message and do not show the central conversation shell.
  - [x] Test access denied and disabled tenant states still render the friendly alert and do not leak workspace UI.
  - [x] Test shell landmarks/labels at a smoke level: complementary left advisory sidebar, main conversation area, and collapsed document drawer button/region naming.

- [x] Verify and document completion (AC: 1-3)
  - [x] Run focused frontend tests for advisory page/components.
  - [x] Run `cd frontend && npx tsc --noEmit`.
  - [x] Run frontend lint/build or document pre-existing unrelated failures exactly if the full command cannot pass.
  - [x] Update this story's Dev Agent Record, File List, Change Log, and Status according to the dev workflow.

## Dev Notes

### Source Requirements

- Epic 2 turns the Story 1.1 authorized ThinkTank route into the unified advisory workspace. This story owns only the desktop shell and route upgrade, not workflow runtime, streaming, report generation, prompt caching, or Party Mode. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 / Story 2.1]
- UX direction requires ThinkTank to be a desktop-first advisory workspace built with shadcn/ui + Tailwind while inheriting CSAAS visual language, not a marketing or landing page. [Source: `_bmad-output/planning-artifacts/epics.md` - UX-DR1]
- UX specification says MVP is a desktop web app with wide-screen layout, left conversation plus right document area, and no mobile adaptation for MVP. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Platform Strategy]
- The core experience is structured advisory conversation where every step creates visible document value, but actual workflow selection, step prompts, streaming, and report generation are owned by later Epic 2 stories. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Core User Experience]

### Scope Boundaries

Do not implement these future capabilities in this story:

| Capability | Owning story |
| --- | --- |
| Accessibility baseline beyond shell smoke checks | Story 2.2 |
| Theme/density persistence and browser compatibility matrix | Story 2.3 |
| BMAD runtime file loading and brand mapping | Story 2.4 |
| Workflow catalog and launch | Story 2.5 |
| Guided conversation decisions and message persistence | Story 2.6 |
| SSE streaming and Markdown message rendering | Story 2.7 |
| Live document draft and report sections | Story 2.8 |
| Export | Story 2.9 |
| Prompt caching | Story 2.10 |

### Previous Story Intelligence

- Story 1.1 created the ThinkTank module entry and frontend route placeholder. Reuse its access client and tests instead of replacing the authorization flow.
- Story 1.2 added tenant module enablement and role permissions. The shell must not bypass tenant access checks or hardcode role behavior.
- Story 1.3 established tenant isolation patterns. This story is frontend-only unless implementation discovers a narrow need; do not add advisory runtime persistence tables.
- Story 1.4 established ThinkTank audit/telemetry event contracts. This story does not need new events because no workflow is started.
- Story 1.5 added the governed provider gateway. Do not call it from this shell story; provider calls start in later workflow/conversation stories.

### Existing Patterns To Reuse

- Route currently to upgrade: `frontend/app/advisory/page.tsx`.
- Existing route tests: `frontend/app/advisory/__tests__/page.test.tsx`.
- Access client: `frontend/lib/advisory/access.ts`.
- Global app frame: `frontend/components/layout/MainLayout.tsx`, `Header.tsx`, `Sidebar.tsx`.
- Existing shadcn components: `frontend/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`, `tooltip.tsx`.
- New custom advisory components must live in `frontend/components/advisory/`, matching the architecture addendum's `src/components/advisory/` intent for this repo's no-`src` frontend layout.

### Frontend Implementation Guidance

- Keep `AdvisoryPage` as the access-gating container and move the authorized shell into a named advisory component such as `AdvisoryWorkspaceShell`.
- `AdvisoryWorkspaceShell` should use semantic sections:
  - left advisory sidebar: `<aside aria-label="咨询工作流导航">`
  - conversation workspace: `<section aria-label="咨询对话工作区">` or main child within the page content
  - document drawer: `<aside aria-label="咨询文档抽屉">` with collapsed state
- The page is already inside `MainLayout` from app-level usage patterns on other authenticated pages; if `/advisory` currently lacks `MainLayout`, wrap it so CSAAS top navigation and global left navigation are visible.
- Desktop shell target is `min-width: 1024px`. A hook based on `window.matchMedia('(min-width: 1024px)')` is acceptable; tests should control `matchMedia`.
- Use fixed, stable layout dimensions for shell columns to prevent shifting: advisory sidebar around 240-280px, collapsed drawer around 56-72px, central conversation `minmax(0, 1fr)`.
- The shell may include placeholder workflow/session labels as non-interactive status content, but no workflow launch, registry, session creation, provider calls, report generation, export, or persistence.
- Keep copy short and work-focused. Avoid visible instructions about keyboard shortcuts or feature explanations; labels should name current UI states.

### Accessibility and Quality Notes

- Story 2.2 owns full WCAG baseline. Story 2.1 still needs smoke-level semantic labels because it introduces the shell regions.
- Radix primitives handle many focus, ARIA, and keyboard details when used correctly; do not replace native buttons with clickable divs.
- Buttons should use lucide icons where an icon is meaningful, especially for collapsed drawer affordance.
- Keep text inside compact controls short enough to fit at 1024px without overlap.

### Latest Technical Notes

- Next.js App Router defines route UI through `app/**/page.tsx`; shared layouts preserve state during navigation. This story should keep `/advisory/page.tsx` as route composition and move reusable shell UI to `components/advisory/`. [Source: https://nextjs.org/docs/app/building-your-application/routing/defining-routes]
- Tailwind responsive variants are mobile-first; use `lg` and explicit `min-width: 1024px` behavior for the desktop shell gate. [Source: https://tailwindcss.com/docs/responsive-design]
- Radix primitives are designed around WAI-ARIA patterns, focus management, and keyboard navigation. Prefer existing shadcn/Radix wrappers for interactive controls. [Source: https://www.radix-ui.com/primitives/docs/overview/accessibility]
- shadcn/ui provides the component vocabulary already used by this frontend; do not add a parallel component library. [Source: https://ui.shadcn.com/docs/components; `frontend/package.json`]

### Testing Requirements

- Follow TDD: create/update failing tests before production code changes.
- Focused tests:
  - `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand`
- Static validation:
  - `cd frontend && npx tsc --noEmit`
- Broader regression where feasible:
  - `cd frontend && npm run test -- --runInBand`
  - `cd frontend && npm run build`
- If broader regression fails because of unrelated existing failures, document the exact command and failure summary in Dev Agent Record.

### Project Structure Notes

- The architecture addendum says custom advisory components must use `src/components/advisory/`; this repository's frontend places components at `frontend/components/`, so the equivalent local path is `frontend/components/advisory/`.
- Keep route tests colocated under `frontend/app/advisory/__tests__/`.
- Do not add backend migrations, advisory runtime tables, or provider calls in this story.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 / Story 2.1 requirements and acceptance criteria.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - desktop platform strategy and core advisory UX.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - frontend quality gates and advisory boundaries.
- `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md` - custom advisory component location and Epic 2 quality gates.
- `_bmad-output/implementation-artifacts/1-1-register-thinktank-module-entry.md` - existing ThinkTank route/access context.
- `frontend/app/advisory/page.tsx` - current placeholder route to upgrade.
- `frontend/app/advisory/__tests__/page.test.tsx` - current route behavior tests.
- `frontend/lib/advisory/access.ts` - access client to preserve.
- `frontend/components/layout/MainLayout.tsx` - CSAAS top navigation and left global sidebar shell.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-19: Story context created from Epic 2 Story 2.1, ThinkTank UX spec, architecture addendum, current `/advisory` placeholder, Story 1.1-1.5 implementation learnings, and official Next.js/Tailwind/Radix/shadcn references.
- 2026-05-19: ATDD RED artifacts generated for desktop workspace shell, desktop viewport gate, and preserved access-denied behavior.
- 2026-05-19: Dev implementation started; sprint status moved to in-progress.
- 2026-05-19: RED focused test failed as expected before implementation because `/advisory` still lacked `MainLayout`, shell landmarks, and the 1024px desktop gate.
- 2026-05-19: GREEN focused test passed after implementing the advisory workspace shell and semantic landmark cleanup.
- 2026-05-19: Validation passed: `npm run test -- app/advisory/__tests__/page.test.tsx --runInBand`, `npx tsc --noEmit`, `npm run test -- --runInBand`, and `npm run build`.
- 2026-05-19: Code review found one patch-level test coverage gap for the right document drawer landmark; added the missing smoke assertion and re-ran focused test plus TypeScript.
- 2026-05-19: Traceability gate generated with PASS decision and 100% P0/P1/overall coverage for Story 2.1.
- 2026-05-19: Final validation passed: full frontend Jest, Next build, and serial `npx tsc --noEmit`. A prior parallel `tsc` run failed because `npm run build` cleaned `.next` while TypeScript was reading generated `.next/types`; the serial rerun passed.

### Implementation Plan

- Add RED tests for authorized desktop shell, narrow viewport gate, and preserved access-denied behavior.
- Implement an advisory-owned `AdvisoryWorkspaceShell` and wrap authorized `/advisory` content with `MainLayout`.
- Verify focused tests and TypeScript; document any unrelated broader regression failures.

### Completion Notes List

- Replaced the authorized ThinkTank placeholder with `AdvisoryWorkspaceShell` inside `MainLayout`, preserving loading, denied, and disabled tenant states through `fetchThinkTankAccess()`.
- Added a desktop-only shell with left advisory workflow navigation, central conversation workspace, and collapsed right document drawer using existing shadcn/ui, lucide icons, Tailwind, and CSAAS color/radius/border tokens.
- Added a client `matchMedia('(min-width: 1024px)')` gate that renders a professional desktop-required state below 1024px and prevents the three-column shell from squeezing on unsupported widths.
- Updated advisory page tests to cover authorized desktop shell rendering, narrow viewport gating, preserved access-denied and disabled tenant behavior, and smoke-level shell landmark/label expectations.
- Removed the previous "workspace not open" placeholder copy and avoided workflow runtime, provider calls, report generation, launch behavior, celebratory UI, or new backend persistence.
- Code review patch resolved: right document drawer complementary landmark is now explicitly covered by the route smoke test.

### File List

- `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md`
- `_bmad-output/test-artifacts/atdd-checklist-2-1.md`
- `_bmad-output/test-artifacts/atdd-story-2-1-advisory-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-2-1-frontend-red.spec.tsx`
- `_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-2-1-2026-05-19T08-10-38+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-2-1-2026-05-19T08-10-38+08-00.json`
- `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-1-2026-05-19T08-10-38+08-00.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `frontend/app/advisory/__tests__/page.test.tsx`
- `frontend/app/advisory/page.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `_bmad-output/test-artifacts/code-review-story-2-1.md`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-2-1-2026-05-19T08-26-15+08-00.json`
- `_bmad-output/test-artifacts/traceability-report-story-2-1.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-1.yaml`

## Change Log

- 2026-05-19: Story context created for desktop advisory workspace shell.
- 2026-05-19: Generated ATDD RED acceptance artifacts for desktop advisory shell coverage.
- 2026-05-19: Started implementation.
- 2026-05-19: Implemented desktop advisory workspace shell, 1024px gate, preserved access states, focused tests, and frontend validation.
- 2026-05-19: Completed code review follow-up by adding drawer landmark smoke coverage.
- 2026-05-19: Completed traceability gate, final validation, and marked Story 2.1 done.
