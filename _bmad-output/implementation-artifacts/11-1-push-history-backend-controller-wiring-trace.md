# Story 11.1 Traceability Matrix

Date: 2026-03-31
Story: 11-1-push-history-backend-controller-wiring
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- 推送历史专用接口通过 service 暴露统一列表 contract
- controller 不再为历史页单独拼仓库查询逻辑

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `GET /api/radar/pushes/history`
- `backend/src/modules/radar/services/radar-push.service.ts`
  - `getPushHistory`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - history feed delegation
- `backend/src/modules/radar/services/radar-push.service.spec.ts`
  - history list query / DTO assertions

Result:
- PASS

### AC2

Requirement:
- 返回当前 tenant + organization 下的未读推送数
- 仅统计 `status = sent` 且 `isRead = false`

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `GET /api/radar/pushes/unread-count`
- `backend/src/modules/radar/services/radar-push.service.ts`
  - `getUnreadCount`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - unread-count route
- `backend/src/modules/radar/services/radar-push.service.spec.ts`
  - unread count service assertions

Result:
- PASS

### AC3

Requirement:
- `PATCH /api/radar/pushes/:id/read` 真正更新已读状态
- tenant / organization 不匹配时返回 `NotFound`

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `PATCH /api/radar/pushes/:id/read`
- `backend/src/modules/radar/services/radar-push.service.ts`
  - `markAsRead`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - read delegation / not found path
- `backend/src/modules/radar/services/radar-push.service.spec.ts`
  - read update / already-read / not-found cases

Result:
- PASS

### AC4

Requirement:
- `POST /api/radar/pushes/:id/bookmark` 支持收藏与取消收藏
- 返回最新 `isBookmarked`

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `POST /api/radar/pushes/:id/bookmark`
- `backend/src/modules/radar/services/radar-push.service.ts`
  - `setBookmark`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - bookmark route
- `backend/src/modules/radar/services/radar-push.service.spec.ts`
  - bookmark update / unchanged / not-found cases

Result:
- PASS

## Validation Summary

- Backend targeted tests: PASS
- Backend build: PASS
- Frontend build: NOT RUN
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - 历史页前端还未切换到 `GET /api/radar/pushes/history`，该接入将在 Story 11.2 完成
