# Code Review - Story 2.2 Advisory UI State and Accessibility Baseline

**Date:** 2026-05-19  
**Workflow:** bmad-code-review  
**Review mode:** full, using Story 2.2 spec and Epic 2 accessibility context  
**Layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor  

## Result

Initial review raised blocking patch findings. All HIGH/MEDIUM findings and the relevant LOW accessibility/dependency findings were fixed in the follow-up implementation pass. Final rerun across Blind Hunter, Edge Case Hunter, and Acceptance Auditor found no HIGH/MEDIUM blockers.

## Findings And Resolution

| Severity | Source | Finding | Category | Resolution |
| --- | --- | --- | --- | --- |
| HIGH | edge | Root `package-lock.json` did not include the new Jest accessibility dependency. | patch | Updated root `package-lock.json` and verified `npm ci --workspace frontend --dry-run --ignore-scripts` exits successfully. |
| HIGH | auditor | Contrast evidence claimed no exception while `#94A3B8` text and `#10B981` focus outline failed WCAG thresholds. | patch | Replaced weak text with `#64748B`, changed skip-link focus outline to `#047857`, and recorded contrast ratios in accessibility evidence. |
| MEDIUM | blind + edge + auditor | Skip link test only verified focusability and `href`; activation did not prove navigation/focus transfer to `main`. | patch | Added `tabIndex={-1}` to `main#main-content`, focused it on skip-link activation, and added keyboard activation assertions. |
| MEDIUM | auditor | Desktop gate focus-loss smoke was not implemented. | patch | Desktop-required status now receives programmatic focus on mount; test verifies focus after viewport gate transition. |
| MEDIUM | edge | `MainLayout` loading status had spinner-only content. | patch | Added `sr-only` loading text and role/text assertion. |
| MEDIUM | blind + edge | Authorized shell mounted several static polite live regions, creating screen-reader announcement noise. | patch | Replaced multiple static live regions with one consolidated `ThinkTank 工作台状态` status; visible static blocks remain normal text. |
| LOW | blind | Empty document drawer state was screen-reader-only and disabled reason was not visually discoverable. | patch | Added visible `暂无文档` and `报告草稿接入后开放` drawer text and updated drawer button title/description. |
| LOW | blind | `@types/jest-axe` introduced old `axe-core@3` alongside `jest-axe@10`. | patch | Removed `@types/jest-axe`, kept `jest-axe@10`, and added a local `types/jest-axe.d.ts` declaration. |
| LOW | edge | Advisory viewport test helper did not model `max-width` queries. | patch | Updated helper to parse min/max width media queries and emit listener updates for all registered queries. |
| MEDIUM | auditor | Dedicated NVDA/VoiceOver transcript was not captured. | patch | Recorded a CLI-environment exception with owner `leo` and target story `2-3-theme-density-and-compatibility-baseline`; automated role/name/live-region smoke remains covered. |

## Verification After Fixes

- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand` - PASS, 19/19.
- `cd frontend && npx tsc --noEmit` - PASS.
- `cd frontend && npx eslint app/advisory/__tests__/page.test.tsx app/advisory/page.tsx components/advisory/AdvisoryWorkspaceShell.tsx components/layout/MainLayout.tsx components/layout/__tests__/MainLayout.test.tsx types/jest-axe.d.ts` - PASS.
- `npm ci --workspace frontend --dry-run --ignore-scripts` - PASS.
- `cd frontend && npm run test -- --runInBand` - PASS, 118 suites / 1261 tests.
- `git diff --check` - PASS.

## Rerun Summary

- Rerun 1 surfaced three follow-up concerns: double lockfile consistency, untracked local `jest-axe` type declaration visibility, and incomplete visible drawer reason.
- Double lockfile consistency was accepted as handled because this repository uses a root npm workspace lock and a frontend pnpm lock; both now include `jest-axe@10`.
- `frontend/types/jest-axe.d.ts` was added with intent-to-add and is included in the final diff and story file list.
- The drawer reason was strengthened to visible copy: `报告草稿接入后开放`.
- Final pass found no HIGH/MEDIUM blockers.

## Triage Summary

0 intent_gap, 0 bad_spec, 10 patch, 0 defer findings. 0 findings rejected as noise.
