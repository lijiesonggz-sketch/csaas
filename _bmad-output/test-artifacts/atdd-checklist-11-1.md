---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '11-1'
storyTitle: 推送历史后端 Controller 接线闭环
inputDocuments:
  - 'D:\Csaas\_bmad-output\implementation-artifacts\11-1-push-history-backend-controller-wiring.md'
  - 'D:\Csaas\backend\src\modules\radar\controllers\radar-push.controller.ts'
  - 'D:\Csaas\backend\src\modules\radar\services\radar-push.service.ts'
  - 'D:\Csaas\backend\src\database\entities\radar-push.entity.ts'
  - 'D:\Csaas\frontend\lib\api\radar.ts'
---

# ATDD Checklist - Story 11.1: 推送历史后端 Controller 接线闭环

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Radar Push Controller Wiring + Read/Unread/Bookmark Contract`

### Prerequisites Check

- `RadarPushService` 已具备历史查询、已读、未读数基础能力：`PASS`
- `RadarPushController` 仍在直接操作 repository，存在 contract 分叉：`PASS`
- `RadarPush` 实体已包含 `isRead` / `readAt` / `isBookmarked`：`PASS`

### Story Context Summary

- 11.1 的关键目标是让 controller 复用 service，而不是继续维护第二套历史聚合逻辑。
- 前端已经依赖 `unread-count`、`read`、`bookmark` 等 contract，因此测试要先锁定接口行为。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时修改 controller、service、DTO 与前端依赖契约
  - 现有 controller/spec 与实际 frontend contract 明显不一致

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Backend Controller + Service Unit Tests`

### Acceptance Criteria to Scenario Mapping

#### AC1 - 历史查询统一走 service contract

1. `[P0][Controller]` `GET /api/radar/pushes` 调用 `RadarPushService.getPushHistory`
2. `[P0][Controller]` `GET /api/radar/pushes/:id` 返回统一 DTO 和 control context

#### AC2 - 未读数接口

3. `[P0][Controller]` `GET /api/radar/pushes/unread-count` 返回当前 org 未读数

#### AC3 - 已读更新

4. `[P0][Controller]` `PATCH /api/radar/pushes/:id/read` 真正调用 service 并返回成功结果
5. `[P0][Service]` `markAsRead` 仅允许 tenant + organization 范围内更新

#### AC4 - 收藏切换

6. `[P0][Controller]` `POST /api/radar/pushes/:id/bookmark` 支持收藏和取消收藏
7. `[P1][Service]` bookmark 返回最新 `isBookmarked`

## Step 4 - Validation and Completion

### Validation Result

- 该 story 可通过 controller/service 单测覆盖主要风险，不依赖新增 migration：`PASS`
- 前端契约兼容性主要靠 `frontend/lib/api/radar.ts` 调用面校验：`PASS`

### Next Step Recommendation

1. 先写 controller/service 失败测试，锁定 unread-count / read / bookmark 行为
2. 再改 controller 接线和 service bookmark 实现
3. 最后回归前端 API 调用与定向测试
