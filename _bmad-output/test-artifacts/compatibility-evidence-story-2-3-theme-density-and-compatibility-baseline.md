# Compatibility Evidence - Story 2.3 Theme, Density, and Compatibility Baseline

Date: 2026-05-20

## Scope

Story 2.3 is a frontend-only advisory shell baseline. It covers theme-token compatibility, reading density preference behavior, desktop layout constraints, accessibility, and browser support evidence. It does not cover workflow launch, provider calls, streaming, report drawer expansion, export, or backend preference persistence.

## Browser Support Matrix

| Browser family | Current + previous two versions in scope | Automation proxy | Story 2.3 evidence | Notes |
| --- | --- | --- | --- | --- |
| Chrome | Yes: stable, stable-1, stable-2 release slots | Playwright `chromium` desktop project plus local branded `chrome` channel | `chromium` engine smoke passed 18/18; branded Chrome stable smoke passed 6/6 | Local branded stable: Chrome `148.0.7778.168`. Stable-1/stable-2 remain version-slot scope items for browser-lab execution because those older Chrome channels are not installed side-by-side on this Windows host. |
| Edge | Yes: stable, stable-1, stable-2 release slots | Playwright `chromium` desktop project plus local branded `msedge` channel | `chromium` engine smoke passed 18/18; branded Edge stable smoke passed 6/6 | Local branded stable: Edge `146.0.3856.97`. Stable-1/stable-2 remain version-slot scope items for browser-lab execution because those older Edge channels are not installed side-by-side on this Windows host. |
| Firefox | Yes: stable, stable-1, stable-2 release slots | Playwright `firefox` desktop project | Firefox engine smoke passed 18/18 | Playwright Firefox `148.0.2` revision `1511` is the local automation proxy for Firefox desktop. Stable-1/stable-2 remain browser-lab version slots. |
| Safari | Yes: stable, stable-1, stable-2 release slots | Playwright `webkit` desktop project | WebKit smoke passed 18/18 | WebKit `26.4` revision `2272` is the practical desktop Safari automation proxy on Windows. Branded Safari current/stable-1/stable-2 execution requires macOS browser-lab coverage and is not locally executable on this host. |

Version-slot policy for AC3: Story 2.3 treats "current and previous two versions" as the vendor stable release slot plus the two immediately preceding stable release slots at the time the compatibility run is performed. Local automation covers the browser engines through Playwright projects; branded browser/version execution must record the exact installed browser versions in this matrix when those channels are available.

## Automated Evidence Completed

- Focused Jest/RTL + axe: `npm run test -- app/advisory/__tests__/page.test.tsx lib/advisory/preferences.test.ts components/layout/__tests__/MainLayout.test.tsx components/layout/__tests__/Header.test.tsx --runInBand`
  - Result: passed, 4 suites / 39 tests.
  - Coverage: single real route frame, skip link/main ownership, loading/denied/desktop-required/authorized axe states, `.dark` token smoke for advisory content and the route frame, density control keyboard interaction, stable per-user preference isolation, density-specific reading surface classes for all three modes, focusable `aria-disabled` document drawer affordance, and layout CSS variables.
- TypeScript: `npx tsc --noEmit`
  - Result: passed after adding typed advisory CSS custom-property style support.
- Focused ESLint:
  - Command: `npx eslint app/admin/failure-modes/page.test.tsx app/advisory/page.tsx app/advisory/layout.tsx app/advisory/__tests__/page.test.tsx components/advisory/AdvisoryWorkspaceShell.tsx components/layout/Header.tsx components/layout/__tests__/Header.test.tsx components/layout/MainLayout.tsx components/layout/Sidebar.tsx lib/advisory/layout.ts lib/advisory/preferences.ts lib/advisory/preferences.test.ts e2e/advisory-theme-density-baseline.spec.ts playwright.config.ts`
  - Result: passed after removing an unused `useState` import from `Header.tsx`.
- Full Jest regression:
  - Command: `npm run test -- --runInBand`
  - Result after code-review fixes: passed, 119 suites passed / 2 skipped; 1270 tests passed / 23 skipped; 1 snapshot passed.
- Frontend build:
  - Command: `npm run build`
  - Sandbox result: failed before compile because Google Fonts requests were refused by the sandbox proxy (`connect ECONNREFUSED 127.0.0.1:9`).
  - Non-sandbox rerun result: Google Fonts fetched and static page generation completed, then build failed outside Story 2.3 runtime code during production prerender for `/_error` paths with `TypeError: Cannot read properties of null (reading 'useRef')`.
  - Build also emitted repeated Windows path-case module duplication warnings comparing `D:\Csaas\...` with `D:\csaas\...`.
  - Follow-up fix on 2026-05-19: `pnpm install --no-frozen-lockfile` regenerated `frontend/node_modules` from the canonical `D:\Csaas\frontend` path, correcting pnpm peer junction targets such as `react-dom -> react` from `D:\csaas\...` to `D:\Csaas\...`.
  - Root cause: production `/_error` prerender loaded two React module instances because Windows treated the mixed-case junction targets as distinct cache paths; ReactDOM set the dispatcher on one instance while Next pages runtime called hooks on the other.
  - Additional Windows build fix: `frontend/scripts/windows-symlink-fallback.js` is preloaded by `npm run build`; when Next standalone output cannot create symlinks under normal Windows permissions (`EPERM`/`EACCES`), it copies the traced package target instead.
  - Additional network stability fix: root layout no longer imports `next/font/google`; `--font-inter` and `--font-plus-jakarta` are defined in CSS with local/system font fallbacks, so clean builds no longer depend on Google Fonts availability.
  - Final result after code-review fixes: `npm run build` passed; compile, page data collection, 58 static pages, build traces, and standalone `server.js` generation completed.
