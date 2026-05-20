---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04a-subagent-api-failing
  - step-04b-subagent-e2e-failing
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T11:02:19+08:00'
storyId: 2-9-report-viewing-and-export
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/2-9-report-viewing-and-export.md
  - _bmad-output/implementation-artifacts/2-8-live-document-drawer-and-ai-labeled-report-draft.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/thinktank-prd.md
  - _bmad-output/planning-artifacts/architecture-thinktank-correct-course-addendum-2026-05-18.md
  - _bmad-output/planning-artifacts/ux-design-specification-thinktank.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/api-request.md
  - _bmad/tea/testarch/knowledge/auth-session.md
  - _bmad/tea/testarch/knowledge/file-utils.md
  - _bmad/tea/testarch/knowledge/contract-testing.md
---

# ATDD Checklist: Story 2.9 Report Viewing and Export

## Step 1: Preflight and Context

- Detected stack: fullstack repository.
- Story file loaded: `_bmad-output/implementation-artifacts/2-9-report-viewing-and-export.md`.
- Acceptance criteria extracted:
  - AC1: render current report as structured Markdown with title, sections, visible AI label, generation metadata, and export availability before workflow completion.
  - AC2: Markdown export creates the same visible structure, shows non-blocking success feedback, and emits privacy-safe `thinktank.output.exported` audit metadata.
  - AC3: PDF export uses CJK-capable fonts, preserves AI labeling, shows recoverable error guidance on failure, and emits the same privacy-safe audit metadata.
- Existing patterns reviewed: Story 2.8 output repository/service/controller/proxy/client/drawer tests, compliance PDF renderer pattern, report-center browser download helper, and advisory event contract.
- TEA config loaded from `_bmad/tea/config.yaml`: fullstack auto mode, Playwright utilities enabled, Pact utilities enabled, execution mode auto.
- Browser recording: not opened. Export controls can be covered with source-level RTL selectors using role, label, status, alert, and visible text. No production `data-testid` is allowed.

## Step 2: Generation Mode

- Mode: AI generation with sequential local worker execution.
- Rationale: subagent execution was attempted and did not produce outputs within the wait window; the worker step requirements were then executed in the current agent while preserving the RED-phase contract.
- Pact/CDC decision: provider scrutiny is documented in generated test headers. No live broker/network dependency is required because provider source exists in this repo.

## Step 3: Test Strategy

Primary test level: fullstack integration across backend service/controller, Next proxy, frontend client helper, and React drawer component.

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | Export reads existing `workflow_outputs` draft or latest completed output without creating an empty draft | Backend service | P0 | Missing export service/read path fails |
| AC1 | Empty reports and missing AI-label metadata are rejected before payload generation | Backend service | P0 | Prevents empty/unlabeled export |
| AC1 | Drawer renders visible structured report and exposes export actions only when sections exist | Frontend component | P0 | Missing drawer export controls fail |
| AC2 | Markdown export contains title, summary, `[AI Generated]`, JSON-LD metadata, and ordered sections | Backend service | P0 | Missing Markdown renderer fails |
| AC2 | Backend emits `thinktank.output.exported` only after successful generation with privacy-safe metadata | Backend service | P0 | Missing audit event/privacy guard fails |
| AC2 | Frontend client downloads Markdown via backend proxy without sending report body or tenant/output IDs | Frontend lib/Next proxy | P0 | Missing client/proxy export path fails |
| AC3 | PDF renderer uses CJK-capable font stack and escapes AI-generated content before HTML rendering | Backend service/renderer | P1 | Missing CJK/escape contract fails |
| AC3 | PDF binary response preserves `Content-Type` and `Content-Disposition` through Next proxy | Next proxy | P0 | JSON wrapper or lost headers fail |
| AC3 | Export errors remain visible as recoverable `role="alert"` guidance without closing the drawer | Frontend component | P1 | Missing accessible error state fails |

Duplicate coverage guard:

