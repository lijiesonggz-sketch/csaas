---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-05-22T10:58:00+08:00'
storyId: 5-2-advisor-persona-loading-and-selection
inputDocuments:
  - _bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md
  - _bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist: Story 5.2 Advisor Persona Loading and Selection

## Step 1: Preflight and Context

- Detected stack: fullstack.
- Primary test level for this story: backend unit and service integration.
- Browser/E2E recording: N/A. Story 5.2 changes server-side Party Mode start behavior and runtime file/persona selection, not frontend navigation or visual UI.
- Contract/Pact generation: N/A. No new HTTP endpoint or provider contract is introduced.
- Story has clear acceptance criteria covering approved persona loading, differentiated selection, visible explanation, omission handling, and below-minimum failure.

## Step 2: Generation Mode

- Mode: AI generation.
- Rationale: backend service/control-flow behavior with deterministic source assets; no browser selector discovery required.

## Step 3: Test Strategy

| AC | Scenario | Level | Priority | RED Test |
| --- | --- | --- | --- | --- |
| AC1, AC2 | Load approved manifest/team/persona sources, select three differentiated advisors, brand visible output as ThinkTank | Unit | P0 | `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts` |
| AC3 | One selected advisor source fails; continue with viable advisor set and explain omission | Unit | P0 | `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts` |
| AC3 | Fewer than three viable advisors; fail closed before provider work and keep retryable rollback | Service integration | P0 | `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts` |
| AC1, AC2 | Session start persists scalar-safe advisor metadata pointers and hashes only | Unit + service integration | P1 | Runtime spec + Party Mode entry spec |

## Step 4: RED Tests Generated

- Runtime unit RED tests:
  - `backend/src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts`
  - 4 skipped RED tests created for approved loading, differentiated selection, omission continuation, below-minimum failure, and scalar-safe metadata.
- Party Mode start RED tests:
  - `backend/src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts`
  - 3 skipped RED tests added for visible selected advisor explanation, retryable rollback when persona loading fails, and sanitized omitted-advisor messaging.

All RED tests use `test.skip()` during ATDD generation and assert expected behavior rather than placeholders. The green phase must remove `test.skip()` after implementation.

## Step 5: Validation

- Acceptance criteria are mapped to focused backend tests.
- Tests do not require live provider/network calls.
- Tests explicitly assert raw agent file content is absent from user-visible messages, provider metadata, checkpoint/session metadata, and omission explanations.
- No production `data-testid` requirement.
- CLI/browser sessions: none opened.
- Temporary artifacts: none left outside `_bmad-output/test-artifacts/`.

## Green Phase Commands

```bash
cd backend && npm run test -- src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
cd backend && npx tsc --noEmit
```

## Implementation Guidance

- Add a focused runtime service for Party Mode advisor persona loading/selection.
- Reuse `ThinkTankRuntimeFileProviderService` and `ThinkTankBrandMapperService`.
- Prefer manifest structured persona fields; use agent files only as approved source validation/hash pointers.
- Persist only scalar metadata pointers, not raw persona file content.
- Keep Party Mode start provider-free and preserve Story 5.1 rollback cleanup.
