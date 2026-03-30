# Story 10.2: 问卷编辑前端持久化

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 项目负责人，
I want 在前端真正保存和发布问卷编辑结果，
so that 我不再依赖仅存在于本地 state 的“假保存”。

## Source References

- Parent PRD `V1-E01`
- Epic 10 `项目级问卷编辑与再发布`
- Story `10.1` snapshot lifecycle + draft save API
- Existing questionnaire page from Story `6.4`
- Existing local draft / unsaved prompt pattern from Story `8.6`

## Minimum Viable Scope

- 问卷页区分 `draft` 与 `published` 两种项目快照状态
- `published` 版本默认只读；用户进入编辑模式后可在前端修改本地 working copy
- 保存调用 10.1 backend draft API；如当前是 published，则首次保存自动创建 draft 副本
- 发布调用新 backend publish API，将当前 draft 提升为 published，并把旧 published 标记为 superseded
- 提供真实的脏状态提示、保存、发布、撤销和离开页面确认
- 不在 10.2 提前接入 stale 影响解释面板，那是 10.3 的职责

## Acceptance Criteria

1. **Given** 用户在问卷页面修改了快照内容
   **When** 尚未保存
   **Then** 页面展示脏状态提示
   **And** 提供保存、发布、撤销等真实操作

2. **Given** 用户执行保存或发布
   **When** 操作成功
   **Then** 系统显示最新持久化状态
   **And** 刷新页面后仍能看到刚才的修改

3. **Given** 页面存在未保存修改
   **When** 用户尝试离开页面
   **Then** 系统展示未保存变更提示
   **And** 提供保存、放弃、取消离开三种选择

## Tasks / Subtasks

- [x] Task 1: 补齐 backend publish 能力，完成 draft/published 切换（AC: 2）
  - [x] 在 snapshot service 中新增 publish draft 方法
  - [x] 发布时将当前 draft 提升为 published，并把旧 published 标记为 superseded
  - [x] 仅允许 `OWNER / EDITOR` 发布
  - [x] controller route 与测试补齐

- [x] Task 2: 重构问卷页状态模型，接入真实 draft 保存流（AC: 1, 2）
  - [x] 页面加载后基于 snapshot `lifecycleStatus` 区分只读 published 与可编辑 draft
  - [x] 本地 working copy 不再是“本地假保存”，而是调用 10.1 draft save API
  - [x] 保存成功后刷新为服务端返回的最新 snapshot，并清空 dirty 状态
  - [x] 发布成功后页面切回最新 published 状态

- [x] Task 3: 接入脏状态提示、撤销和离开页面确认（AC: 1, 3）
  - [x] 对浏览器刷新/关闭使用 `beforeunload` 提示
  - [x] 对页面内“返回”操作使用显式三选一确认框：保存、放弃、取消
  - [x] 撤销只回滚未保存本地修改，不删除已持久化 draft

- [x] Task 4: 补齐前端 API 和页面测试（AC: 1, 2, 3）
  - [x] `frontend/lib/api/survey.ts` 增加 save draft / publish client
  - [x] `frontend/lib/api/survey.test.ts` 覆盖新 client contract
  - [x] `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx` 覆盖 dirty/save/publish/leave prompt

## Dev Notes

### Story Requirements and Intent

- `10.2` 不是“补一个保存按钮”而已，而是把现有问卷页从只读生成结果升级为真正的项目维护页面。
- 当前 `QuestionnaireResultDisplay` 已经有局部本地编辑痕迹，但保存只会弹 “本地保存” toast；这正是 10.2 要消除的假状态。
- 10.2 必须继续使用 10.1 的 lifecycle 建模，不允许前端绕开 backend 自己维护 draft/published。

### Existing Implementation Snapshot

- 当前问卷页：
  - 优先读取 `getProjectQuestionnaireSnapshot`
  - 若无 snapshot 再回退 legacy task flow
  - 只展示 `重新生成`，没有 save/publish
- 当前 `QuestionnaireResultDisplay`：
  - 内部维护 `editedQuestions`
  - `handleSaveQuestion()` 只关闭编辑并 toast“题目编辑已保存（本地）”
  - 没有把编辑内容回传给页面，也没有后端 persistence

### Brownfield Guardrails

