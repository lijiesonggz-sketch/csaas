# Story 9.2: 控制报告详情页

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 报告阅读者，
I want 查看按 `L1 -> L2 -> controls -> recommendations` 组织的控制报告详情，
so that 我能按监管风险结构阅读问题、证据和建议，而不是只看到控制点平铺列表。

## Source References

- Parent PRD `V1-G01`
- Existing `compile-control-report` contract from Story `4.3`
- Existing `/reports/[reportId]` route
- Story `9.1` 报告中心聚合页与 reportId 语义

## Minimum Viable Scope

- 继续使用主路由 `/reports/[reportId]`
- 页面消费正式详情接口并渲染 `L1 -> L2 -> controls -> recommendations`
- `reportId` 继续沿用当前阶段的 `surveyResponseId` 语义
- 无效 `reportId`、无可读数据或缺少控制范围时展示明确空态 / 错误态
- 保持从 control node 打开共享 `ControlDetailDrawer`

## Acceptance Criteria

1. **Given** 某项目存在可编译的控制报告
   **When** 打开控制报告详情页
   **Then** 系统消费 `compile-control-report`
   **And** 以 `L1 -> L2 -> controls -> recommendations` 结构渲染页面

2. **Given** 报告尚未生成或 `reportId` 无效
   **When** 打开控制报告详情页
   **Then** 系统展示明确的空态或 not-found 状态
   **And** 不将控制报告与项目摘要混为一页

3. **Given** 用户在报告中查看某个 control node
   **When** 需要进一步追溯
   **Then** 系统可以打开控制点详情抽屉
   **And** 形成“报告阅读 -> 控制点 explain”闭环

## Tasks / Subtasks

- [x] Task 1: 固化报告详情数据 contract 与页面边界（AC: 1, 2, 3）
  - [x] 明确详情页正式读取路径，避免继续使用错误的临时 fetch 方案
  - [x] 明确 `reportId = surveyResponseId` 的当前阶段语义，并保持与 9.1 一致
  - [x] 明确详情页只消费结构化报告数据，不承载项目摘要聚合逻辑

- [x] Task 2: 完成 `/reports/[reportId]` 的层级渲染（AC: 1, 2）
  - [x] 页面展示 `L1 -> L2 -> controls -> recommendations` 全层级，而不是停在 control 平铺
  - [x] 每个 control card 至少展示状态、gap level、证据摘要和 recommendation 列表
  - [x] 当 `reportId` 无效或 sections 为空时，展示明确空态 / 错误态

- [x] Task 3: 保持共享控制点详情抽屉闭环（AC: 3）
  - [x] control node 继续可打开共享 `ControlDetailDrawer`
  - [x] 抽屉参数保持 `sourceModule='report'`、`sourceRecordId=reportId`
  - [x] 详情页状态与滚动不因抽屉开关丢失

- [x] Task 4: 补齐 9.2 自动化测试（AC: 1, 2, 3）
  - [x] 页面测试覆盖成功层级渲染、recommendations 展示、空态/错误态
  - [x] 页面测试覆盖点击 control detail 入口
  - [x] 如继续保留 `frontend/e2e/report-control-detail.spec.ts`，同步校正其 API 路径假设

## Dev Notes

### Story Requirements and Intent

- `9.2` 的重点不是新建一套路由，而是把已经存在的 `/reports/[reportId]` 占位页收敛为正式详情页。
- `9.1` 已经把报告中心入口和 `reportId` 语义钉住；`9.2` 应直接复用，不再倒推新的报告标识。
- 详情页必须把 `recommendations` 展示出来，否则仍停留在 Story 4.3 的“结构化 compile contract”层，没有形成用户可读的报告页面。

### Existing Implementation Snapshot

- 现有 `frontend/app/reports/[reportId]/page.tsx` 已能：
  - 读取 `reportId`
  - 渲染 `sections -> l2Sections -> controls`
  - 打开共享 `ControlDetailDrawer`
- 但它仍有明显不足：
  - recommendation 层未渲染
  - 页面结构非常原始，尚未形成“报告详情”而更像调试视图
  - 现有 e2e 测试仍假设旧的临时 API 路径

### Brownfield Guardrails

- 保持主路由 `/reports/[reportId]`
- 保持共享 `ControlDetailDrawer`，不新建 report 专属 explain modal
- 保持 `reportId = surveyResponseId` 直到 Epic 9 后续明确引入独立报告实体
- 不把项目摘要聚合内容再塞回详情页顶部主结构；那是 9.1 的职责

### Candidate Source Tree Touchpoints

- `frontend/app/reports/[reportId]/page.tsx`
- `frontend/lib/api/report-center.ts`
- `frontend/lib/types/report.ts`
- `frontend/e2e/report-control-detail.spec.ts`
- `backend/src/modules/compliance-intelligence/controllers/report-center.controller.ts`
- `backend/src/modules/compliance-intelligence/services/report-center.service.ts`

### Testing Requirements

- 页面测试至少覆盖：
  - recommendation 列表可见
  - sections 为空时显示空态
  - 详情接口报错时显示错误态
  - 点击“查看详情”后 drawer 打开
- 定向回归：
  - frontend tests for `/reports`
  - backend report-center detail endpoint tests

### References

- `D:\csaas\_bmad-output\planning-artifacts\epics.md`
- `D:\csaas\_bmad-output\implementation-artifacts\9-1-report-center-aggregate-page.md`
- `D:\csaas\_bmad-output\implementation-artifacts\4-3-compile-hierarchical-control-report-structure.md`
- `D:\csaas\frontend\app\reports\[reportId]\page.tsx`
- `D:\csaas\frontend\e2e\report-control-detail.spec.ts`
- `D:\csaas\backend\src\modules\compliance-intelligence\services\report-center.service.ts`
- `D:\csaas\backend\src\modules\compliance-intelligence\controllers\report-center.controller.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-30：创建 Story 9.2 的 ready-for-dev 上下文，明确其职责是把既有 `/reports/[reportId]` 占位页收敛为正式报告详情页。
- 2026-03-30：已确认 9.1 已建立 `reportId = surveyResponseId` 语义，并补上详情最小读取通路，9.2 应在此基础上继续而不是重建路由。
- 2026-03-30：已将详情页层级扩展到 recommendation 级，并把 control card 的状态、证据摘要和建议展示补齐。
- 2026-03-30：已补齐 `/reports/[reportId]` 页面测试，覆盖 hierarchy、空态、404 风格错误态和共享 drawer 打开。
- 2026-03-30：已同步修正旧 `report-control-detail` e2e 中的临时 API 路径假设。
- 2026-03-30：code review 结论 PASS，traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/9-2-control-report-detail-page.md`
- `_bmad-output/implementation-artifacts/9-2-control-report-detail-page-trace.md`
- `_bmad-output/test-artifacts/atdd-checklist-9-2.md`
- `_bmad-output/test-artifacts/code-review-story-9-2.md`
- `frontend/app/reports/[reportId]/page.tsx`
- `frontend/app/reports/[reportId]/page.test.tsx`
- `frontend/e2e/report-control-detail.spec.ts`

## Change Log

- 2026-03-30: 创建 Story 9.2 的 ready-for-dev story packet，明确 recommendation 展示、详情页空态/错误态以及共享 drawer 的边界。
- 2026-03-30: 扩展 `/reports/[reportId]` 层级渲染，补齐 recommendations、error/empty state 与 drawer 回归保护。
- 2026-03-30: 完成 code review 与 traceability gate，当前状态推进到 `done`。
