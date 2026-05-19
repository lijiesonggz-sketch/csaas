---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-20T04:04:00+08:00'
storyId: 2-4-runtime-file-loading-and-brand-mapping
inputDocuments:
  - _bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/fixture-architecture.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist: Story 2.4 Runtime File Loading and Brand Mapping

## Step 1: Preflight and Context

- Detected stack: fullstack repository; this story is backend-only runtime work.
- Story file loaded: `_bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md`.
- Acceptance criteria extracted: runtime file provider error handling, brand mapper preservation, workflow registry extension boundary.
- Test framework detected: backend Jest via `backend/package.json`.
- Browser recording: N/A. Story 2.4 creates no frontend flow, no endpoint, and no browser surface.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: backend unit/integration coverage is the right level; no UI journey or live API endpoint exists in this story.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED intent |
| --- | --- | --- | --- | --- |
| AC1 | Approved runtime asset loads with normalized relative path, absolute path, content hash, extension, mtime | Unit/integration | P0 | Missing runtime file provider module fails compilation |
| AC1 | Traversal/outside-root, missing, unsupported, and empty files fail closed with stable operational error codes | Unit | P0 | Missing error and provider implementation fails compilation |
| AC1 | Method-library CSV files are validated before prompt assembly; malformed CSV fails closed instead of producing partial guidance | Integration | P0 | Missing parser/assembler validation allows malformed method libraries |
| AC2 | User-visible BMAD/BMad/BMM/CIS labels map to ThinkTank | Unit | P0 | Missing brand mapper fails compilation |
| AC2 | Inline code, fenced code, paths, and diagnostic tokens are preserved | Unit | P0 | Missing markdown-aware mapper fails compilation |
| AC2 | Diagnostic log lines and invalid four-space-indented fence markers are preserved | Unit | P1 | Mapper rewrites technical evidence inside logs or code |
| AC2 | Mapping is idempotent | Unit | P1 | Missing mapper behavior fails compilation |
| AC3 | Eight MVP workflows are discoverable from runtime source assets | Integration | P0 | Missing registry/parser implementation fails compilation |
| AC3 | Catalog-driven Markdown/CSV workflow fixtures are discovered without code-level business-flow branching | Integration | P1 | Missing extension seam fails compilation |
| AC1/AC3 | Prompt assembler combines workflow and method libraries, applies brand mapper, and preserves source refs | Integration | P0 | Missing assembler implementation fails compilation |
| AC1/AC3 | Runtime services are registered and exported by `AdvisoryModule` | Unit | P0 | Missing module wiring fails compilation |

## Step 4: Failing Tests Generated

Created RED backend tests:

- `backend/src/modules/advisory/runtime/runtime-file-provider.service.spec.ts`
- `backend/src/modules/advisory/runtime/brand-mapper.service.spec.ts`
- `backend/src/modules/advisory/runtime/workflow-registry.service.spec.ts`
- `backend/src/modules/advisory/runtime/prompt-assembler.service.spec.ts`
- `backend/src/modules/advisory/runtime/advisory-runtime.module.spec.ts`

Expected RED command:

```bash
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
```

Expected RED result before implementation: Jest/ts-jest cannot resolve the new runtime services and error types.

Actual RED evidence:

```bash
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
```

Result: failed before implementation because `runtime.errors`, `runtime-file-provider.service`, `brand-mapper.service`, `workflow-registry.service`, and `prompt-assembler.service` did not exist.

## Green Phase Checklist For Dev

- Implement `runtime.errors.ts` and `runtime.types.ts`.
- Implement `runtime-file-provider.service.ts` with approved-root containment and stable errors.
- Implement `brand-mapper.service.ts` with Markdown-aware preservation.
- Implement `workflow-registry.service.ts` from configurable runtime source paths.
- Implement `prompt-assembler.service.ts` without provider calls.
- Register and export runtime services in `backend/src/modules/advisory/advisory.module.ts`.
- Run focused runtime Jest and `npx tsc --noEmit`.

## Step 5: Validate and Complete

- Prerequisites satisfied: story ACs were clear and backend Jest was configured.
- Test files created correctly under `backend/src/modules/advisory/runtime/`.
- Checklist maps AC1-AC3 to backend unit/integration coverage.
- RED phase was verified before implementation.
- CLI/browser sessions: N/A; no browser automation used.
- Temp artifacts: no random temp artifacts retained; final ATDD artifact stored under `_bmad-output/test-artifacts/`.

Green validation after implementation:

```bash
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
cd backend && npx tsc --noEmit
cd backend && npm run test -- src/modules/advisory --runInBand
```

Result: runtime focused tests, TypeScript validation, and advisory regression all passed.

Final code-review fix validation:

```bash
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
cd backend && npx tsc --noEmit
cd backend && npm run test -- src/modules/advisory --runInBand
```

Result: runtime focused tests passed (5 suites / 30 tests), TypeScript validation passed, and advisory regression passed (17 suites / 96 tests).
