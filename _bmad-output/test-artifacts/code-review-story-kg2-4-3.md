# Code Review - Story KG2 4.3

## Scope

- backend/src/modules/knowledge-graph/controllers/obligation.controller.ts
- backend/src/modules/knowledge-graph/dto/obligation.dto.ts
- backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts
- backend/src/modules/knowledge-graph/services/obligation.service.spec.ts
- backend/src/modules/knowledge-graph/services/obligation.service.ts
- frontend/lib/api/obligations.ts
- frontend/lib/api/obligations.test.ts
- frontend/app/admin/obligations/page.tsx
- frontend/app/admin/obligations/page.test.tsx
- frontend/components/layout/Sidebar.tsx
- frontend/components/layout/__tests__/Sidebar.test.tsx
- frontend/e2e/obligation-management.spec.ts

## Findings

No blocking findings.

## Residual Risks

- The new Playwright smoke spec exists, but local execution was blocked by unstable first-response behavior from the current Next dev server on `/admin/obligations`. This is an environment/runtime issue, not a code defect proven by the review.
- `CreateObligationControlMapDto` now tolerates an optional body `obligationId` because the nested route takes the authoritative id from the path. This is acceptable, but future API cleanup could introduce a dedicated nested-route DTO to make the contract stricter.

## Conclusion

- Clean review for the implemented story scope.
- Recommended next step: run traceability / gate decision and then mark the story done if no coverage gaps remain.
