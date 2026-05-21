# Story 3.7: Contextual Recommendations with CSAAS Data Fallback

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want recommendations to use available CSAAS maturity and compliance data,
so that advice is more relevant while still working when integration data is unavailable.

## Acceptance Criteria

1. Given CSAAS IT maturity or compliance data is available within the response-time threshold, when Quick Consult generates recommendations, then the recommendation context includes the available enterprise signals and the user can see that recommendations are using enterprise context.
2. Given CSAAS data is unavailable, errors, or exceeds 2 seconds, when recommendations are generated, then the system falls back to generic recommendation mode and the UI clearly indicates that enterprise data is temporarily unavailable.
3. Given enterprise background completeness is low, when recommendations are shown, then the system prompts the user to add missing context that would improve recommendation precision and the prompt does not block the user from continuing.

## Tasks / Subtasks

- [x] Add Story 3.7 ATDD coverage before production code (AC: 1-3)
  - [x] Create `_bmad-output/test-artifacts/atdd-checklist-3-7-contextual-recommendations-with-csaas-data-fallback.md`.
  - [x] Add backend RED coverage for available CSAAS enterprise signals, unavailable/error/timeout fallback, privacy-safe metadata, tenant scoping, and low-completeness guidance.
  - [x] Add frontend RED coverage for enterprise-context visible indicator, generic-mode warning, non-blocking context-completion prompt, and proxy/client normalization.
  - [x] Keep ATDD deterministic; no live CSAAS API, browser, GLM, provider, Redis, or external network dependency is required.

- [x] Introduce a narrow CSAAS enterprise signal integration boundary (AC: 1-2)
  - [x] Add an advisory-owned boundary under `backend/src/modules/advisory/integration/` such as `csaas-enterprise-signals.service.ts`.
  - [x] Expose a port-style API that returns only tenant/organization-scoped IT maturity and compliance signals needed for recommendation context.
  - [x] Use trusted `tenantId` and `organizationId` from server-side request context; never accept these from the browser payload.
  - [x] Enforce a hard 2-second deadline for CSAAS signal loading and prefer a shorter internal target for happy path (<500ms per NFR20).
  - [x] When real CSAAS data is unavailable in local MVP, use a fake/no-data adapter behind the same port for deterministic tests; do not couple Quick Consult directly to undeclared external CSAAS APIs.

- [x] Merge enterprise signals into Quick Consult recommendation context (AC: 1-2)
  - [x] Extend `QuickConsultMethodRecommendationService.generateRecommendations()` input to include an enterprise signal context in addition to Story 3.6 `organizationContext`.
  - [x] Rank or annotate recommendations using available maturity/compliance signals without removing the existing classification-driven fallback ranking.
  - [x] Return a stable response field such as `enterpriseContext` or `recommendationContext` with `mode`, `signalsApplied`, `sources`, `fallbackReason`, and `missingOrganizationContextFields`.
  - [x] Persist only safe operational markers in `AdvisoryQuickConsultContext.metadata`; do not store raw CSAAS report content, questionnaire answers, raw problem text, prompts, or provider output.
  - [x] Emit telemetry/audit metadata with counts/status only, not sensitive enterprise signal payloads.

- [x] Add generic-mode fallback behavior (AC: 2)
  - [x] Treat no data, thrown errors, malformed data, missing organization id, and timeout >2 seconds as `generic` or `degraded` recommendation context mode.
  - [x] Ensure fallback still returns the normal Quick Consult classification, analysis preview, and 2-3 method recommendations when confidence is high enough.
  - [x] Add tests proving fallback does not mark the entire Quick Consult as failed and does not leak exception messages or tenant B signal existence.

- [x] Add low-completeness guidance from existing organization context metadata (AC: 3)
  - [x] Reuse Story 3.6 `AdvisoryOrganizationContextService.getPromptContext()` completeness metadata.
  - [x] If saved organization context is absent or completeness is low, return a non-blocking `contextCompletionPrompt` with missing fields and a settings/dialog action hint.
  - [x] Do not re-open or block the first-use dialog solely because CSAAS data is unavailable; this story owns a recommendation precision hint, not a hard gate.

