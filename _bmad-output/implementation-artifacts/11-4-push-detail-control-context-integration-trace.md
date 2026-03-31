# Story 11.4 Traceability Matrix

Date: 2026-03-31
Story: 11-4-push-detail-control-context-integration
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- `GET /api/radar/pushes/:id` 返回真实 `matchedControls/controlId`
- `controlId` 与 `matchedControls` 一致

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - detail route integrates `RadarRelevanceEnhancedService`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - matched control payload assertion

Result:
- PASS

### AC2

Requirement:
- history 弹窗在有 matchedControls 时显示控制点入口
- 用户可以打开 `ControlDetailDrawer`

Coverage:
- `frontend/app/radar/history/components/PushDetailModal.tsx`
  - detail fetch + drawer entry
- `frontend/app/radar/history/components/PushDetailModal.test.tsx`
  - drawer integration assertion

Result:
- PASS

### AC3

Requirement:
- 无 matchedControls 时不显示控制点入口
- 其他详情与反馈功能不受影响

Coverage:
- `frontend/app/radar/history/components/PushDetailModal.tsx`
  - conditional entry rendering
- `frontend/app/radar/history/components/PushDetailModal.test.tsx`
  - no-entry assertion

Result:
- PASS

### AC4

Requirement:
- radar relevance 计算失败时回退为空 control context
- 不影响推送详情主内容展示

Coverage:
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `buildResolvedRadarControlContext` fallback path
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
  - relevance failure fallback assertion

Result:
- PASS

## Validation Summary

- Backend targeted tests: PASS
- Frontend targeted tests: PASS
- Backend build: PASS
- Frontend build: PASS
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - 未运行 `frontend/e2e/radar-control-detail-drawer.spec.ts`
