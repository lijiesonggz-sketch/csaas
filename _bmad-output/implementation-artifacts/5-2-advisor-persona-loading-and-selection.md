# Story 5.2: Advisor Persona Loading and Selection

Status: done

## Story

As a ThinkTank user,
I want Party Mode to use distinct advisor personas,
so that the discussion produces meaningfully different perspectives.

## Acceptance Criteria

1. Given Party Mode starts, when advisor personas are loaded, then the system loads persona identity, role, communication style, principles, and capabilities from the approved agent definitions, and user-visible identity is branded as ThinkTank advisor content.
2. Given a discussion needs multiple viewpoints, when the system selects advisors, then it chooses advisors with relevant and differentiated roles, and the selected advisor names and perspectives are explained before discussion begins.
3. Given persona loading fails for one advisor, when Party Mode is initiated, then the system can continue with available advisors if the minimum viable set remains, and it explains any omitted advisor rather than silently reducing coverage.

## Tasks / Subtasks

- [x] Runtime persona loader and selection contract (AC: 1, 2, 3)
  - [x] Load approved Party Mode advisor candidates from `_bmad/_config/agent-manifest.csv` and approved team/agent assets rather than hardcoding persona content in `AdvisorySessionService`.
  - [x] Parse/sanitize identity, role, communication style, principles, capabilities, module, and source path into a typed advisor persona DTO.
  - [x] Apply existing ThinkTank brand mapping to all user-visible advisor names, source labels, introductions, and omission explanations while preserving technical source refs in metadata.
  - [x] Select a minimum viable differentiated advisor set for Party Mode start; use relevant capabilities/roles and avoid duplicate role clusters when enough candidates are available.
- [x] Party Mode start integration (AC: 1, 2, 3)
  - [x] Replace the fixed Story 5.1 `THINKTANK_PARTY_MODE_STARTED_MESSAGE` path with a generated start message that explains selected advisors and perspectives before discussion begins.
  - [x] Persist sanitized selected advisor metadata/pointers in session/checkpoint metadata: stable advisor id, display name, role/title, source path/hash, selection reason, and omission reason. Do not persist raw agent file contents.
  - [x] Continue Party Mode start when one persona fails but the minimum viable advisor count remains; surface omitted advisor names/reasons in the assistant message.
  - [x] Fail safely when the viable advisor count is below minimum: no provider call, no orphaned decision messages, retryable Party Mode metadata rollback remains intact.
- [x] Regression boundaries (AC: 1, 2, 3)
  - [x] Preserve Story 5.1 server-owned latest decision validation, feature flag/tenant allowlist, return-to-workflow action, rollback, and message cleanup behavior.
  - [x] Do not add standalone Party Mode page/navigation or frontend-only tenant/session trust.
  - [x] Keep Story 5.3+ out of scope: no serial expert turns, no advisor prompt execution, no differentiated analysis framework assignment, no integrated conclusion, no token budget enforcement.
- [x] Automated coverage (AC: 1, 2, 3)
  - [x] Add RED backend ATDD/unit tests for successful persona load, brand-mapped visible identities, differentiated selection, one-advisor failure with viable continuation, and below-minimum safe failure.
  - [x] Add focused tests proving metadata stores sanitized pointers only and no raw persona file content.
  - [x] Re-run Story 5.1 Party Mode entry regression tests plus runtime tests and TypeScript.

## Dev Notes

### Source Requirements

- Epic 5 requires Party Mode to be workflow-embedded and to use distinct advisor personas before later stories add serial turns, lenses, integration, and budgets. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5 / Story 5.2]
- FR25 requires each AI advisor role to load independent persona, knowledge system, and evaluation criteria to produce differentiated views. FR41 requires migration from BMAD agent definition files. FR42 requires all user-visible BMAD-origin identifiers to be presented as ThinkTank-branded content. [Source: `_bmad-output/planning-artifacts/epics.md` - FR25, FR41, FR42]
- UX Journey 4 requires Party Mode to first confirm which experts will join and what perspectives they bring, then later stories render serial expert messages. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Journey 4]
- Runtime architecture identifies `_bmad/` as the source of truth for workflow and agent assets, with file-provider, parser/assembler, and brand-mapper boundaries. [Source: `_bmad-output/planning-artifacts/architecture-thinktank.md` - ThinkTank Runtime / Technical Constraints]