- [x] Update frontend client, proxy, and recommendation UI (AC: 1-3)
  - [x] Extend `frontend/lib/advisory/quick-consult.ts` normalization for the new recommendation context/generic-mode fields.
  - [x] Keep `frontend/app/api/advisory/quick-consult/start/route.ts` payload whitelisting unchanged except for forwarding trusted backend response fields; do not forward caller-supplied tenant, organization, or signal data.
  - [x] Update `frontend/components/advisory/QuickConsultProblemIntake.tsx` to show:
    - enterprise-context applied indicator when signals are used,
    - generic-mode warning when CSAAS data is unavailable/degraded,
    - non-blocking context completion prompt when completeness is low.
  - [x] Keep UI accessible with `role="status"` / `role="alert"` where appropriate, visible text that does not rely on color alone, and no production `data-testid`.

- [x] Run focused verification and update evidence (AC: 1-3)
  - [x] Run backend integration/recommendation focused tests and TypeScript validation.
  - [x] Run frontend Quick Consult focused tests and TypeScript validation.
  - [x] Record exact commands and outcomes in the Dev Agent Record.

## Dev Notes

### Source Requirements

- Story 3.7 requires Quick Consult recommendations to include available CSAAS IT maturity or compliance data, and to show users that recommendations are using enterprise context. [Source: `_bmad-output/planning-artifacts/epics.md:1044`]
- If CSAAS data is unavailable, errors, or exceeds 2 seconds, the system must fall back to generic recommendation mode and clearly indicate that enterprise data is temporarily unavailable. [Source: `_bmad-output/planning-artifacts/epics.md:1059`]
- Low enterprise background completeness must trigger a non-blocking prompt to add missing context. [Source: `_bmad-output/planning-artifacts/epics.md:1064`]
- PRD requires contextual recommendations from enterprise background, IT maturity, and compliance data, while preserving standalone use when CSAAS data is absent. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md:31`, `_bmad-output/planning-artifacts/thinktank-prd.md:641`, `_bmad-output/planning-artifacts/thinktank-prd.md:668`]
- CSAAS IT maturity and compliance integrations are P1 read-only integrations; manual enterprise background remains available to all tiers and automatic sync is tiered later. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md:451`, `_bmad-output/planning-artifacts/thinktank-prd.md:464`, `_bmad-output/planning-artifacts/thinktank-prd.md:482`]
- NFR20 requires CSAAS data reads under 500ms when available; NFR21 requires automatic fallback to generic mode when CSAAS API response exceeds 2 seconds or errors, with UI wording: `当前使用通用推荐模式，企业背景数据暂时不可用`. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md:708`]

### Scope Boundaries

| Capability | Owning story |
| --- | --- |
| Problem intake, classification, recommendation cards, manual browsing, feedback | Stories 3.1-3.5 |
| Manual enterprise background capture and maintenance | Story 3.6 |
| CSAAS IT maturity/compliance signal loading, contextual recommendation indicators, generic-mode warning, low-completeness prompt | Story 3.7 |
| Full subscription-tier enforcement for automatic CSAAS sync | Post-MVP / later commercial scope |
| Report rating/favorites/assets | Story 4.4 |
| Report reuse in enterprise knowledge base | Story 4.5 |

Do not add a new marketing page, admin dashboard, or deep CSAAS sync workflow in this story. Implement the smallest reusable port and recommendation-context contract that lets Quick Consult consume available signals and degrade safely.

### Architecture Compliance

- CSAAS enterprise data is an optional enhancement and must not be a module availability prerequisite. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:65`]
- Architecture explicitly requires graceful degradation when CSAAS data is missing or API calls fail. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:79`]
- MVP degradation should be simple: CSAAS API timeout >2s directly uses generic recommendation mode. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:338`]
- ThinkTank-owned backend code belongs under `backend/src/modules/advisory/`; CSAAS integration belongs under an advisory `integration/` boundary, not scattered through Quick Consult logic. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:981`, `_bmad-output/planning-artifacts/architecture-thinktank.md:1014`]
- API responses should continue using the existing `{ data, meta? }` / error envelope conventions and frontend normalization. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md:557`]
- Tests must preserve tenant isolation via trusted server context; browser payload must not supply tenant or organization identity. [Source: `_bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md:9`]

### Previous Story Intelligence

