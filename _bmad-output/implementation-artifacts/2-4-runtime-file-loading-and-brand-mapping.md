# Story 2.4: Runtime File Loading and Brand Mapping

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a ThinkTank user,
I want workflows and advisor prompts to run from validated methodology definitions,
so that the guidance feels structured, consistent, and branded as ThinkTank.

## Acceptance Criteria

1. Given the runtime starts a workflow, when it loads workflow, step, agent, and method-library files, then it reads the approved BMAD source assets through a file provider abstraction, and missing or malformed source files produce a clear operational error instead of partial guidance.
2. Given user-visible prompt or report text is assembled, when BMAD-origin identifiers appear in visible content, then the brand mapper replaces them with ThinkTank terminology, and technical paths, logs, and code references are preserved when replacement would be misleading.
3. Given a new workflow definition file is added in the supported format, when the runtime registry is refreshed, then the workflow can be discovered without hardcoding a new business flow, and tests prove the parser/assembler boundary can be extended safely.

## Tasks / Subtasks

- [x] Add a file-provider boundary for approved ThinkTank runtime assets (AC: 1)
  - [x] Create runtime code under `backend/src/modules/advisory/runtime/`; do not put runtime code in frontend or provider-gateway folders.
  - [x] Resolve asset paths from the repository root and allow only approved source roots: `_bmad/core/skills`, `_bmad/core/tasks`, `_bmad/cis/workflows`, `_bmad/bmm/workflows`, `_bmad/cis/agents`, `_bmad/bmm/agents`, `_bmad/_config`, and approved method CSV files.
  - [x] Return typed file descriptors with normalized relative path, absolute path, content, content hash, extension, and modified time.
  - [x] Fail closed with a stable operational error code for missing, unreadable, outside-root, unsupported-extension, or empty runtime files.

- [x] Implement parser/assembler and registry discovery without workflow-specific branching (AC: 1, 3)
  - [x] Parse workflow Markdown/YAML/CSV assets through dedicated parser functions or services, not ad hoc route/controller string logic.
  - [x] Discover the eight MVP workflow definitions from registry/config sources and expose stable metadata: canonical key, ThinkTank display name, scenario label, source path, supported file type, and first prompt source.
  - [x] Keep parsing side-effect free and deterministic so tests can use temp fixtures without live LLM calls.
  - [x] Add extension seams so adding a supported workflow file proves discovery without changing service branching.

- [x] Add ThinkTank brand mapping for user-visible content (AC: 2)
  - [x] Replace user-visible BMAD/BMad/BMM/CIS origin labels with ThinkTank terminology in prompts, advisor introductions, workflow titles, and report text.
  - [x] Preserve technical paths, code spans/fenced code, error logs, package names, and internal diagnostic metadata where replacing `BMAD` would make the output misleading.
  - [x] Make brand mapping idempotent: applying the mapper twice must not distort already mapped text.
  - [x] Cover mixed casing, markdown headings, inline code, fenced code, paths, and agent self-introduction examples.

- [x] Wire runtime services into `AdvisoryModule` without changing live workflow launch behavior yet (AC: 1, 3)
  - [x] Register and export runtime services from the existing `AdvisoryModule`.
  - [x] Do not create `workflow_sessions`, launch endpoints, SSE endpoints, provider calls, or frontend workflow selection in this story; those belong to Stories 2.5-2.7.
  - [x] Preserve existing Story 1.5 provider-gateway boundary; runtime prompt assembly may prepare system/user-visible text but must not call the gateway.

- [x] Add focused automated coverage and evidence artifacts (AC: 1-3)
  - [x] Add backend unit tests for file provider allowlist, missing/malformed file failures, registry discovery, parser/assembler extension seam, and brand mapping preservation rules.
  - [x] Add an ATDD checklist artifact under `_bmad-output/test-artifacts/`.
  - [x] Run focused backend Jest for new runtime tests and `npx tsc --noEmit` from `backend`.
  - [x] Document any broader validation blocker exactly in Dev Agent Record.

## Dev Notes

### Source Requirements

- Epic 2 requires a unified advisory workspace that can run eight structured workflows and produce a first professional report. Story 2.4 owns only runtime file loading, registry discovery, parser/assembler boundaries, and brand mapping. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 / Story 2.4]
- FR40-FR44 require ThinkTank to load BMAD-origin workflow definitions, agent definitions, and thinking-method files from source assets, brand user-visible content as ThinkTank, and support extension by adding supported files rather than hardcoding business flows. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - ThinkTank Runtime 与 Agent 系统]
- Architecture says `_bmad/` files are runtime source assets and the Prompt Builder boundary must include file provider, parser/assembler, and brand mapper layers. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Runtime Strategy / Project Structure]
- The final architecture clarification uses Anthropic SDK through the governed provider gateway later; this story must not introduce a second LLM integration path. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - Project Structure & Boundaries]

### Scope Boundaries

Do not implement these future capabilities in this story:

