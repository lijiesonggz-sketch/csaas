# Story 11.2: Radar 首页与全局导航接入推送历史入口

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Radar 产品用户，
I want 在 Radar 首页和全局导航里快速进入推送历史，并看到统一的未读角标，
so that 我不需要记忆隐藏路由，也能第一时间知道是否有新的站内消息待处理。

## Source References

- Parent PRD `V1-F05`, `V1-F06`
- Epic 11 `KG 关联推送与历史闭环`
- `_bmad-output/analysis/kg-v1-unfinished-epics-and-stories-2026-03-26.md`
- `_bmad-output/planning-artifacts/epic-6-11-quality-assessment-2026-03-26.md`
- Story 11.1 backend wiring
- Existing UI entry points:
  - `frontend/app/radar/page.tsx`
  - `frontend/components/layout/Header.tsx`
  - `frontend/components/layout/Sidebar.tsx`
  - `frontend/app/radar/history/page.tsx`
  - `frontend/lib/api/radar.ts`

## Minimum Viable Scope

- Radar 首页显式暴露 `/radar/history` 入口
- 全局导航新增消息/历史入口并显示未读角标
- 未读数统一走 `GET /api/radar/pushes/unread-count`
- 历史页改用 Story 11.1 新增的 `GET /api/radar/pushes/history`
- 已读操作后触发统一未读数刷新

## Acceptance Criteria

1. **Given** 用户进入 `/radar`
   **When** 页面渲染完成
   **Then** 用户可以直接进入 `/radar/history`
   **And** 入口处展示当前未读数量或显式无未读状态

2. **Given** 用户位于任何使用主布局的页面
   **When** 顶部全局导航渲染
   **Then** 用户能看到站内消息/推送历史入口
   **And** 该入口与 Radar 首页共享同一未读数据源和刷新策略

3. **Given** 用户进入推送历史页
   **When** 页面加载或筛选
   **Then** 前端调用 `GET /api/radar/pushes/history`
   **And** 列表、筛选与详情弹窗继续正常工作

4. **Given** 用户把推送标记为已读
   **When** 操作成功
   **Then** 历史页本地状态更新
   **And** 首页与全局导航的未读角标在同一刷新机制下同步变化

## Tasks / Subtasks

- [x] Task 1: 建立共享未读数数据源（AC: 1, 2, 4）
  - [x] 创建前端共享 hook 或等价机制
  - [x] 统一未读数刷新策略
- [x] Task 2: 接入 Radar 首页与全局导航入口（AC: 1, 2）
  - [x] `/radar` 首页新增 history 入口
  - [x] `Header` 新增消息入口与 badge
- [x] Task 3: 切换历史页到专用 history API（AC: 3, 4）
  - [x] `frontend/lib/api/radar.ts` 使用 `/api/radar/pushes/history`
  - [x] 标记已读后刷新未读角标
- [x] Task 4: 补前端自动化测试（AC: 1, 2, 3, 4）
  - [x] radar 首页入口测试
  - [x] header badge/导航测试
  - [x] history API 与已读刷新测试

## Dev Notes

### Story Requirements and Intent

- 11.2 的核心不是“多一个链接”，而是把 Radar 历史真正提升为产品级入口。
- 未读数必须只有一个 authoritative source，不能首页一套、导航一套。
- 历史页的数据 contract 要切到 Story 11.1 的专用 history route，避免继续复用通用 radar push 列表。

### Brownfield Guardrails

- 不破坏现有技术雷达/行业雷达/合规雷达入口
- 不引入新的全局状态库
- 不在生产代码中加入仅为测试服务的属性
- 保持 `Header` / `Sidebar` / `RadarDashboardPage` 现有视觉语言

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: 新增 `useRadarUnreadCount` 共享 hook，统一首页与 Header 的未读数数据源、轮询与刷新事件。
- 2026-03-31: `/radar` 首页新增“推送历史”入口，使用 `showZero` badge 明确展示 0 或未读数。
- 2026-03-31: `Header` 新增全局消息入口，直接跳转 `/radar/history`。
- 2026-03-31: `frontend/lib/api/radar.ts` 已切换 history route，并统一把 read 操作改为 `PATCH`。
- 2026-03-31: frontend 定向测试与 frontend build 均通过；code review / traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/11-2-radar-nav-push-history-entry.md`
- `_bmad-output/implementation-artifacts/11-2-radar-nav-push-history-entry-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-11-2.md`
- `_bmad-output/test-artifacts/code-review-story-11-2.md`
- `frontend/lib/hooks/useRadarUnreadCount.ts`
- `frontend/lib/api/radar.ts`
- `frontend/components/layout/Header.tsx`
- `frontend/app/radar/page.tsx`
- `frontend/app/radar/page.test.tsx`
- `frontend/components/layout/__tests__/Header.test.tsx`
- `frontend/lib/api/radar.test.ts`
- `frontend/lib/api/radar-industry.test.ts`
