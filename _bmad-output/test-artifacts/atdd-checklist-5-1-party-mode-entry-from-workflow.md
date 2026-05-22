---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-22T01:02:00+08:00'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md
  - _bmad-output/planning-artifacts/epics.md
  - frontend/playwright.config.ts
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/fixture-architecture.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist - Epic 5, Story 1: Party Mode Entry from Workflow

**Date:** 2026-05-22
**Author:** leo
**Primary Test Level:** Backend service integration + frontend component/page integration

## Story Summary

用户在活跃 ThinkTank workflow step 中通过现有决策按钮启动 Party Mode。系统必须根据 server-owned feature flag / tenant allowlist 决定是否显示可用入口，并在启动时保存可恢复的 Party Mode context 指针。

## Acceptance Criteria Coverage

1. **AC1 - workflow 内入口，不做独立 MVP 页面**
   - Backend: `5.1-BE-001` 验证 `party-mode` decision option 启用。
   - Frontend: `5.1-FE-001` 验证 in-message button 启动；`5.1-FE-002` 验证 workflow navigation 没有 standalone Party Mode 入口。
2. **AC2 - feature flag / tenant config 禁用时不可用，单顾问流程可用**
   - Backend: `5.1-BE-002` 验证 Party Mode disabled 但 continue/deepen/revise 仍 enabled。
   - Frontend: `5.1-FE-002` 验证 disabled button 和 `P` 快捷键 no-op。
3. **AC3 - 启动时保存 current step、problem、draft、conversation context 并可返回**
   - Backend: `5.1-BE-003` 验证 `decisionAction: "party-mode"` 不走 provider，写入 sanitized session/checkpoint metadata/context pointers。
   - Backend: `5.1-BE-004` 验证跨租户/无效 session 不创建 context。
   - Backend: `5.1-BE-011` 验证 start claim 后续持久化失败会回滚到可重试状态。
   - Backend: `5.1-BE-013` 验证 API DTO 允许 server-owned `return-to-workflow` action。
   - Backend: `5.1-BE-015` / `5.1-BE-016` 验证 start/return finalize 失败时清理本次写入的 user/assistant messages，避免 latest decision 污染重试。
   - Backend/Frontend: `5.1-BE-012` 和 `5.1-FE-001` 验证 `return-to-workflow` 真实返回原工作流。

## Acceptance Tests Created

### Backend Tests

**File:** `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts`

- `[P0][5.1-BE-001][AC1,AC2] exposes Party Mode only when feature flag and tenant allowlist enable it`
- `[P0][5.1-BE-002][AC2] keeps Party Mode unavailable when tenant configuration disables it while single-advisor actions work`
- `[P0][5.1-BE-003][AC3] starts Party Mode from decisionAction and stores sanitized return context without calling provider`
- `[P0][5.1-BE-005][AC1,AC2] rejects forged or disabled Party Mode actions before persisting workflow history`
- `[P0][5.1-BE-007][AC1,AC2] rejects stale Party Mode actions when the latest decision message no longer offers it`
- `[P0][5.1-BE-008][AC3] rejects a concurrent Party Mode retry before writing conversation history`
- `[P0][5.1-BE-011][AC3] rolls back a claimed Party Mode start when later persistence fails`
- `[P0][5.1-BE-015][AC3] removes Party Mode start messages when finalize fails so retry remains possible`
- `[P0][5.1-BE-006][AC3] streams Party Mode start as terminal started/completed events without provider work`
- `[P0][5.1-BE-004][AC3] rejects Party Mode start for cross-tenant or inactive sessions before context creation`
- `[P0][5.1-BE-012][AC3] returns from Party Mode to the original workflow through a server-owned decision action`
- `[P0][5.1-BE-016][AC3] removes Party Mode return messages when finalize fails so return can be retried`

**File:** `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts`

- `[P0][5.1-BE-013][AC3] allows the server-owned Party Mode return action through API validation`
- `[P0][5.1-BE-014][AC1,AC2] rejects unknown decision actions before controller handling`

**File:** `backend/src/modules/advisory/sessions/advisory-session.repository.spec.ts`

