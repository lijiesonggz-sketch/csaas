---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '10-1'
storyTitle: 项目级问卷快照编辑 API
inputDocuments:
  - 'D:\csaas\_bmad-output\implementation-artifacts\10-1-project-questionnaire-snapshot-edit-api.md'
  - 'D:\csaas\_bmad-output\implementation-artifacts\6-4-project-questionnaire-snapshot-integration.md'
  - 'D:\csaas\backend\src\modules\survey\project-questionnaire-snapshot.service.ts'
  - 'D:\csaas\backend\src\modules\survey\survey.controller.ts'
  - 'D:\csaas\backend\src\modules\survey\control-gap-input.service.ts'
  - 'D:\csaas\backend\src\modules\projects\services\project-members.service.ts'
---

# ATDD Checklist - Story 10.1: 项目级问卷快照编辑 API

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `auto`
- 项目级检测结果：`fullstack`
- Story 级测试焦点：`Backend Questionnaire Snapshot Lifecycle + Edit Validation + Permission Guard`

### Prerequisites Check

- Story 文档存在且 AC 清晰：`PASS`
- 当前 6.4 已提供项目级 snapshot create/get 能力，可作为 10.1 的增量基础：`PASS`
- 当前存在项目成员权限模型，可复用 `OWNER / EDITOR` 作为维护权限：`PASS`
- 当前 snapshot contract 缺少 lifecycle/edit metadata，说明 10.1 的 RED phase 合理：`PASS`

### Story Context Summary

- 10.1 的风险不在 CRUD 数量，而在“不能把项目级编辑误写回题库模板，也不能破坏既有 questionnaireTask 链路”。
- 保存 API 必须钉死不可变边界：`questionType`、`controlId`、template/source identity。
- 当前下游 gap/report 都依赖 `surveyResponse.questionnaireTaskId`，因此 10.1 的版本建模必须为 10.3 的 stale 判断预留空间。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 当前不存在项目级 snapshot 编辑 DTO / service / route，需要先补 backend RED phase
  - 10.1 的成功标准主要是 API contract、validation 和权限，不是前端页面渲染

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Backend Service + Controller`

### Acceptance Criteria to Scenario Mapping

#### AC1 - 授权用户新增、删除或修改题目/选项/评分规则后，系统持久化到项目级快照且不改写基础模板

1. `[P0][Service]` 保存合法编辑后，再次读取 snapshot draft 返回修改后的题目内容
2. `[P0][Service]` 新增项目级题目、删除题目、displayOrder 重排后持久化结果正确
3. `[P1][Controller]` 保存接口返回最新 snapshot version / lifecycle metadata

#### AC2 - 用户尝试修改 `questionType` 或 `controlId` 绑定关系时，系统拒绝写入并返回明确错误

4. `[P0][Service]` 修改既有题目的 `questionType` 被拒绝
5. `[P0][Service]` 修改既有题目的 `controlId` 被拒绝
6. `[P1][Controller]` 非法 payload 返回 400 并透出明确 message

#### AC3 - 更新内容不合法时，系统拒绝写入并返回明确校验错误

7. `[P0][Service]` 选项为空、displayOrder 冲突、required/scoringRule 非法组合返回 400
8. `[P1][Controller]` 无项目维护权限用户调用保存接口返回 403
9. `[P1][Controller]` DTO 非法输入（非 UUID、非布尔、额外字段）返回 400

## Step 4 - Validation and Completion

### Validation Result

- 10.1 的最小充分验证是：service 证明可保存合法编辑且拒绝非法字段；controller 证明鉴权和权限边界生效：`PASS`
- 由于本 Story 只做 backend API，前端交互和 publish UX 可留给 10.2 / 10.3：`PASS`

### Red Phase Intent

- 先补 backend RED phase，证明当前系统尚不满足：
  - 没有 snapshot 保存接口
  - 没有 lifecycle / draft 语义
  - 没有项目维护权限判断
  - 不能校验不可变 question binding

### Key Risks / Assumptions

- 继续使用 `AITask(type=QUESTIONNAIRE)` 表示一个项目级问卷版本，不新增独立表
- lifecycle metadata 需保证旧 snapshot 读取仍兼容 `6.4` 消费层
- 项目维护权限以 `ProjectMembersService` 为准，`OWNER / EDITOR` 可写，其他成员只读或拒绝

### Next Step Recommendation

1. 先写 `ProjectQuestionnaireSnapshotService` 的失败测试，钉住合法保存与非法字段拒绝
2. 再补 `SurveyController` 的 route / permission / payload 测试
3. 最后实现 lifecycle metadata、编辑保存逻辑和 route wiring