- Story 3.6 already introduced `organization_context`, `AdvisoryOrganizationContextService.getPromptContext(tenantId)`, backend `org-context/`, frontend organization-context client/proxy/Dialog, first-use gate, settings edit surface, and Quick Consult/workflow prompt-context wiring.
- Story 3.6 deliberately did not implement CSAAS data sync or generic-mode warning; its Dev Agent Record calls this out as Story 3.7 scope.
- Current backend Quick Consult flow loads organization context with `loadOrganizationPromptContext(tenantId)` and already degrades to `null` on organization-context service failure.
- Current `QuickConsultMethodRecommendationService` ranks recommendations by problem classification and appends a simple `已结合企业背景` rationale when `organizationContext` is present.
- Current frontend `QuickConsultProblemIntake.tsx` already renders classification, recommendation cards, source refs, manual browse, recommendation feedback, and first-use gate through `onBeforeStartQuickConsult`.

### Backend Implementation Guidance

- Recommended files:
  - `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.ts`
  - `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.spec.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult.service.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult.service.spec.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.ts`
  - `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.spec.ts`
  - `backend/src/modules/advisory/advisory.module.ts`
- Reuse existing CSAAS data surfaces when practical:
  - `backend/src/modules/survey/maturity-analysis.service.ts` calculates maturity analysis from submitted survey responses.
  - `backend/src/modules/organizations/weakness-snapshot.service.ts` stores organization weakness categories and levels.
  - `backend/src/modules/organizations/organizations.service.ts` exposes organization profile completeness.
  - `backend/src/modules/compliance-intelligence/services/report-center.service.ts` summarizes latest report maturity/gap/risk data.
- If importing a broad module causes circular dependencies or heavy runtime setup, use a port plus fake/no-data adapter for MVP and keep the code path ready for a future concrete CSAAS adapter.
- Suggested response shape:

```ts
type QuickConsultRecommendationContextMode = 'enterprise' | 'generic'

interface QuickConsultRecommendationContext {
  mode: QuickConsultRecommendationContextMode
  signalsApplied: string[]
  sources: Array<'organization_context' | 'csaas_it_maturity' | 'csaas_compliance'>
  fallbackReason?: 'no_organization' | 'no_data' | 'timeout' | 'error' | 'malformed'
  contextCompletionPrompt?: {
    missingFields: string[]
    message: string
    action: 'open_enterprise_background_settings'
  }
}
```

- Use safe summaries only. Acceptable recommendation payload examples: `overallMaturity`, `topShortcomings`, `riskThemes`, `complianceGapLevel`, `latestReportStatus`, `sourceFreshness`. Unacceptable payload examples: raw questionnaire answers, raw control report sections, raw uploaded documents, full prompts, provider messages.
- Preserve the existing failure distinction:
  - Recommendation service failure can still fail Quick Consult if the recommendation catalog itself breaks.
  - CSAAS enterprise signal failure must not fail Quick Consult; it should set context mode to `generic`.

### Frontend Implementation Guidance

- Recommended files:
  - `frontend/lib/advisory/quick-consult.ts`
  - `frontend/lib/advisory/quick-consult.test.ts`
  - `frontend/app/api/advisory/quick-consult/start/route.ts`
  - `frontend/app/api/advisory/quick-consult/start/route.test.ts`
  - `frontend/components/advisory/QuickConsultProblemIntake.tsx`
  - `frontend/components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx`
- The enterprise-context indicator should sit near recommendation cards, not as a separate landing page or nested card-in-card layout.
- Generic-mode warning text should be clear and non-alarming. Required wording from PRD/NFR21 may be used exactly: `当前使用通用推荐模式，企业背景数据暂时不可用`.
- Low-completeness prompt should be non-blocking and should offer a clear settings/background action, but the user must still be able to accept recommendations or manually browse methods.
- Keep existing buttons icon-led with lucide icons where a suitable icon exists, and preserve compact dashboard styling.

### Testing Requirements

- Follow TDD: add ATDD RED artifacts before production code.
- Backend focused commands:
  - `cd backend && npm run test -- src/modules/advisory/integration src/modules/advisory/quick-consult --runInBand`
  - `cd backend && npx tsc --noEmit --pretty false`
- Frontend focused commands:
  - `cd frontend && npm run test -- lib/advisory/quick-consult.test.ts app/api/advisory/quick-consult/start components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx --runInBand`
  - `cd frontend && npx tsc --noEmit --pretty false`
