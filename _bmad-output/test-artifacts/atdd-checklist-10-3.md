---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '10-3'
storyTitle: 问卷重发布与下游重算策略
inputDocuments:
  - 'D:\csaas\_bmad-output\implementation-artifacts\10-3-questionnaire-republish-downstream-stale-strategy.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\10-2-questionnaire-edit-frontend-persistence.md'
  - 'D:\csaas\backend\src\modules\survey\project-questionnaire-snapshot.service.ts'
  - 'D:\csaas\backend\src\modules\compliance-intelligence\services\report-center.service.ts'
  - 'D:\csaas\backend\src\modules\compliance-intelligence\services\report-pdf.service.ts'
  - 'D:\csaas\frontend\app\projects\[projectId]\questionnaire\page.tsx'
  - 'D:\csaas\frontend\app\projects\[projectId]\gap-analysis\page.tsx'
  - 'D:\csaas\frontend\app\projects\[projectId]\action-plan\page.tsx'
---

# ATDD Checklist - Story 10.3: 问卷重发布与下游重算策略

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Publish Impact Preview + Downstream Freshness + Stale UX`

### Prerequisites Check

- Story 10.1 draft save 基础存在：`PASS`
- Story 10.2 publish 与 page persistence 已完成：`PASS`
- report/action-plan/gap-analysis 都有现成消费页可增量接 stale 提示：`PASS`

### Story Context Summary

- 10.3 的 authoritative source 是 `surveyResponse.questionnaireTaskId` 与当前 published questionnaire snapshot 的关系。
- stale 不是删除旧结果，而是阻止旧结果继续被当成“最新有效”。
- publish impact 需要在用户确认前可见，不能先 publish 再解释。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时调整 backend freshness contract、report chain、questionnaire publish flow 和 downstream pages
  - 当前系统尚无统一 stale contract

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Backend Service + Controller + Frontend Page Integration`

### Acceptance Criteria to Scenario Mapping

#### AC1 / AC4 - 发布前必须显式提示影响并等待确认

1. `[P0][Service]` publish impact preview 返回 staleTargets / changeTypes / message
2. `[P0][Page]` questionnaire publish 先拿 impact，再确认后发布

#### AC2 - 重发布后旧结果不再被视为最新有效结果

3. `[P0][Service]` freshness contract 在旧 surveyResponse 上返回 `isStale=true`
4. `[P0][Report]` report center / pdf service 对 stale report 停止 ready
5. `[P1][Page]` action-plan / gap-analysis 页显示 stale 提示和重新生成入口

#### AC3 - 删除唯一问题后不静默删除 control

6. `[P1][Compiler Chain]` 继续保留无评估数据语义，不从 control report 中静默删除 control

## Step 4 - Validation and Completion

### Validation Result

- publish impact + freshness contract 已能支撑 10.3 的 UI 与 downstream stale 统一口径：`PASS`
- 现有 report/action-plan/gap-analysis 页面都可以通过增量提示满足“明确失效提示与入口”要求：`PASS`

### Next Step Recommendation

1. 先写 snapshot service/controller 的 preview/freshness 测试
2. 再补 report center/report pdf stale 路径测试
3. 最后补 questionnaire/gap/action-plan 页面 stale or confirm 测试
