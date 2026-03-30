# Story 9.1: 报告中心聚合页

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 报告使用者，
I want 在统一入口查看项目报告概览与报告清单，
so that 我能快速找到可读的差距、风险和行动交付物，而不是逐个项目翻找散落页面。

## Source References

- Parent PRD `V1-G01`
- Epic 9 `KG 驱动的报告中心与交付层`
- Existing `compile-control-report` contract from Story `4.3`
- Existing global navigation entries `/reports` in sidebar and unified navigation

## Minimum Viable Scope

- 新建顶层报告中心页面 `frontend/app/reports/page.tsx`
- 提供单一聚合查询 contract，输出项目摘要、最新差距结果、风险摘要、报告状态与详情入口
- 支持按项目、时间范围、报告状态筛选
- 对没有可读报告数据的项目展示明确空态，而不是报错
- 报告中心只展示状态与入口，不在 `9.1` 内重新实现 `9.2` 的详情层级渲染

## Acceptance Criteria

1. **Given** 用户访问 `/reports`
   **When** 页面加载
   **Then** 系统展示项目摘要、最新差距结果、风险摘要、报告状态和进入详情的入口
   **And** 支持按项目、时间或状态筛选

2. **Given** 某项目暂时没有可读报告数据
   **When** 页面渲染
   **Then** 系统展示清晰空态
   **And** 不将该项目误判为加载失败

3. **Given** 报告中心需要显示“报告是否可查看/可生成/生成失败”
   **When** 系统聚合项目报告信息
   **Then** 报告状态统一采用 `not_ready`、`ready_to_generate`、`generating`、`ready`、`failed`
   **And** 状态语义与 Epic 9 的状态模型保持一致

4. **Given** 报告条目存在可用详情入口
   **When** 用户点击“查看报告”
   **Then** 系统跳转到 `/reports/[reportId]`
   **And** `reportId` 与后续 Story `9.2` 的详情页 contract 保持一致

## Tasks / Subtasks

- [x] Task 1: 固定报告中心聚合 contract、状态枚举与筛选语义（AC: 1, 2, 3, 4）
  - [x] 明确顶层 response 结构至少包含 `items[]`、`filtersApplied` 与必要分页/统计元数据
  - [x] 为每个 report item 固定最小字段集：`projectId`、`projectName`、`organizationId`、`reportId`、`reportStatus`、`latestSurveyResponseId`、`generatedAt`、`riskSummary`、`gapSummary`、`projectSummary`
  - [x] 明确 query/filter 参数：`projectId`、`status[]`、`dateFrom`、`dateTo`、`sortBy`、`sortOrder`
  - [x] 明确 `reportId` 在当前阶段与 `surveyResponseId` 对齐，避免前后端再引入第二套 report 标识

- [x] Task 2: 实现报告中心聚合查询服务与受保护接口（AC: 1, 2, 3, 4）
  - [x] 新增单一聚合查询入口，避免前端通过 `/projects`、`/survey/*`、`current-state`、本地缓存做 N+1 拼接
  - [x] 基于现有持久化数据推导每个项目的最新可读报告上下文：项目基础信息、最新问卷/差距分析结果、控制报告可生成性
  - [x] 当项目缺少问卷快照、survey response、适用 control 或其他必要前置数据时，返回 `not_ready` 而不是抛 500
  - [x] 当项目已有最新 survey response 且 control report 输入齐备时，返回可进入详情或可触发生成的状态
  - [x] 对跨租户/跨组织访问继续走现有权限边界与审计日志

- [x] Task 3: 实现 `/reports` 聚合页与筛选交互（AC: 1, 2, 3, 4）
  - [x] 新建 `frontend/app/reports/page.tsx`，消费单一聚合 API，而不是直接复用项目列表页
  - [x] 页面展示每个项目的摘要卡片或列表项，至少包含项目名、客户信息、更新时间、风险摘要、差距摘要、报告状态、详情入口
  - [x] 提供项目筛选、日期筛选、状态筛选，并保持空态/加载态/错误态分离
  - [x] 当 `reportStatus='ready'` 时提供明确“查看报告”入口；当状态为其他值时提供对应提示，但不擅自实现 9.3 的生成/下载流程