- Tests must assert:
  - available CSAAS maturity/compliance signals are included in recommendation context;
  - recommendations visibly indicate enterprise context usage;
  - CSAAS signal loader timeout/error/no-data returns generic mode without failing Quick Consult;
  - generic-mode warning is visible and accessible;
  - low completeness returns a non-blocking context completion prompt;
  - tenant A cannot read, infer, or receive tenant B maturity/compliance/gap signals;
  - frontend proxy does not forward browser-supplied tenant, organization, signal, maturity, or compliance payload fields;
  - telemetry/audit metadata contains status/counts only, not raw enterprise signal details.

### Latest Technical Notes

- Local stack versions: NestJS 10.4.x, TypeORM 0.3.20, Next.js 14.2.x, React 18.3.x, TypeScript 5.6.x, Jest 29.7.x. Match repo versions and avoid dependency upgrades.
- NestJS HTTP integrations should keep route/controller handlers thin and move timeout/fallback behavior into injectable providers.
- Next.js 14 Route Handlers live under `app/**/route.ts` and export HTTP method functions such as `GET`/`POST`.
- For deadlines, prefer deterministic Promise/AbortController-style timeout wrappers around the port call so tests can simulate timeout without sleeping for 2 real seconds.

### Project Structure Notes

- Actual repository layout for this story:
  - `backend/src/modules/advisory/integration/`
  - `backend/src/modules/advisory/quick-consult/`
  - `backend/src/modules/advisory/org-context/`
  - `backend/src/modules/advisory/sessions/`
  - `backend/src/modules/survey/`
  - `backend/src/modules/organizations/`
  - `backend/src/modules/compliance-intelligence/`
  - `frontend/components/advisory/`
  - `frontend/lib/advisory/`
  - `frontend/app/api/advisory/quick-consult/start/`
- No `project-context.md` exists in the current repo; use `.claude/claude.md`, planning artifacts, Story 3.6, and current advisory implementations as project context.

### References

