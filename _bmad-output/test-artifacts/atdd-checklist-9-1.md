---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-30T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '9-1'
storyTitle: 报告中心聚合页
inputDocuments:
  - 'D:\csaas\_bmad-output\implementation-artifacts\9-1-report-center-aggregate-page.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\4-3-compile-hierarchical-control-report-structure.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\7-1-unified-control-context-exposure.md'
  - 'D:\csaas\_bmad-output\planning-artifacts\epics.md'
  - 'D:\csaas\_bmad-output\planning-artifacts\epic-6-11-quality-assessment-2026-03-26.md'
  - 'D:\csaas\frontend\components\layout\Sidebar.tsx'
  - 'D:\csaas\frontend\components\layout\UnifiedNavigation.tsx'
  - 'D:\csaas\frontend\app\reports\[reportId]\page.tsx'
  - 'D:\csaas\frontend\app\projects\[projectId]\gap-analysis\page.tsx'
  - 'D:\csaas\frontend\lib\utils\api.ts'
  - 'D:\csaas\backend\src\modules\compliance-intelligence\services\control-report-compiler.service.ts'
  - 'D:\csaas\backend\src\modules\survey\survey.controller.ts'
---

# ATDD Checklist - Story 9.1: 报告中心聚合页

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Backend Aggregate Contract + Frontend Report Index Page`

### Prerequisites Check

- Story 文档存在且 AC 清晰：`PASS`
- 前端测试框架存在（Jest / RTL）且已有页面测试模式：`PASS`
- 后端测试框架存在（Jest + controller/service spec）：`PASS`
- 报告详情占位页和编译 contract 已存在，可作为 9.1 的 brownfield 参考：`PASS`
- 当前仓库尚无 `/reports` 聚合首页和正式聚合 API，这正是本 Story 的 RED phase 目标：`PASS`

### Story Context Summary

- Story 9.1 要把已经暴露在全局导航里的 `/reports` 真正落成一个跨项目报告中心首页，而不是继续依赖单个项目页面或详情占位页。
- 后端已提供 `compile-control-report`，并且当前 route 语义已经把 `surveyResponseId` 视为 `reportId`；因此 9.1 的列表 contract 必须围绕这个既有标识设计，而不是再引入第二套报告 ID。
- `gap-analysis` 页虽然能产出成熟度分析，但当前页面会把结果写到 localStorage；报告中心不能把这类本地缓存当成正式产品数据源，必须消费持久化 survey response / 聚合 API。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - Story 9.1 的主要风险在 contract 和聚合逻辑，适合先做明确的验收覆盖矩阵
  - 当前仓库已有多份 ATDD checklist 先行的 BMAD 产物，可直接复用格式
  - 暂不需要浏览器录制即可定义 `/reports` 页面与聚合 API 的 RED phase 护栏

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`API Contract + Frontend Page Integration`

### Acceptance Criteria to Scenario Mapping

#### AC1 - `/reports` 加载后展示项目摘要、最新差距结果、风险摘要、报告状态和详情入口，并支持筛选

1. `[P0][API]` 聚合接口返回 `items[]`，每项至少包含 `projectId`、`projectName`、`reportId`、`reportStatus`、`projectSummary`、`gapSummary`、`riskSummary`
2. `[P0][API]` 聚合接口支持 `projectId`、`status[]`、`dateFrom/dateTo` 等筛选，并返回稳定排序结果
3. `[P0][Page]` `/reports` 页面成功渲染聚合结果，并展示项目名、状态标签、摘要信息与“查看报告”入口
4. `[P1][Page]` 用户切换项目筛选或状态筛选后，列表应跟随更新，而不是回退成初始全量结果

#### AC2 - 某项目暂时没有可读报告数据时，展示空态且不误报失败

5. `[P0][API]` 某项目缺少最新 survey response / 适用 controls / 报告输入时，聚合接口仍返回该项目条目，并标记 `reportStatus='not_ready'`
6. `[P0][Page]` 页面对 `not_ready` 条目展示清晰空态文案，而不是统一错误提示
7. `[P1][Regression]` 当聚合接口返回空列表时，页面显示“暂无报告项目”级别空态，而不是“加载失败”

#### AC3 - 报告状态采用统一五态枚举

8. `[P0][API]` 聚合接口只返回 `not_ready`、`ready_to_generate`、`generating`、`ready`、`failed` 五个合法状态值
9. `[P1][API]` 对于已有可读详情入口的项目，状态必须是 `ready`，且 `reportId` 与 `latestSurveyResponseId` 语义一致
10. `[P1][Regression]` 缺失状态映射时不允许返回前端自定义字符串（如 `draft`、`published`、`success`）

#### AC4 - 点击“查看报告”跳转到 `/reports/[reportId]`

11. `[P0][Page]` 当 `reportStatus='ready'` 时，点击列表入口应跳转到 `/reports/[reportId]`
12. `[P1][Page]` 当状态不是 `ready` 时，不应误导性跳转到详情页，而应展示状态提示或禁用入口
13. `[P1][Contract]` `reportId` 必须与后续 `9.2` / 现有 `compile-control-report` route 语义对齐，当前阶段应等同 `surveyResponseId`

## Step 4 - Validation and Completion

### Validation Result

- 所有 AC 都已映射到可自动化验证的 API contract 或页面集成场景：`PASS`
- 本 Story 的最高风险是“前端拼接多个零散接口或依赖 localStorage”，已在 ATDD 中通过 contract 场景显式约束：`PASS`
- `/reports` 作为顶层入口，必须同时有后端聚合 contract 测试和前端页面测试；只做其中一侧都不够：`PASS`

### Red Phase Intent

- 先补报告中心聚合 contract 与页面级 RED phase 覆盖，证明当前仓库尚不具备：
  - `/reports` 顶层聚合页
  - 报告五态状态模型的正式输出
  - 项目/状态/时间筛选
  - `ready` 条目跳转到 `/reports/[reportId]`
- 这些测试或验收工件在实现前应先失败，失败原因应来自“聚合页/聚合接口不存在或 contract 不完整”，而不是测试装置问题。
- `frontend/app/reports/[reportId]/page.tsx` 当前是占位实现，9.1 不要求把它做完整，只要求列表入口和 route 语义先稳定。

### Key Risks / Assumptions

- 当前阶段 `reportId` 沿用 `surveyResponseId` 语义，这是基于 `compile-control-report` / `sourceRoute` 现有实现得出的约束；如果实现时改成新 ID，9.1 与 9.2 必须同步修正。
- 报告中心不应复用 `frontend/app/projects/page.tsx` 的项目卡片作为数据源，因为项目列表不包含报告摘要和状态语义。
- 不能从 `gap-analysis` 页的 localStorage 提取摘要；那会导致跨用户、跨设备、跨会话不一致。
- 全局导航已经存在 `/reports`，因此 9.1 的实现必须优先填补入口能力，而不是再创建第二个报告入口。

### Next Step Recommendation

1. 先落后端聚合 DTO / service / controller，把报告状态与 `reportId` 语义钉死
2. 再落 `frontend/app/reports/page.tsx`，只消费单一聚合接口
3. 页面上优先完成加载态、空态、筛选态和 `ready` 入口跳转，不扩 scope 到 `9.2/9.3/9.4`
4. 完成实现后再进入 code review 和 traceability gate，验证 AC 到测试的闭环覆盖