- [x] Task 4: 补齐 9.1 的自动化测试与回归护栏（AC: 1, 2, 3, 4）
  - [x] 后端测试覆盖聚合 contract、状态推导、筛选、权限拒绝与空态项目返回
  - [x] 前端测试覆盖 `/reports` 的加载态、空态、筛选态、点击跳转与错误展示
  - [x] 至少增加一组测试验证“无报告数据”显示空态而不是“加载失败”
  - [x] 保持现有 `frontend/app/reports/[reportId]/page.tsx`、`frontend/e2e/report-control-detail.spec.ts` 与全局导航不因 9.1 回退

## Dev Notes

### Story Requirements and Intent

- `9.1` 是 Epic 9 的入口故事，负责建立“统一报告中心”而不是继续把报告能力散落在项目详情、差距分析页和占位路由里。
- 本 Story 的目标是把跨项目的“是否有报告、报告准备到什么状态、用户应该从哪里进入”收敛成正式产品入口。
- 本 Story **不是**：
  - 重写 `compile-control-report`
  - 实现 `9.2` 的层级详情渲染
  - 实现 `9.3` 的服务端 PDF 生成
  - 实现 `9.4` 的整改优先级清单

### Existing Implementation Snapshot

- 侧边栏和顶部统一导航已经暴露 `/reports`，但当前 `frontend/app/reports` 目录只有 `[reportId]/page.tsx`，没有聚合首页。
- 当前报告详情页是一个早期占位实现：
  - 路由存在：`frontend/app/reports/[reportId]/page.tsx`
  - 使用了错误的 fetch 路径 `/api/kg/report/compile-control-report?...`
  - 依赖了不存在的 `@/lib/types/report`
- 后端已稳定提供 `POST /compliance-intelligence/compile-control-report`，且 `ControlReportCompilerService` 当前把 `surveyResponseId` 直接作为 report route 的 `sourceRecordId` / `sourceRoute`，说明当前阶段 `reportId` 应与 `surveyResponseId` 对齐，而不是再造一套独立 id。

### Report Status Model

- Epic 9 已固定报告状态枚举为：
  - `not_ready`
  - `ready_to_generate`
  - `generating`
  - `ready`
  - `failed`
- `9.1` 只负责展示该状态，不重新定义底层报告编译逻辑。
- 建议当前阶段的最小状态推导：
  - 缺少最新 survey response、适用 control 集、或必要摘要输入时：`not_ready`
  - 输入齐备但尚未形成可读报告快照时：`ready_to_generate`
  - 若后续接入异步生成流程，可复用 `generating`
  - 已存在可读报告详情入口时：`ready`
  - 聚合过程中识别到最近一次生成失败或数据异常时：`failed`

### Aggregate Contract Decisions

- 推荐由后端提供**单一聚合接口**，不要让前端并行拼接以下来源：
  - `/projects`
  - `/projects/:id`
  - `/survey/:id/analyze`
  - `/survey/control-gap-input/:surveyResponseId`
  - `current-state`
  - 页面 localStorage
- 原因：
  - 报告中心是跨项目列表，前端逐项拼接会产生 N+1 请求和筛选不稳定问题
  - `frontend/app/projects/[projectId]/gap-analysis/page.tsx` 当前会把分析结果缓存到 `localStorage`；报告中心不能把本地缓存当成正式产品数据源
  - `upload-and-analyze` 已在后端创建并持久化 `surveyResponseId`，应优先围绕持久化 survey response 建模
- 推荐 item 字段补充：
  - `clientName`
  - `updatedAt`
  - `standardName`
  - `overallMaturity`
  - `topRiskLevel`
  - `topShortcomingNames[]`
  - `isEmptyState`
  - `emptyStateReason`

### Brownfield Guardrails

- 复用已有导航入口 `/reports`，不要新增第二个“报告中心”入口。
- 复用 `compile-control-report` 已定义的 report route 语义：当前阶段 `reportId = surveyResponseId`。
- 不从 `frontend/app/projects/[projectId]/gap-analysis/page.tsx` 的 localStorage 读取报告摘要。
- 不在 `9.1` 中修复或重写 `9.2` 的详情页布局，只需要保证入口 contract 一致。
- 不在 `9.1` 中把 PDF 导出伪装成 `window.print()`；那属于 `9.3` 的明确非目标。
- 不新增新的前端全局状态库；沿用现有 `apiFetch`、页面级 state 和现有 organization/project 上下文。