- `_bmad-output/planning-artifacts/epics.md:1044` - Story 3.7 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md:641` - FR38-FR39 contextual enterprise background.
- `_bmad-output/planning-artifacts/thinktank-prd.md:668` - CSAAS integration degrades when data unavailable.
- `_bmad-output/planning-artifacts/thinktank-prd.md:708` - NFR20/NFR21 response-time and generic-mode warning.
- `_bmad-output/planning-artifacts/architecture-thinktank.md:338` - MVP CSAAS timeout fallback.
- `_bmad-output/implementation-artifacts/3-6-enterprise-background-capture-and-maintenance.md` - previous story context and implementation evidence.
- `backend/src/modules/advisory/quick-consult/quick-consult.service.ts` - current Quick Consult orchestration and safe organization-context fallback.
- `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.ts` - current recommendation ranking/rationale.
- `backend/src/modules/advisory/org-context/advisory-organization-context.service.ts` - current organization context completeness and prompt context.
- `frontend/lib/advisory/quick-consult.ts` - current Quick Consult response normalization.
- `frontend/components/advisory/QuickConsultProblemIntake.tsx` - current recommendation UI and feedback surface.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-21: Story context created from Epic 3 Story 3.7, PRD FR5/FR38/FR39/FR53/FR54, NFR20/NFR21, ThinkTank architecture degradation guidance, Story 3.6 completion notes, and current advisory backend/frontend implementation.
- 2026-05-21: Current repo scan confirmed sprint status listed `3-7-contextual-recommendations-with-csaas-data-fallback: backlog` and no existing Story 3.7 implementation artifact was present.
- 2026-05-21: Latest technical reference check completed against official Next.js 14 Route Handler docs, NestJS HTTP module docs, and timeout/deadline guidance; repo package versions remain the implementation source of truth.
- 2026-05-21: ATDD generated 15 Story 3.7 tests across backend integration/service/recommendation and frontend client/proxy/component coverage, then DEV green phase removed skips and made them pass.
- 2026-05-21: Implemented `CsaasEnterpriseSignalsService` with trusted tenant/organization scoping, malformed/error/no-data/missing-organization/timeout fallback, and privacy-safe summaries.
- 2026-05-21: Threaded enterprise signals through Quick Consult recommendation generation, response context, metadata, and audit markers without storing raw CSAAS payloads.
- 2026-05-21: Added frontend normalization and accessible recommendation-section indicators for enterprise context, generic fallback, and low-completeness guidance.
- 2026-05-21: Verification passed: backend focused Jest, frontend focused Jest, backend TypeScript, frontend TypeScript, backend full Jest, and frontend full Jest.
- 2026-05-21: TEA traceability completed with Gate Decision PASS; no blocking P0/P1 coverage gaps remain.

### Implementation Plan

- Keep CSAAS integration behind an advisory-owned injectable port with a no-data adapter for local MVP.
- Make CSAAS signal failure a recommendation-context fallback, not a Quick Consult failure.
- Let recommendation generation combine Story 3.6 organization context and Story 3.7 enterprise signals into one stable `recommendationContext` contract.
- Surface only accessible, visible UI states near recommendation cards; preserve existing proxy request whitelisting.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story status set to ready-for-dev for ATDD and implementation.
- ATDD checklist and active green tests now cover AC1-AC3 across backend and frontend.
- Quick Consult now returns `recommendationContext` and `enterpriseContext` with enterprise/generic mode, signals, safe sources, fallback reason, and optional completion prompt.
- CSAAS signal loading uses trusted server-side `tenantId` and `user.organizationId`, enforces a 2-second deadline, and degrades to generic mode for no data, malformed data, missing organization, errors, tenant mismatch, or timeout.
- Recommendation metadata/audit records status/count/source markers only; raw CSAAS report/questionnaire/problem/prompt/provider output is not persisted.
- Recommendation UI displays enterprise context as `role="status"`, generic fallback as `role="alert"` with required wording, and low-completeness guidance without blocking accept/manual browse actions.
- Verification: `cd backend && npm run test -- src/modules/advisory/integration src/modules/advisory/quick-consult --runInBand` passed.
- Verification: `cd frontend && npm run test -- lib/advisory/quick-consult.test.ts lib/advisory/quick-consult.contextual-recommendations.test.ts app/api/advisory/quick-consult/start components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx --runInBand` passed.
- Verification: `cd backend && npx tsc --noEmit --pretty false` passed.
- Verification: `cd frontend && npx tsc --noEmit --pretty false` passed.
- Verification: `cd backend && npm run test -- --runInBand` passed.
- Verification: `cd frontend && npm run test -- --runInBand` passed.
- Traceability: `_bmad-output/test-artifacts/traceability-report.md` records Gate Decision PASS for AC1-AC3.

### File List

- `_bmad-output/implementation-artifacts/3-7-contextual-recommendations-with-csaas-data-fallback.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-3-7-contextual-recommendations-with-csaas-data-fallback.md`
- `_bmad-output/test-artifacts/tea-atdd-api-tests-3-7-2026-05-21T02-34-00+08-00.json`
- `_bmad-output/test-artifacts/tea-atdd-e2e-tests-3-7-2026-05-21T02-34-00+08-00.json`
- `_bmad-output/test-artifacts/traceability-report.md`
- `_bmad-output/test-artifacts/tea-trace-coverage-matrix-3-7-2026-05-21T04-14-02+08-00.json`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.ts`
- `backend/src/modules/advisory/integration/csaas-enterprise-signals.service.spec.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult.service.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult.service.contextual-recommendations.spec.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.spec.ts`
- `backend/src/modules/advisory/quick-consult/quick-consult-method-recommendation.service.contextual.spec.ts`
- `frontend/lib/advisory/quick-consult.ts`
- `frontend/lib/advisory/quick-consult.contextual-recommendations.test.ts`
- `frontend/app/api/advisory/quick-consult/start/route.contextual-recommendations.test.ts`
- `frontend/components/advisory/QuickConsultProblemIntake.tsx`
- `frontend/components/advisory/QuickConsultProblemIntake.contextual-recommendations.test.tsx`

### Change Log

- 2026-05-21: Created Story 3.7 Contextual Recommendations with CSAAS Data Fallback implementation context and moved story to ready-for-dev.
- 2026-05-21: Implemented Story 3.7 CSAAS contextual recommendations, generic fallback, low-completeness prompt, active tests, and verification evidence; story moved to review.
- 2026-05-21: Completed traceability gate with PASS and moved Story 3.7 to done.
