---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '10-2'
storyTitle: 问卷编辑前端持久化
inputDocuments:
  - 'D:\csaas\_bmad-output\implementation-artifacts\10-2-questionnaire-edit-frontend-persistence.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\10-1-project-questionnaire-snapshot-edit-api.md'
  - 'D:\csaas\frontend\app\projects\[projectId]\questionnaire\page.tsx'
  - 'D:\csaas\frontend\components\features\QuestionnaireResultDisplay.tsx'
  - 'D:\csaas\frontend\lib\api\survey.ts'
---

# ATDD Checklist - Story 10.2: 问卷编辑前端持久化

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Questionnaire Page Draft Persistence + Publish Flow + Unsaved Changes Prompt`

### Prerequisites Check

- Story 10.1 已完成 draft save backend 能力：`PASS`
- 当前问卷页已优先消费 snapshot，可作为 10.2 增量落点：`PASS`
- 当前页面存在“本地假保存”痕迹，说明 10.2 的 RED phase 明确：`PASS`

### Story Context Summary

- 10.2 的风险不在单个 API 调用，而在状态同步：本地 working copy、服务端 draft、published 只读状态、dirty 提示必须一致。
- 发布不能只是前端切 flag；必须把 backend lifecycle 真实切换为 published。
- 离开页面确认要同时覆盖浏览器刷新/关闭和页面内返回按钮。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时补 backend publish route 与前端页面状态流
  - 当前页面测试需要先证明 dirty/save/publish/leave prompt 尚未满足

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Frontend Page Integration + Backend Publish Service/Controller`

### Acceptance Criteria to Scenario Mapping

#### AC1 - 修改未保存时页面显示 dirty 状态，并提供保存、发布、撤销

1. `[P0][Page]` published 状态默认只读
2. `[P0][Page]` 进入编辑并修改后出现 dirty 提示
3. `[P1][Page]` 撤销未保存修改后 dirty 状态消失

#### AC2 - 保存或发布成功后显示最新持久化状态，刷新页面仍保留修改

4. `[P0][Page]` save 调用 draft API 并更新为最新 draft
5. `[P0][Page]` publish 调用 publish API 并更新为最新 published
6. `[P1][Backend]` publish service/controller 正确切换 lifecycle

#### AC3 - 存在未保存修改时，离开页面出现保存、放弃、取消三选一

7. `[P0][Page]` 点击返回且 dirty=true 时出现确认框
8. `[P1][Page]` 选择保存后先持久化再离开
9. `[P1][Page]` 选择放弃后丢弃本地未保存修改

## Step 4 - Validation and Completion

### Validation Result

- 10.2 只在页面里做本地状态切换是不够的，backend publish route 必须一并落地：`PASS`
- 现有 `QuestionnaireResultDisplay` 可作为编辑承载，但测试应以 page state flow 为主，不必被 MUI 细节绑死：`PASS`

### Red Phase Intent

- 先补 page/backend RED phase，证明当前系统尚不满足：
  - 没有 publish route
  - 页面没有真实 save/publish
  - dirty/leave prompt 不存在

### Key Risks / Assumptions

- publish 不需要新表，直接在 10.1 的 lifecycle metadata 上切换即可
- 页面离开确认至少覆盖浏览器 `beforeunload` 与页面内返回按钮
- 10.2 不负责 stale 影响解释，只负责真实 persistence 与 publish

### Next Step Recommendation

1. 先写 backend publish 的失败测试
2. 再写问卷页 dirty/save/publish/leave prompt 测试
3. 最后实现 lifecycle publish 与前端状态流