- Backend service tests own export selection, renderer contracts, AI-label validation, empty-output rejection, and audit privacy.
- Controller tests own guarded route metadata and raw response headers.
- Next route tests own binary/text forwarding and auth.
- Frontend lib tests own browser Blob download behavior and client-side error normalization.
- Drawer tests own user-visible controls, disabled/running states, focus continuity, and recoverable alert guidance.

## Step 4C: Aggregate ATDD Test Generation Results

- TDD red phase validation: PASS.
  - Backend service tests: 7, all `test.skip()`.
  - Backend controller tests: 4, all `test.skip()`.
  - Next proxy tests: 5, all `test.skip()`.
  - Frontend client tests: 4, all `test.skip()`.
  - Frontend drawer tests: 5, all `test.skip()`.
  - Total: 25 skipped RED tests.
- No `expect(true).toBe(true)` placeholder assertions were generated.
- Provider scrutiny comments were added for backend/controller/proxy contracts.
- Generated files:
  - `backend/src/modules/advisory/outputs/advisory-output-export.service.spec.ts`
  - `backend/src/modules/advisory/sessions/advisory-session.output-export.controller.spec.ts`
  - `frontend/lib/advisory/outputs.export.test.ts`
  - `frontend/app/api/advisory/sessions/[sessionId]/output/export/route.test.ts`
  - `frontend/components/advisory/AdvisoryDocumentDrawer.export.test.tsx`
- Fixture needs:
  - Backend: tenant-scoped user/session/output factories, export service mocks, PDF renderer mock, audit service mock.
  - Frontend: auth header mock, NextAuth token mock, Blob/ObjectURL/download anchor mock, drawer output factory.
- Summary JSON saved to `_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-2-9-2026-05-20T11-02-19+08-00.json`.

## Step 5: Validate & Complete

- Validation checklist reviewed against generated ATDD outputs.
- Prerequisites satisfied:
  - Story 2.9 file exists with testable acceptance criteria.
  - Backend Jest, frontend Jest/RTL, and existing Next route test patterns are present.
  - Temp artifacts are stored under `_bmad-output/test-artifacts/tmp/`.
  - No browser automation session was opened, so there are no orphaned browser sessions to clean up.
- Output quality checks:
  - Checklist includes all mandatory steps through Step 5.
  - Generated tests are intentionally skipped for RED handoff.
  - Tests assert expected behavior and do not use placeholder assertions.
  - No production `data-testid` requirement was introduced.
  - Export scope is Markdown/PDF only; DOCX/Word remains post-MVP.

## Running Tests

```bash
cd backend && npm run test -- src/modules/advisory/sessions src/modules/advisory/outputs src/modules/advisory/events --runInBand
cd frontend && npm run test -- app/advisory app/api/advisory lib/advisory components/advisory --runInBand
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
git diff --check
```

## Green-Phase Implementation Checklist

- [ ] Add `AdvisoryOutputExportService` and register it in `AdvisoryModule`.
- [ ] Add `GET /advisory/sessions/:sessionId/output/export?format=markdown|pdf` with guards and raw response headers.
- [ ] Add Markdown renderer with title, summary, visible `[AI Generated]`, ordered sections, and JSON-LD metadata block.
- [ ] Add PDF renderer using CJK-capable fonts and escaped AI content.
- [ ] Add privacy-safe `thinktank.output.exported` contract and audit emission after payload generation.
- [ ] Add Next proxy route preserving binary/text `Content-Type` and `Content-Disposition`.
- [ ] Extend `frontend/lib/advisory/outputs.ts` with `downloadThinkTankSessionOutput`.
- [ ] Add drawer export controls, success toast path, persistent recoverable error alert, disabled states, and focus continuity.
- [ ] Convert Story 2.9 RED tests from `test.skip()` to active tests during implementation and make them pass.

## Notes

- Export must not call `getSessionOutput` blindly because that path can create an empty draft.
- Export must never accept report body, tenant id, output id, raw prompt, raw content, or audit metadata from the browser.
- Audit payload must include tenant, actor, output id, format, workflow type, section count, and AI-label metadata presence, but no raw report content or provider internals.
