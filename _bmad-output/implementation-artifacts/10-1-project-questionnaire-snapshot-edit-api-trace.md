# Story 10.1 Traceability Matrix

Date: 2026-03-31
Story: 10-1-project-questionnaire-snapshot-edit-api
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- 授权用户可新增、删除或修改题目、选项和评分规则
- 修改持久化到项目级快照
- 不改写基础 question item 模板

Coverage:
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - draft lifecycle persistence
  - add/delete/reorder normalization
  - immutable template/source boundary
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
  - valid edit save
  - add/delete/reorder scenario
- `backend/src/modules/survey/survey.controller.ts`
  - draft save route

Result:
- PASS

### AC2

Requirement:
- 用户尝试修改 `questionType` 或 `controlId` 绑定关系时拒绝写入
- 返回明确校验错误

Coverage:
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - immutable binding validation
- `backend/src/modules/survey/project-questionnaire-snapshot.service.spec.ts`
  - immutable binding rejection assertion

Result:
- PASS

### AC3

Requirement:
- 更新内容不合法时拒绝写入
- 返回明确校验错误

Coverage:
- `backend/src/modules/survey/dto/project-questionnaire-snapshot.dto.ts`
  - nested DTO validation
- `backend/src/modules/survey/survey.controller.spec.ts`
  - invalid payload 400
  - forbidden 403
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - option / scoringRule / displayOrder validation

Result:
- PASS

## Validation Summary

- Backend targeted tests: PASS
- Backend build: PASS
- Frontend tests: N/A
- Fresh migration check: N/A (10.1 未新增 migration)
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - 前端真实保存/发布交互尚未接入，留待 10.2
