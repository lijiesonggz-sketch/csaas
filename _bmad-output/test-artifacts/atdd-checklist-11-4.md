---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '11-4'
storyTitle: 推送详情接入 KG 控制点上下文
inputDocuments:
  - 'D:\Csaas\_bmad-output\implementation-artifacts\11-4-push-detail-control-context-integration.md'
  - 'D:\Csaas\backend\src\modules\compliance-intelligence\services\radar-relevance-enhanced.service.ts'
  - 'D:\Csaas\backend\src\modules\radar\controllers\radar-push.controller.ts'
  - 'D:\Csaas\frontend\app\radar\history\components\PushDetailModal.tsx'
  - 'D:\Csaas\frontend\components\compliance\ControlDetailDrawer.tsx'
---

# ATDD Checklist - Story 11.4: 推送详情接入 KG 控制点上下文

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `fullstack`
- 项目级检测结果：`NestJS + Next.js`
- Story 级测试焦点：`Push Detail Control Context + History Drawer Integration`

### Prerequisites Check

- Epic 7.1 已定义 unified control context contract：`PASS`
- Epic 7.2/7.4 已有 `ControlDetailDrawer` 前端能力：`PASS`
- `RadarRelevanceEnhancedService` 已能按 `contentId + organizationId` 输出 matchedControls：`PASS`

### Story Context Summary

- 11.4 的关键是把 control matching 延迟到详情级别，避免历史列表首屏开销膨胀。
- 前端只需要在详情弹窗里消费 matchedControls 并转接到现有 drawer。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时修改后端 detail route 与前端 history modal
  - 需要把现成 radar relevance 能力映射到已有 drawer contract

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Backend Controller + Frontend Component`

### Acceptance Criteria to Scenario Mapping

#### AC1 / AC4 - detail route control context

1. `[P0][Controller]` `GET /api/radar/pushes/:id` 返回真实 matchedControls
2. `[P0][Controller]` radar relevance 异常时回退空上下文

#### AC2 / AC3 - history modal drawer integration

3. `[P0][Component]` 有 matchedControls 时显示入口并打开 drawer
4. `[P1][Component]` 无 matchedControls 时不显示入口

## Step 4 - Validation and Completion

### Validation Result

- 以 detail route 惰性拉取 control context，能兼顾性能和产品可达性：`PASS`
- 复用 `ControlDetailDrawer` 足以覆盖本 story，不需要新增 explain 页面：`PASS`

### Next Step Recommendation

1. 先补后端 detail route 的 radar relevance 集成与回退逻辑
2. 再补 history modal 的 detail fetch 和 drawer 按钮
3. 最后做 controller/component 定向测试
