# Story 11.2 Traceability Matrix

Date: 2026-03-31
Story: 11-2-radar-nav-push-history-entry
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- `/radar` 首页提供推送历史入口
- 入口显式展示未读数量或 0

Coverage:
- `frontend/app/radar/page.tsx`
  - history action button + badge
- `frontend/lib/hooks/useRadarUnreadCount.ts`
  - shared unread count source
- `frontend/app/radar/page.test.tsx`
  - history entry render / navigation

Result:
- PASS

### AC2

Requirement:
- 全局导航存在推送历史入口
- 与 Radar 首页共享同一 unread 数据源和刷新策略

Coverage:
- `frontend/components/layout/Header.tsx`
  - global history icon entry + badge
- `frontend/lib/hooks/useRadarUnreadCount.ts`
  - polling + focus + event refresh
- `frontend/components/layout/__tests__/Header.test.tsx`
  - global entry render / navigation

Result:
- PASS

### AC3

Requirement:
- 历史页调用 `GET /api/radar/pushes/history`
- 列表和筛选逻辑继续可用

Coverage:
- `frontend/lib/api/radar.ts`
  - `getPushHistory` route switched to `/api/radar/pushes/history`
- `frontend/lib/api/radar.test.ts`
  - dedicated history endpoint assertion
- `frontend/app/radar/history/page.tsx`
  - unchanged page contract consumption through `getPushHistory`

Result:
- PASS

### AC4

Requirement:
- 已读后历史页本地状态更新
- 首页与全局导航 badge 在统一刷新机制下同步

Coverage:
- `frontend/lib/api/radar.ts`
  - read actions dispatch `radar:unread-count-refresh`
- `frontend/lib/hooks/useRadarUnreadCount.ts`
  - listens for refresh event and refetches unread count
- `frontend/lib/api/radar.test.ts`
  - refresh event assertion
- `frontend/app/radar/history/page.tsx`
  - local read-state update preserved

Result:
- PASS

## Validation Summary

- Frontend targeted tests: PASS
- Frontend build: PASS
- Backend tests/build: reused from Story 11.1 backend contract
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - `frontend/app/radar/history/page.test.tsx` 仍是旧 contract 的遗留测试，未纳入本次定向回归