- 保留 6.4 的 “优先 snapshot，缺失时回退 legacy” 读取主路径
- 不重写整个问卷页面布局；重点替换状态流和动作区
- 不把 10.3 的 stale 影响提示硬塞进 10.2
- 不新增全局状态库；页面内 state 即可

### Candidate Source Tree Touchpoints

- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
- `frontend/components/features/QuestionnaireResultDisplay.tsx`
- `frontend/lib/api/survey.ts`
- `frontend/lib/api/survey.test.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
- `backend/src/modules/survey/survey.controller.ts`
- `backend/src/modules/survey/survey.controller.spec.ts`

### Testing Requirements

- 前端页面测试至少覆盖：
  - published 状态默认只读
  - 进入编辑并修改后出现 dirty 提示
  - save 调用 draft API，返回后 dirty 消失
  - publish 调用 publish API，返回后页面状态更新
  - 点击返回且 dirty=true 时出现三选一确认
- backend 至少覆盖 publish route/service 的 happy path 与 403 拒绝

### Previous Story Intelligence

- **Story 6.4 (已完成)**：问卷页已经优先消费 snapshot，这是 10.2 的直接承载页。
- **Story 8.6 (已完成)**：仓库里已有本地草稿与恢复提示模式，可复用其 unsaved/restore 交互思路。
- **Story 10.1 (已完成)**：backend 已支持保存 draft 和 lifecycle 元数据扩展，是 10.2 的基础依赖。

### References

- `D:\csaas\_bmad-output\planning-artifacts\epics.md`
- `D:\csaas\_bmad-output\implementation-artifacts\6-4-project-questionnaire-snapshot-integration.md`
- `D:\csaas\_bmad-output\implementation-artifacts\8-6-review-edit-context-autosave-and-restore.md`
- `D:\csaas\_bmad-output\implementation-artifacts\10-1-project-questionnaire-snapshot-edit-api.md`
- `D:\csaas\frontend\app\projects\[projectId]\questionnaire\page.tsx`
- `D:\csaas\frontend\app\projects\[projectId]\questionnaire\__tests__\page.test.tsx`
- `D:\csaas\frontend\components\features\QuestionnaireResultDisplay.tsx`
- `D:\csaas\frontend\lib\api\survey.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: 创建 Story 10.2 的 ready-for-dev story packet，明确 10.2 同时承担 backend publish + frontend persistence，而不是只改按钮文案。
- 2026-03-31: 已在 backend snapshot service/controller 增加 publish route，把最新 draft 提升为 published，并把旧 published 标记为 superseded。
- 2026-03-31: 问卷页已接入真实 draft working copy、保存草稿、发布问卷、撤销修改和离开页面确认，不再依赖 “题目编辑已保存（本地）” 的假状态。
- 2026-03-31: `QuestionnaireResultDisplay` 已可把本地编辑结果回传页面状态；page 层统一管理 dirty/save/publish 流。
- 2026-03-31: 前端定向验证已通过：`survey.test.ts`、`questionnaire/page.test.tsx`、`QuestionnaireResultDisplay.test.tsx`。
- 2026-03-31: backend 定向验证已通过：`project-questionnaire-snapshot.service.spec.ts`、`survey.controller.spec.ts`、backend build。
- 2026-03-31: frontend build 未能完成，阻塞原因为 `next/font` 拉取 Google `Inter` 字体时持续 `ECONNRESET`，不是本次代码编译错误。
- 2026-03-31: code review 结论 PASS，traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/10-2-questionnaire-edit-frontend-persistence.md`
- `_bmad-output/implementation-artifacts/10-2-questionnaire-edit-frontend-persistence-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-10-2.md`
- `_bmad-output/test-artifacts/code-review-story-10-2.md`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
- `backend/src/modules/survey/survey.controller.ts`
- `backend/src/modules/survey/survey.controller.spec.ts`
- `frontend/lib/api/survey.ts`
- `frontend/lib/api/survey.test.ts`
- `frontend/components/features/QuestionnaireResultDisplay.tsx`
- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`

## Change Log

- 2026-03-31: 创建 Story 10.2 story packet，补齐 draft/published 状态模型、离开提示与 brownfield guardrails。
- 2026-03-31: 新增 backend publish route，并在问卷页接入真实 save/publish/dirty/leave prompt 状态流。
- 2026-03-31: 完成前后端定向测试；frontend build 因 Google Fonts 网络拉取失败受阻，已记录为环境性验证缺口。