- `[P0][5.1-BE-009][AC3] atomically claims Party Mode start only for active unclaimed actor sessions`
- `[P0][5.1-BE-010][AC3] returns null when Party Mode claim loses the concurrency race`

Status: GREEN after Story 5.1 implementation.

### Frontend Tests

**File:** `frontend/app/advisory/__tests__/page.test.tsx`

- `[P0][5.1-FE-001][AC1,AC3] starts Party Mode from an enabled in-message decision option`
- `[P0][5.1-FE-002][AC1,AC2] keeps Party Mode out of standalone workflow navigation and unavailable when disabled`

Status: GREEN after Story 5.1 implementation.

## Implementation Checklist

- [x] Backend evaluates Party Mode availability from `THINKTANK_PARTY_MODE_ENABLED` and tenant allowlist.
- [x] Backend decision options include clear enabled/disabled Party Mode messaging while preserving single-advisor actions.
- [x] Backend handles `decisionAction: "party-mode"` by creating a Party Mode context pointer and assistant entry message without invoking the provider gateway.
- [x] Backend rejects forged, disabled, repeated, or stale Party Mode actions before persisting workflow history.
- [x] Backend uses atomic JSONB metadata merge for Party Mode claim/finalize/rollback without overwriting unrelated session metadata.
- [x] Backend persists sanitized Party Mode context pointers through checkpoint metadata and rolls back failed starts to a retryable state.
- [x] Backend handles `decisionAction: "return-to-workflow"` without provider calls and returns normal workflow controls.
- [x] Backend API validation allows `return-to-workflow` and rejects unknown decision actions before controller/service handling.
- [x] Backend removes Party Mode user/assistant messages from failed start/return attempts so rollback leaves retryable latest decision state.
- [x] Frontend handles enabled Party Mode option through existing streaming message submission with content `启动 Party Mode` and `decisionAction: "party-mode"`.
- [x] Frontend handles `return-to-workflow` through the existing streaming message client while preserving user drafts.
- [x] Frontend leaves disabled Party Mode as no-op and keeps workflow navigation free of standalone Party Mode entry.
- [x] Frontend displays disabled Party Mode messaging, preserves unrelated drafts, and disables stale decision controls.
- [x] Remove `test.skip()` from Story 5.1 ATDD tests during green phase.

## Running Tests

```bash
cd backend && npm test -- advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm test -- advisory-session.repository.spec.ts advisory-session.messages.spec.ts advisory-session.checkpoint.spec.ts submit-advisory-message.dto.spec.ts --runInBand
cd frontend && npm test -- app/advisory/__tests__/page.test.tsx --runInBand
```

## Red-Green-Refactor Workflow

**RED Phase:** complete. Tests were unskipped and failed before implementation.

**GREEN Phase:** complete. Story 5.1 targeted backend and frontend suites pass.

**REFACTOR Phase:** complete for Story 5.1. Party Mode entry logic remains behind existing advisory session/message abstractions; no standalone page or alternate tenant handling was introduced.

**Code Review Follow-up:** complete. HIGH/MEDIUM findings were patched and the targeted Story 5.1 suites remained green, including retryable failed-start rollback and real return-to-workflow behavior.

## Validation Notes

- No production `data-testid` requirements.
- Selectors use role/label/text.
- No browser CLI session was opened, so there are no orphaned browser sessions.
- Temp artifacts are stored under `_bmad-output/test-artifacts`.
- Validation run after implementation:
- `cd backend && npm test -- advisory-session.party-mode-entry.atdd.spec.ts --runInBand`
- `cd backend && npm test -- advisory-session.party-mode-entry.atdd.spec.ts advisory-session.repository.spec.ts advisory-session.messages.spec.ts advisory-session.checkpoint.spec.ts submit-advisory-message.dto.spec.ts --runInBand`
- `cd frontend && npm test -- app/advisory/__tests__/page.test.tsx --runInBand`
- `cd backend && npm test -- advisory-session.messages.spec.ts advisory-session.checkpoint.spec.ts --runInBand`
- `cd backend && npx tsc --noEmit`
- `cd frontend && npx tsc --noEmit`