### Candidate Source Tree Touchpoints

- `frontend/app/reports/page.tsx`
- `frontend/app/reports/[reportId]/page.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/UnifiedNavigation.tsx`
- `frontend/lib/utils/api.ts`
- `frontend/lib/api/projects.ts`
- `backend/src/modules/compliance-intelligence/controllers/`
- `backend/src/modules/compliance-intelligence/services/`
- `backend/src/modules/projects/services/projects.service.ts`
- `backend/src/modules/survey/maturity-analysis.service.ts`
- `backend/src/modules/survey/survey.controller.ts`

### Testing Requirements

- 后端至少覆盖：
  - 基础聚合返回
  - 项目 / 状态 / 时间筛选
  - `not_ready` 与 `ready` 的状态推导
  - 无前置报告数据时返回空态 item，而不是接口错误
  - 未授权或越权访问被拒绝
- 前端至少覆盖：
  - `/reports` 初始加载态
  - 全量空态
  - 某个项目无报告数据时的空态文案
  - 状态筛选后列表变化
  - 点击“查看报告”跳转到 `/reports/[reportId]`

### Previous Story Intelligence

- **Story 4.3 (已完成)**：后端已有 `compile-control-report` contract，可作为报告详情入口的 authoritative source，不要在 9.1 重新发明 report compile。
- **Story 4.4 (已完成)**：报告编译结构已包含 remediation/recommendation 数据，说明后续 9.4 只应做产品层排序与展示，不应回退到底层编译。
- **Story 7.1 (已完成)**：统一控制点上下文协议已经规定 report source route 为 `/reports/{reportId}`，当前 reportId 语义应与 `surveyResponseId` 保持一致。
- **Story 7.4 (已完成)**：审核工作台已复用共享控制点抽屉，说明报告链路也应继续复用共享控制点 explain，而不是新建 report 专属详情组件。

### Git Intelligence Summary

- 当前工作区已存在报告详情占位页和对应 e2e 测试，说明团队曾尝试先落 `/reports/[reportId]`，但尚未补齐真正的聚合首页与正式数据流。
- 最近 Epic 8 / 7 的修正都遵循“先固定 contract，再让页面消费聚合接口”的模式，9.1 应沿用同样思路，而不是把逻辑散到多个页面 hook。

### Project Structure Notes

- 前端顶层业务区采用 App Router，`/reports` 应直接放在 `frontend/app/reports/page.tsx`。
- `apiFetch` 会自动注入认证头并抽取 `{ success, data }` 响应体，报告中心应复用该模式。
- 当前 monorepo 中没有独立的 `report` domain types 文件；如需要新增类型，优先放在现有 `frontend/lib/api/` 或明确的 `frontend/lib/types/` 下，并与后端 DTO 对齐。

### References