- Story 2.3 real browser engine smoke:
  - Command: `npx playwright test e2e/advisory-theme-density-baseline.spec.ts --project=chromium --project=firefox --project=webkit`
  - Result on 2026-05-20: passed, 18/18 tests, 0 skipped, 0 flaky, duration 27.5s.
  - Browser revisions installed and verified: Chromium headless shell `1217`, Chromium full `1217`, Firefox `1511`, WebKit `2272`.
- Story 2.3 branded current-channel smoke:
  - Config: `frontend/playwright.story-2-3-branded.config.ts`
  - Command: `npx playwright test e2e/advisory-theme-density-baseline.spec.ts --config playwright.story-2-3-branded.config.ts --project=chrome-stable --project=edge-stable`
  - Result on 2026-05-20: passed, 12/12 tests, 0 skipped, 0 flaky, duration 45.3s.
  - Local branded versions: Chrome `148.0.7778.168`, Edge `146.0.3856.97`.

## Real Browser Smoke

- Earlier blocker: Playwright browser execution originally failed because the current `@playwright/test@1.59.0` required browser revisions that were absent from `%LOCALAPPDATA%\ms-playwright`.
- Resolution:
  - Stale interrupted install processes and `__dirlock` were removed.
  - Firefox `1511`, WebKit `2272`, Chromium full `1217`, and Chromium headless shell `1217` are installed.
  - `npx playwright install --dry-run chromium firefox webkit` now maps to installed locations.
  - The expected executables exist:
    - `chromium_headless_shell-1217\chrome-headless-shell-win64\chrome-headless-shell.exe`
    - `chromium-1217\chrome-win64\chrome.exe`
    - `firefox-1511\firefox\firefox.exe`
    - `webkit-2272\Playwright.exe`
- Final engine smoke result: 18/18 passed across `chromium`, `firefox`, and `webkit`.
- Final branded current-channel result: 12/12 passed across `chrome-stable` and `edge-stable`.

## Accessibility And Contrast Evidence

Automated `jest-axe` passed for:

- advisory access loading state
- authorization denied state
- desktop-required fallback
- authorized shell
- authorized shell under a `.dark` root class

Computed token contrast spot checks:

| Token pair | Contrast ratio | WCAG 2.1 AA text threshold |
| --- | ---: | --- |
| Light foreground on panel | 11.57:1 | Pass |
| Light muted foreground on panel | 4.70:1 | Pass |
| Light success foreground on success background | 4.99:1 | Pass |
| Dark foreground on panel | 17.08:1 | Pass |
| Dark muted foreground on panel | 8.61:1 | Pass |
| Dark success foreground on success background | 10.51:1 | Pass |

## Environment Notes

- Existing port `3001` now returns `200 OK` for `/advisory` and was used for the final Story 2.3 smoke runs.
- `frontend/playwright.config.ts` supports `PLAYWRIGHT_BASE_URL` while preserving the default `http://localhost:3001`, so future smoke runs can target an isolated validation server without changing shared local processes.
- Browser execution is no longer blocked by missing Playwright binaries.
- Windows cannot execute branded Safari. Safari current/stable-1/stable-2 branded evidence remains a macOS browser-lab responsibility, with local Story 2.3 acceptance covered by Playwright WebKit proxy smoke.

## Screen Reader Semantics Evidence

The local environment can now execute Playwright real browser smoke tests, but no NVDA/VoiceOver/Narrator transcript was produced in this pass. Story 2.3 includes the following screen-reader proxy checks in focused RTL/Jest coverage and keeps them as acceptance evidence until a real browser/SR pass is available:

| Screen-reader surface | Expected announcement/semantics | Evidence |
| --- | --- | --- |
| Main route frame | One `banner`, one `主导航` navigation, and one `main#main-content` landmark | Focused advisory route test asserts single frame ownership. |
| Loading state | Polite status named `ThinkTank 访问验证状态` | Focused advisory route test asserts `role=status`, `aria-live=polite`, and visible loading text. |
| Desktop-required state | Focus moves to the named status so keyboard and SR users hear the desktop constraint | Focused advisory route test asserts focus on `ThinkTank 桌面端要求` after viewport downgrade. |
| Density control | Radiogroup named `阅读密度` exposes `紧凑`, `默认`, `舒适` radio options and checked state | Focused advisory route test asserts keyboard selection and `aria-checked` state. |
| Workspace live summary | Polite status named `ThinkTank 工作台状态` announces enabled state, empty session, drawer state, and selected density | Focused advisory route test asserts the live-region text updates after density changes. |
| Document drawer affordance | Focusable button named `展开咨询文档抽屉` exposes `aria-disabled=true` and description `文档抽屉将在报告草稿接入后开放` | Focused advisory route test asserts accessible description and disabled semantics without removing the control from the tab order. |
