---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '11-2'
storyTitle: Radar 首页与全局导航接入推送历史入口
inputDocuments:
  - 'D:\Csaas\_bmad-output\implementation-artifacts\11-2-radar-nav-push-history-entry.md'
  - 'D:\Csaas\frontend\app\radar\page.tsx'
  - 'D:\Csaas\frontend\components\layout\Header.tsx'
  - 'D:\Csaas\frontend\app\radar\history\page.tsx'
  - 'D:\Csaas\frontend\lib\api\radar.ts'
---

# ATDD Checklist - Story 11.2: Radar 首页与全局导航接入推送历史入口

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`frontend-heavy fullstack`
- Story 级测试焦点：`Radar History Entry + Shared Unread Badge`

### Prerequisites Check

- Story 11.1 已提供 `GET /api/radar/pushes/history` 与 `GET /api/radar/pushes/unread-count`：`PASS`
- `/radar/history` 页面已存在，但入口较隐蔽且前端仍使用旧 route：`PASS`
- 主布局 Header 在所有登录页面共享，适合承载全局消息入口：`PASS`

### Story Context Summary

- 11.2 要解决入口发现性和未读状态一致性，而不是只修一个按钮。
- 首页和全局导航必须复用同一个 unread 数据源与刷新策略。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时修改页面、布局、API client 与测试
  - 需要共享 unread 数据，而不是页面级一次性 fetch

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Frontend Component + API Client Tests`

### Acceptance Criteria to Scenario Mapping

#### AC1 / AC2 - 首页与全局导航入口 + 统一未读角标

1. `[P0][Page]` `/radar` 首页显示“推送历史”入口与 unread badge
2. `[P0][Header]` 全局消息入口可跳转 `/radar/history`
3. `[P1][Hook]` 首页与 Header 共享同一 unread 数据源

#### AC3 - 历史页切换到专用 history API

4. `[P0][API]` `getPushHistory` 调用 `/api/radar/pushes/history`
5. `[P1][Page]` history 页筛选和列表继续正常渲染

#### AC4 - 已读后 badge 同步刷新

6. `[P0][Page]` 标记已读后触发共享 unread 刷新
7. `[P1][Header/Page]` unread badge 响应刷新事件

## Step 4 - Validation and Completion

### Validation Result

- 该 story 可通过共享 hook + 事件驱动刷新达成“同一数据源、刷新策略一致”：`PASS`
- 不需要引入 React Query / Zustand 新 store，也能满足当前范围：`PASS`

### Next Step Recommendation

1. 先落共享 unread hook 与 radar API 切换
2. 再改 Header 和 `/radar` 首页入口
3. 最后补页面与 API client 自动化测试
