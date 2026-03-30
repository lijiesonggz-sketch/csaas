# Story 10.3: 问卷重发布与下游重算策略

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 项目负责人，
I want 在问卷修改后明确知道是否会影响差距分析和报告，
so that 我可以可控地重新发布，而不是让下游结果悄然失效。

## Source References

- Parent PRD `V1-E01`
- Epic 10 `项目级问卷编辑与再发布`
- Story `10.1` snapshot lifecycle + draft save API
- Story `10.2` questionnaire frontend save/publish flow
- Existing report center / report PDF freshness logic from Epic 9

## Minimum Viable Scope

- 发布前提供 publish impact 预览，明确说明哪些下游结果会 stale
- 发布时把本次 impact 持久化到最新 published snapshot metadata
- 以“surveyResponse 绑定的 questionnaireTaskId 是否仍等于当前 published snapshot”作为 stale 判定基础
- 对受影响的 downstream：
  - `gap-analysis` 页面显示 stale 提示与重新分析入口
  - `action-plan` 页面显示 stale 提示与跳转回差距分析入口
  - `report center / report detail / report pdf` 不再把旧 report 视为 ready
- 系统只做 stale 标记与入口提示，不自动触发重算

## Acceptance Criteria

1. **Given** 已发布的项目问卷再次被编辑
   **When** 用户准备重新发布
   **Then** 系统明确提示对 gap analysis、action plan、report 的影响
   **And** 用户确认后才执行重发布

2. **Given** 问卷重发布完成
   **When** 下游结果需要重新计算或标记失效
   **Then** 系统按既定策略触发重算或标记 stale
   **And** 不让旧结果继续被误认为最新有效结果

3. **Given** 用户删除了某控制点下唯一的问题并完成重发布
   **When** 后续生成 gap analysis 或 report
   **Then** 系统将该控制点标记为"无评估数据"
   **And** 不从控制报告中静默删除该控制点

4. **Given** 当前存在 republish in progress 的任务
   **When** 用户尚未确认影响
   **Then** 系统不会自动发布新问卷版本
   **And** 页面继续保留显式确认步骤

## Tasks / Subtasks

- [x] Task 1: 建立 publish impact 与 downstream freshness contract（AC: 1, 2, 4）
  - [x] 为 snapshot metadata 增加 `lastPublishedImpact`
  - [x] 新增 publish impact preview service / route
  - [x] 新增 surveyResponse freshness service / route
  - [x] 明确 `question_text / option_text / display_order` 只影响展示，不触发 stale；`question_added / question_removed / option_score / scoring_rule / required` 触发 stale

- [x] Task 2: 在问卷页加入发布前影响确认（AC: 1, 4）
  - [x] publish 前先持久化本地 draft，再请求 publish impact
  - [x] 显示影响对象和 change types
  - [x] 用户点击确认后才真正执行 publish

- [x] Task 3: 把 stale 判断接到下游结果消费层（AC: 2, 3）
  - [x] report center 列表将 stale report 标记为 `not_ready`
  - [x] report detail / remediation priority / pdf route 遇到 stale report 时显式失败
  - [x] action plan 生成服务拒绝基于 stale surveyResponse 再生成措施
  - [x] gap-analysis / action-plan 页面显示 stale 提示与重新生成入口

- [x] Task 4: 补齐 10.3 自动化测试与验证（AC: 1, 2, 3, 4）
  - [x] backend service/controller 覆盖 publish impact 与 freshness
  - [x] report center / report pdf service 覆盖 stale 路径
  - [x] questionnaire page / action-plan page / gap-analysis page 覆盖 stale or publish confirm UI

## Dev Notes

### Story Requirements and Intent

- 10.3 的关键不是“多一个确认弹窗”，而是要把 republish 影响固化为后端可判定、前端可消费的 contract。
- stale 判定必须落在运行时 authoritative source 上：`surveyResponse.questionnaireTaskId` 与当前 `published questionnaire snapshot` 的关系。
- 旧 surveyResponse 不应该因为问卷 republish 而被静默复用为“最新结果”。

### Implementation Summary

- `ProjectQuestionnaireSnapshotService` 新增：
  - `previewPublishImpact`
  - `evaluateDownstreamFreshness`
  - `evaluateDownstreamFreshnessForSurveyResponse`
  - `lastPublishedImpact` metadata 持久化
- `survey.controller.ts` 新增：
  - `GET /survey/project-questionnaire-snapshot/:projectId/publish-impact`
  - `GET /survey/questionnaire-freshness/:surveyResponseId`
- `questionnaire/page.tsx`：
  - publish 前先请求 impact
  - 用户确认后才真的 publish
- `gap-analysis/page.tsx`、`action-plan/page.tsx`：
  - 基于 freshness endpoint 显示 stale 提示
  - 提供重新分析/重生入口
- `report-center.service.ts` / `report-pdf.service.ts`：
  - stale report 不再被视作 ready
  - report detail/pdf 在 stale 时给出明确错误

### Brownfield Guardrails

- 不新增新表；stale impact 继续挂在 questionnaire snapshot metadata 上
- 不自动重跑 gap/report/action-plan，只做 stale 标记和入口提示
- 不删除旧 surveyResponse / report 数据，只停止把它们视作最新有效结果
- `control-gap-input` / control report 编译链仍保留“无评估数据”语义，不静默删除 control

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: 创建并完成 Story 10.3，补齐 republish impact preview、freshness contract 与下游 stale 入口提示。
- 2026-03-31: publish impact 已在问卷页执行前显式确认，不再直接提交 publish。
- 2026-03-31: report center / report pdf / action plan generation 已接入 stale 判断，旧结果不会再被误当成最新有效结果。
- 2026-03-31: `gap-analysis` 与 `action-plan` 页面已显示 stale 提示和重新生成入口。
- 2026-03-31: backend / frontend 定向测试与双端 build 均通过。
- 2026-03-31: code review 结论 PASS，traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/10-3-questionnaire-republish-downstream-stale-strategy.md`
- `_bmad-output/implementation-artifacts/10-3-questionnaire-republish-downstream-stale-strategy-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-10-3.md`
- `_bmad-output/test-artifacts/code-review-story-10-3.md`
- `backend/src/modules/survey/dto/project-questionnaire-snapshot.dto.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
- `backend/src/modules/survey/survey.controller.ts`
- `backend/src/modules/survey/survey.controller.spec.ts`
- `backend/src/modules/survey/action-plan-generation.service.ts`
- `backend/src/modules/compliance-intelligence/services/report-center.service.ts`
- `backend/src/modules/compliance-intelligence/services/report-pdf.service.ts`
- `backend/src/modules/compliance-intelligence/report-center.service.spec.ts`
- `backend/src/modules/compliance-intelligence/report-pdf.service.spec.ts`
- `frontend/lib/api/survey.ts`
- `frontend/lib/api/survey.test.ts`
- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
- `frontend/app/projects/[projectId]/gap-analysis/page.tsx`
- `frontend/app/projects/[projectId]/gap-analysis/__tests__/page.test.tsx`
- `frontend/app/projects/[projectId]/action-plan/page.tsx`
- `frontend/app/projects/[projectId]/action-plan/__tests__/page.test.tsx`
- `frontend/app/reports/[reportId]/page.tsx`

## Change Log

- 2026-03-31: 建立 publish impact / freshness contract，并把 stale 判定落到 questionnaire snapshot lifecycle 上。
- 2026-03-31: 问卷页新增 republish impact 确认；gap/action-plan/report 消费层接入 stale 提示或阻断。
- 2026-03-31: 完成 10.3 定向测试与双端 build 验证。