### Existing Code To Reuse

- Reuse `backend/src/modules/advisory/runtime/ThinkTankRuntimeFileProviderService` for approved file loading and fail-closed runtime errors. Extend approved roots only if a source asset required by this story is currently outside the allowlist.
- Reuse `backend/src/modules/advisory/runtime/ThinkTankBrandMapperService` for visible text. Do not add a second brand replacement implementation.
- Add a focused runtime service such as `party-mode-advisor-persona.service.ts` under `backend/src/modules/advisory/runtime/` or a narrow `backend/src/modules/advisory/party-mode/` service if module boundaries require it. Keep parsing/selection outside the 5,000+ line session service except for orchestration calls.
- Reuse Story 5.1 start seam in `backend/src/modules/advisory/sessions/advisory-session.service.ts`: `startPartyModeFromDecision()`, `createPartyModeStartedResponse()`, `createPartyModeContextMetadata()`, and repository `claim/finalize/rollback` methods.
- Reuse Story 5.1 tests as regression fixtures: `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts`, repository tests, DTO tests, and frontend page tests if UI labels change.

### Approved Persona Sources

- Primary manifest: `_bmad/_config/agent-manifest.csv`, which exposes `name`, `displayName`, `title`, `capabilities`, `role`, `identity`, `communicationStyle`, `principles`, `module`, `path`, and `canonicalId`.
- Party/team candidate lists available in `_bmad/bmm/teams/default-party.csv`, `_bmad/cis/teams/default-party.csv`, and `_bmad/tea/teams/default-party.csv`. These contain approved party rosters; normalize `bmad/...` paths to `_bmad/...` before loading and reject empty/nonexistent paths unless the row is intentionally omitted with an explanation.
- Agent definition files live under `_bmad/bmm/agents/**`, `_bmad/cis/agents/**`, and `_bmad/tea/agents/**`. Existing runtime allowlist already includes BMM/CIS agents and `_bmad/_config`; Story 5.2 may need a small allowlist extension for `_bmad/tea/agents` and approved team CSVs.
- The implementation should prefer manifest structured fields for the user-visible persona summary and use agent file content as the approval/source validation pointer. Raw XML/frontmatter from agent files must not leak into user-visible messages.

### Selection Rules

- Minimum viable Party Mode set: 3 advisors. This matches the product success criterion of at least three valuable perspectives and keeps later serial discussion manageable.
- Default target set for start message: 3 advisors unless fewer are viable but still at least 3 after a single failure; selection can be deterministic and tested.
- Relevance can be conservative for Story 5.2: use current workflow key, current step label/source ref, latest user message content, and advisor `capabilities`/`role` keywords. If no strong signal exists, choose differentiated roles from product/business, technical/architecture, creative/problem-solving/design/story perspectives.
- Differentiation must be explicit: selected advisors should not all share the same role family. Persist a role family or perspective label in metadata for testable behavior.
- Omission handling must be visible and bounded: explain which approved advisor was omitted and why, but do not expose stack traces, absolute paths, or raw file content.

### Previous Story Intelligence

- Story 5.1 already made Party Mode availability server-owned via `THINKTANK_PARTY_MODE_ENABLED` and `THINKTANK_PARTY_MODE_TENANTS`; keep browser-provided tenant/session context ignored.
- Story 5.1 validates only the latest assistant decision option and cleans up failed start/return messages before metadata rollback. Story 5.2 failures must preserve that retryable state.
- Story 5.1 stores only sanitized Party Mode context pointers in session/checkpoint metadata. Story 5.2 should append advisor pointers/selection summaries to the same metadata pattern, not raw conversation or persona content.
- Story 2.4 already established runtime file loading and brand mapping; build on it instead of duplicating CSV parsing, path allowlisting, or BMAD-to-ThinkTank replacement rules.
- Story 2.10 prompt caching mentions persona content as cacheable, but this story should only prepare metadata/pointers and visible start context; prompt caching integration is not required here.

### Scope Boundaries

| Capability | Owner |
| --- | --- |
| Start Party Mode from workflow decision controls | Story 5.1 |
| Load/select personas and explain selected/omitted advisors | Story 5.2 |
| Render serial expert messages and current speaker state | Story 5.3 |
| Assign differentiated frameworks/lenses and synthesize conclusion | Story 5.4 |
| Enforce budget, timeouts, retries, telemetry failure events | Story 5.5 |

