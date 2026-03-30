# Story 10.1: 项目级问卷快照编辑 API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 问卷维护者，
I want 在项目级快照上真实编辑题目内容和评分规则，
so that 我可以针对具体项目修正题集，而不污染底层题库模板。

## Source References

- Parent PRD `V1-E01`
- Epic 10 `项目级问卷编辑与再发布`
- Existing project questionnaire snapshot flow from Story `6.4`
- Existing question set generation flow from Story `3.1`
- Existing project membership permission model from `ProjectsModule`

## Minimum Viable Scope

- 在现有 `ProjectQuestionnaireSnapshot` 运行时 contract 上引入项目级可编辑 draft 语义
- 后端提供“读取当前工作副本 / 保存草稿编辑”能力，不在 10.1 提前做 publish UI
- 允许修改字段仅限 `questionText`、`options`、`scoringRule`、`required`、`displayOrder`
- 明确拒绝修改 `questionType`、`controlId`、`questionItemTemplateId` 等绑定字段
- 允许新增/删除项目级题目，但新增题目必须显式绑定到已有 `controlId` 且其 `questionType` 一经创建不可再次变更
- 保存结果继续复用现有 `AITask + AIGenerationResult.selectedResult` 持久化，不新增独立问卷编辑表

## Acceptance Criteria

1. **Given** 某项目已存在问卷快照
   **When** 授权用户新增、删除或修改题目、选项和评分规则
   **Then** 系统将修改持久化到项目级快照
   **And** 不直接改写基础 question item 模板

2. **Given** 用户尝试修改题型或 `controlId` 绑定关系
   **When** 调用编辑 API
   **Then** 系统拒绝写入
   **And** 返回明确校验错误

3. **Given** 更新内容不合法
   **When** 调用编辑 API
   **Then** 系统拒绝写入
   **And** 返回明确校验错误

## Tasks / Subtasks

- [x] Task 1: 扩展 snapshot runtime contract，建立可编辑题目元数据与 lifecycle 基础字段（AC: 1, 2, 3）
  - [x] 为 snapshot question 增加稳定的项目级 question identity、`controlId`、`questionType`、`displayOrder`、`scoringRule` 和 template/source 元数据
  - [x] 为 snapshot metadata 增加 `draft / published / superseded` lifecycle 字段，确保后续 10.2 / 10.3 可直接复用
  - [x] 保持 6.4 现有读取 contract 向后兼容，不让问卷展示页与差距分析链路立即失效

- [x] Task 2: 实现后端“保存项目问卷草稿”编辑服务（AC: 1, 2, 3）
  - [x] 新增 DTO 和 validator，支持全量 question list 保存
  - [x] 保存时校验不可变字段：`questionType`、`controlId`、`questionItemTemplateId`
  - [x] 支持新增/删除/重排题目，并把持久化结果写回项目级 snapshot draft
  - [x] 对 options、scoringRule、required、displayOrder、questionText 的非法输入返回明确 4xx 错误

- [x] Task 3: 暴露受保护的 snapshot 编辑 API，并接入项目维护权限（AC: 1, 2, 3）
  - [x] 新增查询当前项目问卷工作副本的接口
  - [x] 新增保存项目问卷草稿的接口
  - [x] 仅允许项目 `OWNER / EDITOR` 执行保存类编辑操作
  - [x] 为读取/保存动作补齐审计日志

- [x] Task 4: 为 10.1 补齐后端测试护栏（AC: 1, 2, 3）
  - [x] service 测试覆盖合法编辑、新增/删除、displayOrder 重排
  - [x] service 测试覆盖非法修改 `questionType` / `controlId` / template binding`
  - [x] controller 测试覆盖鉴权、权限不足、请求校验失败与成功返回

## Dev Notes

### Story Requirements and Intent

- `10.1` 的本质不是“把前端本地 state 存回去”这么简单，而是先为 Epic 10 建立稳定的 snapshot 版本对象边界。
- 当前 6.4 把项目问卷快照当成“从 question set 派生出的一次性生成结果”；10.1 需要把它升级为“可持续维护的项目级运行时问卷版本”。
- 10.1 只做 backend API 与数据边界，不在本 Story 内提前承诺完整 publish / stale UX；但 lifecycle 字段必须现在就埋好，避免 10.2 / 10.3 再返工数据结构。

### Existing Implementation Snapshot

- 当前 `ProjectQuestionnaireSnapshotService.createSnapshot()` 会把 question set 映射为 `AITask(type=QUESTIONNAIRE) + AIGenerationResult.selectedResult.questionnaire`。
- 当前问题结构里只有：
  - `question_id`
  - `cluster_id`
  - `question_text`
  - `question_type`
  - `options`
  - `required`
  - `guidance`
- 当前结构缺少 10.1 必需的：
  - 项目级 question identity / source identity
  - `displayOrder`
  - 可回写 `scoringRule`
  - draft / published lifecycle 语义
  - 编辑版本审计/影响摘要

### Brownfield Guardrails

- 不新增独立数据库表，优先扩展已有 `AITask.input/result` 与 `AIGenerationResult.selectedResult.questionnaire_metadata`
- 不破坏 6.4 已上线的 `createProjectQuestionnaireSnapshot` / `getProjectQuestionnaireSnapshot` 基本读取能力
- 不让 `ControlGapInputService`、`MaturityAnalysisService`、`ReportCenterService` 因 10.1 的结构扩展而失去兼容性
- 不在 10.1 提前把“发布”动作塞进旧 `createSnapshot(regenerate)` 语义里
- 不用修改底层 `OrganizationQuestionSetService` 的题库模板数据来承载项目级改写

### Permission Model

- “项目维护权限”优先复用现有 `ProjectMembersService`
- 保存/后续发布均应要求 `ProjectMemberRole.OWNER` 或 `ProjectMemberRole.EDITOR`
- 只读获取接口可继续沿用当前组织级访问控制，但如果存在 draft，返回内容必须仍限定在当前项目与组织上下文内

### Candidate Source Tree Touchpoints

- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
- `backend/src/modules/survey/survey.controller.ts`
- `backend/src/modules/survey/dto/project-questionnaire-snapshot.dto.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
- `backend/src/modules/survey/survey.controller.spec.ts`
- `backend/src/modules/survey/control-gap-input.service.ts`
- `backend/src/modules/projects/services/project-members.service.ts`
- `backend/src/modules/survey/survey.module.ts`