| Capability | Owning story |
| --- | --- |
| Workflow catalog UI, session creation, launch endpoint, and workflow started audit | Story 2.5 |
| User message persistence and active decision controls | Story 2.6 |
| SSE streaming message experience | Story 2.7 |
| Live report draft and workflow output entity | Story 2.8 |
| Markdown/PDF export | Story 2.9 |
| Prompt caching and cost telemetry | Story 2.10 |

### Previous Story Intelligence

- Story 2.1-2.3 established the frontend advisory shell only. Do not remove placeholder UI or make sidebar workflow items interactive in Story 2.4.
- Story 1.4 established canonical ThinkTank event names and privacy-safe metadata rules under `backend/src/modules/advisory/events/`. Reuse those contracts later; Story 2.4 should not emit workflow events because no workflow starts here.
- Story 1.5 established `ThinkTankProviderGatewayService` and fake/live provider adapters. Runtime assembly must feed later gateway calls through that service, not instantiate Anthropic/GLM directly.
- Existing advisory backend module lives at `backend/src/modules/advisory/` with `access`, `admin`, `events`, and `provider-gateway` submodules. Add `runtime/` as a sibling.

### Existing Patterns To Reuse

- Module registration: `backend/src/modules/advisory/advisory.module.ts`.
- Provider gateway boundary: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`.
- Event contract and raw-sensitive metadata protection: `backend/src/modules/advisory/events/thinktank-event-contract.ts`.
- Repository root and TypeScript path style in backend tests: existing `*.spec.ts` files under `backend/src/modules/advisory/**`.
- Runtime source assets:
  - `_bmad/_config/workflow-manifest.csv`
  - `_bmad/_config/agent-manifest.csv`
  - `_bmad/core/skills/bmad-brainstorming/workflow.md`
  - `_bmad/core/tasks/bmad-create-prd/workflow.md`
  - `_bmad/cis/workflows/**/workflow.md`
  - `_bmad/bmm/workflows/**/workflow.md`
  - `_bmad/cis/agents/**/*.md`
  - `_bmad/bmm/agents/**/*.md`
  - `_bmad/core/skills/bmad-brainstorming/brain-methods.csv`
  - `_bmad/cis/workflows/**/design-methods.csv`, `solving-methods.csv`, `story-types.csv`, and related method-library CSV files.

### Backend Implementation Guidance

- Prefer a narrow service set:
  - `runtime/file-provider.service.ts`
  - `runtime/brand-mapper.service.ts`
  - `runtime/workflow-registry.service.ts`
  - `runtime/prompt-assembler.service.ts`
  - `runtime/runtime.errors.ts`
  - `runtime/runtime.types.ts`
- Use `node:path` normalization and root containment checks before reading a file. Never accept `..` traversal that escapes approved roots.
- For expected runtime definition sizes, `fs.promises.readFile` is acceptable; keep the provider interface async so large-file streaming can be introduced later if needed.
- Stable errors should expose `code`, `message`, `sourcePath?`, and `details?`, but must not include raw prompt/user content.
- Brand mapping should operate on user-visible text segments. A small Markdown-aware tokenizer that preserves inline-code and fenced-code segments is safer than global regex replacement.
- CSV parsing can stay minimal if it handles the current manifests deterministically; keep it local and typed rather than adding a dependency unless existing code already uses one.

### Latest Technical Notes

- NestJS custom providers and exported services are the correct way to make runtime services injectable from other advisory submodules while keeping construction inside `AdvisoryModule`. [Source: https://docs.nestjs.com/fundamentals/custom-providers]
- Node.js `fs.readFile()` buffers the full file and returns directory errors on Windows/macOS/Linux; this is acceptable for small runtime definition files, while the async interface keeps future streaming possible. [Source: https://nodejs.org/api/fs.html]
- TypeScript 5.6 adds stricter iterator and side-effect import checks; keep runtime parser code typed, avoid silent side-effect imports, and rely on `npx tsc --noEmit` as the completion gate. [Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html]

### Testing Requirements

- Follow TDD: add failing backend tests before production runtime code.
- Focused tests:
  - `cd backend && npm run test -- src/modules/advisory/runtime --runInBand`
  - or explicit runtime spec paths if Jest does not support the directory selector.
- Static validation:
  - `cd backend && npx tsc --noEmit`
- Broader regression where feasible:
  - `cd backend && npm run test -- --runInBand`
  - `cd backend && npm run build`
- No test may depend on live GLM availability, network access, or frontend browser binaries.

### Project Structure Notes

- Use `backend/src/modules/advisory/runtime/`; do not create `src/advisory/` or a new top-level runtime package.
- Keep implementation tests next to runtime source as `*.spec.ts`.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`.
- No frontend files should need modification for Story 2.4.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.4 requirements.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR40-FR44 runtime requirements.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - runtime source assets, Prompt Builder, and project boundaries.
- `_bmad-output/implementation-artifacts/2-1-desktop-advisory-workspace-shell.md` - shell boundary and future capability split.
- `_bmad-output/implementation-artifacts/2-2-advisory-ui-state-and-accessibility-baseline.md` - accessibility baseline and false-affordance constraints.
- `_bmad-output/implementation-artifacts/2-3-theme-density-and-compatibility-baseline.md` - theme/density baseline and Story 2.4 handoff.
- `backend/src/modules/advisory/advisory.module.ts` - existing advisory module registration.
- `backend/src/modules/advisory/provider-gateway/` - existing governed provider boundary.
- `_bmad/_config/workflow-manifest.csv` and `_bmad/cis/workflows/**` - runtime source assets.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-20: Story context created from Epic 2 Story 2.4, ThinkTank PRD/UX/architecture, Story 2.1-2.3 handoff notes, current advisory backend module, provider gateway/event contracts, and official NestJS/Node.js/TypeScript references.
- 2026-05-20: RED phase confirmed with `cd backend && npm run test -- src/modules/advisory/runtime --runInBand`; tests failed because runtime implementation modules did not exist.
- 2026-05-20: GREEN phase passed with focused runtime Jest, advisory module Jest regression, and TypeScript validation.
- 2026-05-20: Code review triage found no HIGH issues and multiple MEDIUM patch findings. Fixed CSV listing traversal, prompt source canonical de-duplication, CSV field trimming, method-library CSV validation, brand mapper log/fence preservation, runtime error cause exposure, and runtime catalog CSV/YAML extension coverage.

