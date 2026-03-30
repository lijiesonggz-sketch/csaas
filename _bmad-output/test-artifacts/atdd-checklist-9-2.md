---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-30T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '9-2'
storyTitle: 控制报告详情页
inputDocuments:
  - 'D:\csaas\_bmad-output\implementation-artifacts\9-2-control-report-detail-page.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\9-1-report-center-aggregate-page.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\4-3-compile-hierarchical-control-report-structure.md'
  - 'D:\csaas\frontend\app\reports\[reportId]\page.tsx'
  - 'D:\csaas\frontend\e2e\report-control-detail.spec.ts'
  - 'D:\csaas\frontend\lib\api\report-center.ts'
  - 'D:\csaas\frontend\lib\types\report.ts'
  - 'D:\csaas\backend\src\modules\compliance-intelligence\controllers\report-center.controller.ts'
  - 'D:\csaas\backend\src\modules\compliance-intelligence\services\report-center.service.ts'
---

# ATDD Checklist - Story 9.2: 控制报告详情页

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Frontend Report Detail Page + Report Detail Contract`

### Prerequisites Check

- Story 文档存在且 AC 清晰：`PASS`
- 既有 `/reports/[reportId]` 页面存在，可做增量实现：`PASS`
- 详情读取接口已存在最小通路，可在此基础上扩展：`PASS`
- 当前主要缺口集中在 recommendation 层和详情态语义，而不是路由创建：`PASS`

### Story Context Summary

- Story 9.2 的目标是把现有 `/reports/[reportId]` 从“控制点平铺视图”升级为正式报告详情页。
- Story 9.1 已把 `reportId = surveyResponseId` 语义和最小详情读取接口落稳，因此 9.2 应继续消费同一路由和 contract。
- 当前页面已经具备 section / l2 / control 渲染与 drawer 接线能力，但尚未展示 recommendations，也缺少更明确的空态 / 错误态验证。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 现有页面和接口都已存在，ATDD 的主要价值是收敛差距而不是先录制新页面
  - 当前 story 重点是页面渲染层级和 recommendation 展示，适合先落页面集成测试

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Frontend Page Integration`

### Acceptance Criteria to Scenario Mapping

#### AC1 - 详情页消费 `compile-control-report` 并按 `L1 -> L2 -> controls -> recommendations` 渲染

1. `[P0][Page]` 页面成功加载后展示 L1 section、L2 section、control card 和 recommendation 列表
2. `[P0][Page]` 每个 control card 展示 `gapLevel`、`controlCode`、`controlName`
3. `[P1][Page]` recommendation 至少展示 action title / priority / expected benefit 等关键信息

#### AC2 - `reportId` 无效或无可读数据时显示明确空态 / not-found

4. `[P0][Page]` 当接口返回 `sections=[]` 时显示“暂无报告数据”空态
5. `[P0][Page]` 当接口抛错时显示错误提示，而不是混入项目摘要或静默空白

#### AC3 - 用户可从 control node 打开控制点详情抽屉

6. `[P0][Page]` 点击某个 control card 的“查看详情”按钮后，打开共享 drawer
7. `[P1][Page]` drawer 继续携带 `sourceModule='report'`、`sourceRecordId=reportId`

## Step 4 - Validation and Completion

### Validation Result

- 9.2 的主要交付是页面层消费和层级渲染，前端页面集成测试足以覆盖最高风险：`PASS`
- 当前已有 detail API 通路和 control drawer 入口，说明 9.2 可聚焦 recommendation 展示和详情态收敛：`PASS`

### Red Phase Intent

- 先补页面级 RED phase 覆盖，证明当前详情页尚不满足：
  - recommendation 层级展示
  - 更正式的空态 / 错误态语义
  - drawer 参数回归保护
- 测试应因“页面能力不完整”而失败，而不是因 route 不存在或类型缺失而失败。

### Key Risks / Assumptions

- 9.2 不应重新定义 `reportId`
- 当前 drawer 接线已存在，若在 9.2 中回退这条路径，会与 Epic 7 / 9 已建立 contract 冲突
- 若保留旧 e2e 路径假设不修，后续回归测试会继续指向已删除的临时 API 路径

### Next Step Recommendation

1. 先给 `/reports/[reportId]` 增加页面级测试和 detail API mock
2. 再补 recommendation 渲染和更明确的状态页
3. 如有必要，同步修正旧 e2e 对临时 API 路径的假设