### Data Model Direction

- 推荐继续以 `AITask(type=QUESTIONNAIRE)` 表示一个项目问卷版本
- `AIGenerationResult.selectedResult.questionnaire_metadata` 至少增加：
  - `lifecycleStatus: 'draft' | 'published' | 'superseded'`
  - `publishedSnapshotTaskId?`
  - `baseSnapshotTaskId?`
  - `displayOrderVersion`
  - `editVersion`
  - `lastEditedAt`
  - `lastEditedBy`
- 每个 question 至少增加：
  - `question_template_id` 或 `source_question_id`
  - `control_id`
  - `display_order`
  - `scoring_rule`
  - `is_project_custom`

### Testing Requirements

- 后端测试至少覆盖：
  - 保存合法草稿更新
  - 非法修改不可变字段时返回 400
  - 项目成员权限不足时返回 403
  - 保存后再读取，能取回同一份编辑后的 snapshot draft
- 10.1 不要求前端页面测试通过新交互，但现有 `frontend/lib/api/survey.test.ts` 如需扩 client contract，应同步补测

### Previous Story Intelligence

- **Story 3.1 (已完成)**：机构级 question set 已能生成结构化问题集，10.1 不应改写这一层的模板语义。
- **Story 6.4 (已完成)**：项目问卷页面已优先消费 snapshot；10.1 需要维持这个入口，但把 snapshot 从只读结果升级为可编辑版本。
- **Story 9.4 / report center（已完成）**：下游报告层以 `surveyResponse.questionnaireTaskId` 追踪报告来源，这会直接影响 10.3 的 stale 判断设计。

### References

- `D:\csaas\_bmad-output\planning-artifacts\epics.md`
- `D:\csaas\_bmad-output\implementation-artifacts\6-4-project-questionnaire-snapshot-integration.md`
- `D:\csaas\backend\src\modules\survey\project-questionnaire-snapshot.service.ts`
- `D:\csaas\backend\src\modules\survey\project-questionnaire-snapshot.service.spec.ts`
- `D:\csaas\backend\src\modules\survey\survey.controller.ts`
- `D:\csaas\backend\src\modules\survey\survey.controller.spec.ts`
- `D:\csaas\backend\src\modules\survey\control-gap-input.service.ts`
- `D:\csaas\backend\src\modules\projects\services\project-members.service.ts`
- `D:\csaas\frontend\app\projects\[projectId]\questionnaire\page.tsx`
- `D:\csaas\frontend\components\features\QuestionnaireResultDisplay.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: 创建 Story 10.1 的 ready-for-dev story packet，明确 Epic 10 先建设 snapshot version/lifecycle 基础，而不是直接把本地编辑 UI 持久化。
- 2026-03-31: 已将项目问卷 snapshot contract 扩展为 `draft / published / superseded` lifecycle，并为 question 增加 `question_template_id`、`control_id`、`display_order`、`scoring_rule` 等可编辑元数据。
- 2026-03-31: 已新增 `PUT /survey/project-questionnaire-snapshot/:projectId/draft`，支持全量保存项目问卷草稿，并通过 `ProjectMembersService` 限定 `OWNER / EDITOR` 才可写。
- 2026-03-31: 已补齐 service/controller 测试，覆盖合法编辑、不可变字段拒绝、新增/删除/重排、payload 校验和 403 权限拒绝。
- 2026-03-31: backend 定向验证已通过：`project-questionnaire-snapshot.service.spec.ts`、`survey.controller.spec.ts`、backend build。
- 2026-03-31: code review 结论 PASS，traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/10-1-project-questionnaire-snapshot-edit-api.md`
- `_bmad-output/implementation-artifacts/10-1-project-questionnaire-snapshot-edit-api-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-10-1.md`
- `_bmad-output/test-artifacts/code-review-story-10-1.md`
- `backend/src/modules/survey/dto/project-questionnaire-snapshot.dto.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
- `backend/src/modules/survey/survey.controller.ts`
- `backend/src/modules/survey/survey.controller.spec.ts`
- `backend/src/modules/survey/survey.module.ts`

## Change Log

- 2026-03-31: 创建 Story 10.1 story packet，补齐 lifecycle、编辑边界、权限模型与 brownfield guardrails。
- 2026-03-31: 扩展项目问卷 snapshot DTO / service / controller，引入 draft 保存能力、不可变字段校验与项目维护权限控制。
- 2026-03-31: 完成 backend service/controller 定向测试与 build 验证，并通过 code review / traceability gate。
