# Story 9.1 Traceability Matrix

Date: 2026-03-30
Story: 9-1-report-center-aggregate-page
Status: PASS

## Acceptance Criteria Coverage

### AC1

Requirement:
- 访问 `/reports` 后展示项目摘要、最新差距结果、风险摘要、报告状态和详情入口
- 支持按项目、时间或状态筛选

Coverage:
- `backend/src/modules/compliance-intelligence/report-center.service.spec.ts`
  - ready item summary generation
  - project/status/date filter behavior
- `backend/src/modules/compliance-intelligence/report-center.controller.spec.ts`
  - aggregate response contract
- `frontend/app/reports/page.test.tsx`
  - render report center items
  - refetch when status filter changes

Result:
- PASS

### AC2

Requirement:
- 无可读报告数据时显示清晰空态，不误判为加载失败

Coverage:
- `backend/src/modules/compliance-intelligence/report-center.service.spec.ts`
  - project without survey -> `not_ready`
- `frontend/app/reports/page.test.tsx`
  - item-level empty-state messaging
  - global empty state when no items are returned

Result:
- PASS

### AC3

Requirement:
- 报告状态统一采用 `not_ready`、`ready_to_generate`、`generating`、`ready`、`failed`

Coverage:
- `backend/src/modules/compliance-intelligence/dto/report-center-query.dto.ts`
  - legal status enum
- `backend/src/modules/compliance-intelligence/services/report-center.service.ts`
  - status derivation path
- `backend/src/modules/compliance-intelligence/report-center.controller.spec.ts`
  - contract response includes `reportStatus`

Result:
- PASS

### AC4

Requirement:
- 点击“查看报告”跳转到 `/reports/[reportId]`
- `reportId` 与后续详情页 contract 一致

Coverage:
- `frontend/app/reports/page.test.tsx`
  - ready item navigation to `/reports/survey-ready`
- `frontend/lib/api/report-center.ts`
  - detail fetch contract
- `frontend/app/reports/[reportId]/page.tsx`
  - detail page consumes protected report detail endpoint
- `backend/src/modules/compliance-intelligence/report-center.service.spec.ts`
  - detail compile uses `surveyResponseId = reportId`
- `backend/src/modules/compliance-intelligence/report-center.controller.spec.ts`
  - detail route contract

Result:
- PASS

## Validation Summary

- Backend tests: PASS
- Frontend page tests: PASS
- Frontend build: PASS
- Backend build: PASS

## Gate Decision

- Decision: PASS
- Blocking Gaps: none