### Implementation Plan

- Add RED backend tests for runtime file provider, brand mapper, registry discovery, and prompt assembler extension behavior.
- Implement runtime services under `backend/src/modules/advisory/runtime/` and register them in `AdvisoryModule`.
- Run focused backend tests and TypeScript validation before moving to code review.

### Completion Notes List

- Added runtime file provider with approved-root containment, stable operational error codes, content hashing, extension validation, and typed descriptors.
- Added Markdown-aware brand mapper for visible ThinkTank terminology while preserving code spans, fenced code, paths, and diagnostic tokens.
- Added workflow registry with configurable source discovery for the eight Story 2.4 MVP workflows and a fixture-proven extension seam.
- Added prompt assembler that prepares branded prompt text and source metadata without calling the provider gateway or creating launch/session behavior.
- Registered and exported runtime services from the existing `AdvisoryModule`.
- Added runtime catalog coverage for Markdown/CSV workflow definitions without code-level business-flow overrides; new runtime workflows are added through `_bmad/_config/thinktank-runtime-workflows.csv`.
- Added fail-closed method-library CSV validation before prompt assembly, canonical source de-duplication, and stricter path/listing containment.
- Hardened brand mapping to preserve diagnostic log lines and avoid closing fenced code blocks with invalid four-space indentation.
- Validation passed:
  - `cd backend && npm run test -- src/modules/advisory/runtime --runInBand` (5 suites / 30 tests)
  - `cd backend && npx tsc --noEmit`
  - `cd backend && npm run test -- src/modules/advisory --runInBand` (17 suites / 96 tests)

### File List

- `_bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md`
- `_bmad-output/test-artifacts/atdd-checklist-2-4-runtime-file-loading-and-brand-mapping.md`
- `_bmad-output/test-artifacts/traceability-report-story-2-4-runtime-file-loading-and-brand-mapping.md`
- `_bmad-output/test-artifacts/gate-decision-story-2-4.yaml`
- `_bmad-output/test-artifacts/tmp/tea-trace-coverage-matrix-story-2-4-2026-05-20T04-40-00+08-00.json`
- `_bmad/_config/thinktank-runtime-workflows.csv`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/runtime/advisory-runtime.module.spec.ts`
- `backend/src/modules/advisory/runtime/brand-mapper.service.spec.ts`
- `backend/src/modules/advisory/runtime/brand-mapper.service.ts`
- `backend/src/modules/advisory/runtime/prompt-assembler.service.spec.ts`
- `backend/src/modules/advisory/runtime/prompt-assembler.service.ts`
- `backend/src/modules/advisory/runtime/runtime-file-provider.service.spec.ts`
- `backend/src/modules/advisory/runtime/runtime-file-provider.service.ts`
- `backend/src/modules/advisory/runtime/runtime.constants.ts`
- `backend/src/modules/advisory/runtime/runtime.errors.ts`
- `backend/src/modules/advisory/runtime/runtime.types.ts`
- `backend/src/modules/advisory/runtime/workflow-parser.service.ts`
- `backend/src/modules/advisory/runtime/workflow-registry.service.spec.ts`
- `backend/src/modules/advisory/runtime/workflow-registry.service.ts`

## Change Log

- 2026-05-20: Story context created and marked ready-for-dev.
- 2026-05-20: Runtime provider, brand mapper, workflow registry, prompt assembler, module registration, ATDD checklist, and backend tests implemented; story moved to review.
- 2026-05-20: Code review MEDIUM findings fixed; focused runtime and advisory regression suites pass.