### Testing Requirements

- Follow TDD: create the ATDD artifact and failing tests before production changes.
- Backend focused commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/runtime --runInBand`
  - `cd backend && npx tsc --noEmit`
- If the start message text changes the frontend-visible label, run the frontend page/workspace tests that cover advisory decision controls.
- No test may depend on live GLM/network/provider calls. Party Mode start remains a provider-free control path in this story.
- Tests must assert raw persona source content is absent from session metadata, provider metadata, and assistant visible text except for sanitized advisor summaries.

### Project Structure Notes

- Keep new backend services under `backend/src/modules/advisory/runtime/` unless a `party-mode/` module already exists before implementation. Register/export through `backend/src/modules/advisory/advisory.module.ts`.
- Keep test files next to source or existing session tests. Prefer focused Jest specs over broad E2E for this backend-first story.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; these are ignored by default and need `git add -f` during checkpoint commit.
- No production `data-testid` additions.

### Latest Technical Information

- No external version research is required for this story because it must use existing repository-controlled NestJS, TypeScript, TypeORM, and runtime services without adding dependencies. The governing versions and APIs are the checked-in code and lockfiles.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 5 and Story 5.2 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - Party Mode and Agent Persona requirements.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - `_bmad/` runtime source-of-truth and module boundaries.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Party Mode Journey 4 and ExpertBadge/PartyModeMessage future UI context.
- `_bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md` - Story 5.1 implementation and rollback lessons.
- `_bmad-output/implementation-artifacts/2-4-runtime-file-loading-and-brand-mapping.md` - runtime file-provider and brand-mapper handoff.
- `_bmad/_config/agent-manifest.csv` - structured approved agent manifest.
- `_bmad/bmm/teams/default-party.csv`, `_bmad/cis/teams/default-party.csv`, `_bmad/tea/teams/default-party.csv` - candidate Party Mode rosters.
- `backend/src/modules/advisory/runtime/` - existing runtime file loading, registry, prompt assembler, brand mapper.
- `backend/src/modules/advisory/sessions/advisory-session.service.ts` - Story 5.1 Party Mode start/return seam.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: Story context created from Epic 5 Story 5.2, Story 5.1 handoff, runtime/brand-mapper architecture, UX Journey 4, and BMAD agent/team source assets.
- 2026-05-22: ATDD RED coverage created for persona loading/selection service and Party Mode start integration.

### Completion Notes List

- Added `ThinkTankPartyModeAdvisorPersonaService` to load approved advisor candidates from manifest/team assets, validate agent source pointers through the runtime file provider, select three differentiated advisors, and produce scalar-safe metadata.
- Party Mode start now generates an advisor explanation message before discussion, persists selected/omitted advisor pointers and hashes, and preserves provider-free start plus rollback cleanup when persona loading fails.
- Extended runtime approved roots for Party Mode team CSVs and TEA agent/team assets while retaining file-provider fail-closed validation.
- Code review fixes added: fail-closed persona service dependency, name-only team roster manifest resolution, no manifest-wide fail-open fallback, context-relevance selection scoring, agent-source path validation, scalar metadata whitelist, neutral omission language, and visible invalid-roster omissions.
- Traceability gate passed with 3/3 P0 acceptance criteria fully covered and no endpoint/auth/error-path gaps.
- Tests passed: `npm run test -- src/modules/advisory/runtime --runInBand`; `npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand`; `npm run test -- src/modules/advisory/sessions/advisory-session.repository.spec.ts --runInBand`; `npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand`; `npx tsc --noEmit`.

### File List

- `_bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-5-2-advisor-persona-loading-and-selection.md`
- `backend/src/modules/advisory/advisory.module.ts`
- `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.ts`
- `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts`
- `backend/src/modules/advisory/runtime/runtime-file-provider.service.ts`
- `backend/src/modules/advisory/runtime/runtime.errors.ts`
- `backend/src/modules/advisory/runtime/runtime.types.ts`
- `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`

## Change Log

- 2026-05-22: Created Story 5.2 implementation context and marked ready-for-dev.
- 2026-05-22: Implemented advisor persona loading/selection, Party Mode start explanation metadata, omission handling, and backend ATDD coverage.
- 2026-05-22: Completed adversarial code review fixes, traceability matrix, PASS gate decision, and marked story done.
