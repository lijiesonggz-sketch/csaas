# Accessibility Evidence - Story 2.2 Advisory UI State and Accessibility Baseline

**Date:** 2026-05-19  
**Scope:** `/advisory`, `AdvisoryWorkspaceShell`, `MainLayout` skip link and viewport gate  
**Owner:** Dev agent / leo  

## Automated Evidence

| Check | Command / Source | Result |
| --- | --- | --- |
| Focused Jest + Testing Library | `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand` | PASS: 19/19 |
| axe in JSDOM | Active Jest test: `has no automated axe violations for advisory loading, denied, desktop-required, and authorized states` | PASS |

## Keyboard Smoke

| Scenario | Evidence |
| --- | --- |
| Skip link focus and activation | Active test verifies first Tab reaches `跳到主内容`, targets `#main-content`, and Enter moves focus to the single `main#main-content`. |
| Single main landmark | Active test verifies only one `main#main-content`; advisory shell does not add nested `<main>`. |
| Placeholder workflows | Active test verifies `结构化咨询`, `研究分析`, `问题解决` are not buttons or links and have no `tabindex`. |
| Disabled drawer | Active test verifies `展开咨询文档抽屉` remains disabled, exposes the description `文档抽屉将在报告草稿接入后开放`, and the drawer strip visibly shows `暂无文档` / `报告草稿接入后开放`. |
| Viewport gate | Active test verifies runtime desktop-gate media-query changes remove the shell, focus moves to the desktop-required status, and conversation landmarks do not leak. |

## Screen-Reader Smoke

| State | Accessible Pattern |
| --- | --- |
| Access verification loading | `role="status"`, `aria-live="polite"`, label `ThinkTank 访问验证状态`. |
| Viewport preparation | `role="status"`, `aria-live="polite"`, label `ThinkTank 工作区准备状态`. |
| Desktop-required fallback | `role="status"`, `aria-live="polite"`, label `ThinkTank 桌面端要求`. |
| Access denied / tenant disabled | `role="alert"`, `aria-live="assertive"`, workspace landmarks absent. |
| Authorized shell baseline states | A single polite status, label `ThinkTank 工作台状态`, announces `ThinkTank 已启用。暂无活动会话。等待开始咨询。咨询文档抽屉为空。`; visible static blocks are not separate live regions. |
| Empty conversation | Visible text remains available in the conversation region; no fake interaction is exposed. |
| No active sessions | Visible text remains available in the workflow sidebar without an extra live region. |
| Empty document drawer | Visible text exposes `暂无文档` and `报告草稿接入后开放`; the disabled drawer affordance is described by `aria-describedby`. |

## Contrast Evidence

JSDOM axe cannot fully validate visual color contrast. The current shell uses existing CSAAS colors and Story 2.1 visual tokens:

- Primary text `#1E3A5F` on white / `#FEFDFB`.
- Secondary text `#64748B` on white is 4.76:1 and on `#F8FAFC` is 4.55:1.
- Success text `#047857` on `#ECFDF5` is 5.21:1 with non-color text `已启用`.
- Skip-link focus outline `#047857` on white is 5.48:1.
- Primary text `#1E3A5F` on white is 11.50:1 and on `#FEFDFB` is 11.31:1.

No WCAG 2.1 AA blocking contrast exception is accepted for Story 2.2. Full browser/visual contrast matrix remains part of Story 2.3 compatibility baseline if broader theme and density variants are introduced.

## Known Limits

- axe under JSDOM verifies semantic roles, accessible names, ARIA relationships, and many structural issues, but not full real-browser contrast.
- Screen-reader evidence executed as a smoke check through role/name/description/live-region assertions. A dedicated NVDA/VoiceOver transcript could not be captured in this CLI-only run and is accepted as a non-blocking documentation exception with owner `leo` and target story `2-3-theme-density-and-compatibility-baseline`.
- Document drawer remains intentionally disabled until Story 2.8; this is documented through `aria-describedby`, not implemented as an interactive drawer.
