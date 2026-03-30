# Story 10.3 Traceability Matrix

Date: 2026-03-31
Story: 10-3-questionnaire-republish-downstream-stale-strategy
Status: PASS

## Acceptance Criteria Coverage

### AC1 / AC4

Requirement:
- 发布前明确提示对 gap analysis / action plan / report 的影响
- 用户确认后才真正发布

Coverage:
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - publish impact preview
- `backend/src/modules/survey/survey.controller.ts`
  - publish-impact route
- `frontend/app/projects/[projectId]/questionnaire/page.tsx`
  - impact confirm dialog
- `frontend/app/projects/[projectId]/questionnaire/__tests__/page.test.tsx`
  - publish confirm flow

Result:
- PASS

### AC2

Requirement:
- 问卷重发布后旧结果按策略 stale
- 不再被视为最新有效结果

Coverage:
- `backend/src/modules/survey/project-questionnaire-snapshot.service.ts`
  - freshness evaluation
- `backend/src/modules/compliance-intelligence/services/report-center.service.ts`
  - stale report center gating
- `backend/src/modules/compliance-intelligence/services/report-pdf.service.ts`
  - stale PDF rejection
- `backend/src/modules/survey/action-plan-generation.service.ts`
  - stale action-plan rejection
- `frontend/app/projects/[projectId]/gap-analysis/page.tsx`
  - stale alert
- `frontend/app/projects/[projectId]/action-plan/page.tsx`
  - stale alert
- `frontend/app/reports/[reportId]/page.tsx`
  - stale report entry

Result:
- PASS

### AC3

Requirement:
- 删除唯一问题后，后续 gap/report 仍保留 control 的“无评估数据”语义

Coverage:
- `backend/src/modules/survey/control-gap-input.service.ts`
  - unanswered controls stay in aggregation
- `backend/src/modules/compliance-intelligence/services/control-report-compiler.service.ts`
  - no-gap/no-remediation branch continues to emit control node / placeholder behavior
- Existing Story 9.4 placeholder + control report chain remains intact under 10.3 stale gating

Result:
- PASS

## Validation Summary

- Backend targeted tests: PASS
- Frontend targeted tests: PASS
- Backend build: PASS
- Frontend build: PASS
- E2E: NOT RUN

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
- Verification Gaps:
  - E2E 未执行