- `D:\csaas\_bmad-output\planning-artifacts\epics.md`
- `D:\csaas\_bmad-output\analysis\kg-v1-unfinished-epics-and-stories-2026-03-26.md`
- `D:\csaas\_bmad-output\planning-artifacts\epic-6-11-quality-assessment-2026-03-26.md`
- `D:\csaas\_bmad-output\implementation-artifacts\4-3-compile-hierarchical-control-report-structure.md`
- `D:\csaas\_bmad-output\implementation-artifacts\7-1-unified-control-context-exposure.md`
- `D:\csaas\frontend\components\layout\Sidebar.tsx`
- `D:\csaas\frontend\components\layout\UnifiedNavigation.tsx`
- `D:\csaas\frontend\app\reports\[reportId]\page.tsx`
- `D:\csaas\frontend\e2e\report-control-detail.spec.ts`
- `D:\csaas\frontend\app\projects\[projectId]\gap-analysis\page.tsx`
- `D:\csaas\frontend\lib\utils\api.ts`
- `D:\csaas\backend\src\modules\compliance-intelligence\services\control-report-compiler.service.ts`
- `D:\csaas\backend\src\modules\compliance-intelligence\dto\compile-control-report.dto.ts`
- `D:\csaas\backend\src\modules\compliance-intelligence\controllers\control-report.controller.ts`
- `D:\csaas\backend\src\modules\survey\survey.controller.ts`
- `D:\csaas\docs\development-principles.md`
- `D:\csaas\docs\technical-debt.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-30：创建 Story 9.1 的 ready-for-dev 上下文，明确报告中心是顶层 `/reports` 聚合页，而不是现有详情页的附属页面。
- 2026-03-30：已确认当前仓库只有 `/reports/[reportId]` 占位页，没有 `/reports` 聚合首页。
- 2026-03-30：已确认 `compile-control-report` 当前把 `surveyResponseId` 直接用作 report route 标识，因此 9.1 / 9.2 应继续共享该语义。
- 2026-03-30：已确认报告中心不能依赖 `gap-analysis` 页的 localStorage，必须围绕持久化 survey response / 正式聚合 API 建模。
- 2026-03-30：已新增后端 `GET /compliance-intelligence/report-center` 聚合接口，输出报告状态、项目摘要、差距摘要、风险摘要与筛选回显。
- 2026-03-30：已新增前端 `/reports` 首页，接入项目/状态/日期筛选，展示 ready/not_ready/failed 三类可读状态。
- 2026-03-30：已补齐前端 `report-center` API client 和 `@/lib/types/report`，避免报告页因缺失类型定义而编译失败。
- 2026-03-30：已为 `/reports/[reportId]` 补上最小可用的数据通路，改为调用受保护的报告中心详情接口，避免 9.1 的“查看报告”入口直接落到错误 fetch 路径。
- 2026-03-30：定向验证已通过：frontend `app/reports/page.test.tsx`、backend `report-center.service/controller/module` 测试、frontend build、backend build。
- 2026-03-30：代码审查结论为 PASS，未发现阻塞性问题；traceability gate 结论为 PASS。

### File List

- `_bmad-output/implementation-artifacts/9-1-report-center-aggregate-page.md`
- `_bmad-output/implementation-artifacts/9-1-report-center-aggregate-page-trace.md`
- `_bmad-output/test-artifacts/atdd-checklist-9-1.md`
- `_bmad-output/test-artifacts/code-review-story-9-1.md`
- `backend/src/modules/compliance-intelligence/compliance-intelligence.module.ts`
- `backend/src/modules/compliance-intelligence/compliance-intelligence.module.spec.ts`
- `backend/src/modules/compliance-intelligence/controllers/report-center.controller.ts`
- `backend/src/modules/compliance-intelligence/dto/report-center-query.dto.ts`
- `backend/src/modules/compliance-intelligence/dto/report-center.dto.ts`
- `backend/src/modules/compliance-intelligence/services/report-center.service.ts`
- `backend/src/modules/compliance-intelligence/report-center.controller.spec.ts`
- `backend/src/modules/compliance-intelligence/report-center.service.spec.ts`
- `frontend/app/reports/page.tsx`
- `frontend/app/reports/page.test.tsx`
- `frontend/app/reports/[reportId]/page.tsx`
- `frontend/lib/api/report-center.ts`
- `frontend/lib/types/report.ts`

## Change Log

- 2026-03-30: 创建 Story 9.1 的 ready-for-dev story packet，补齐报告状态枚举、聚合 contract、route 约束、brownfield guardrails 与测试边界。
- 2026-03-30: 新增报告中心聚合 DTO、service 和 controller，并接入 `ComplianceIntelligenceModule` 作为受保护聚合入口。
- 2026-03-30: 新增 `/reports` 首页、前端 `report-center` API client 与报告类型定义，支持项目/状态/日期筛选和 ready 报告入口跳转。
- 2026-03-30: 为既有 `/reports/[reportId]` 页面补上最小详情读取通路，避免 ready 入口跳转到不可用的错误 fetch 路径。
- 2026-03-30: 通过后端聚合层定向测试、前端页面测试、frontend build 与 backend build，状态推进到 `review`。
- 2026-03-30: 完成 code review 与 traceability gate，当前状态推进到 `done`。
