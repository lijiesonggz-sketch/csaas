# Story 10.2 Traceability Matrix

Date: 2026-03-31
Story: 10-2-questionnaire-edit-frontend-persistence
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- 修改未保存时显示 dirty 状态
- 提供保存、发布、撤销等真实操作

Coverage:
- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
  - dirty state
  - save/publish/reset actions
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
  - dirty prompt
  - save flow
  - publish flow

Result:
- PASS

### AC2

Requirement:
- 保存或发布成功后显示最新持久化状态
- 刷新页面后仍能看到修改

Coverage:
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - publish lifecycle transition
- `backend/src/modules/survey/survey.controller.ts`
  - publish route
- `frontend/lib/api/survey.ts`
  - save draft / publish client
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
  - save updates to draft
  - publish updates to published

Result:
- PASS

### AC3

Requirement:
- 存在未保存修改时离开页面弹出确认
- 提供保存、放弃、取消三种选择

Coverage:
- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
  - `beforeunload`
  - leave confirmation dialog
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
  - leave confirmation + discard path

Result:
- PASS

## Validation Summary

- Backend targeted tests: PASS
- Frontend targeted tests: PASS
- Backend build: PASS
- Frontend build: BLOCKED by external Google Fonts `ECONNRESET`
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - frontend production build 受 `next/font` 外部网络拉取失败阻断
  - stale impact UX 仍待 10.3
