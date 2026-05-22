# Story 5.4: Differentiated Frameworks and Integrated Conclusion

Status: done

## Story

As a ThinkTank user,
I want advisors to challenge the problem from different frameworks and then synthesize the discussion,
so that I leave Party Mode with a clearer decision rather than a pile of opinions.

## Acceptance Criteria

1. Given multiple advisors analyze the same issue, when Party Mode prompts are assembled, then each advisor is assigned a differentiated analysis lens or framework, and tests can verify that generated prompts do not ask all advisors to perform the same role.
2. Given the discussion has produced multiple viewpoints, when the user requests integration or accepts the system's integration prompt, then the system summarizes consensus, disagreements, risks, and recommended next steps, and the user can ask follow-up questions before accepting the integration.
3. Given the user accepts the integrated conclusion, when Party Mode ends, then the conclusion is appended to the active report draft, and the normal workflow resumes at the prior step or next confirmed step.

## Tasks / Subtasks

- [x] ATDD coverage first (AC: 1, 2, 3)
  - [x] Add backend RED tests proving selected advisors receive distinct framework/lens metadata and system prompts.
  - [x] Add backend RED tests for a server-owned integration request action that creates an AI-generated conclusion covering consensus, disagreements, risks, and next steps.
  - [x] Add backend RED tests for accepting the integrated conclusion: append to the active output draft, mark Party Mode returned, and resume the original workflow decision state.
  - [x] Add frontend RED tests for integration/accept controls, visible `[AI Generated]` conclusion content, and follow-up before accept.
- [x] Backend differentiated framework assignment (AC: 1)
  - [x] Extend `PartyModeAdvisorTurn` or adjacent metadata with a deterministic `framework`/`analysisLens` value derived from selected advisor role family and speaker order.
  - [x] Persist scalar-safe framework metadata on advisor messages and provider metadata without exposing raw persona paths, hashes, or prompts.
  - [x] Update Party Mode advisor system prompt assembly so each advisor receives a distinct instruction, not the same generic role wording.
  - [x] Add prompt-level tests that assert at least three advisor prompts use different lenses/frameworks.
- [x] Backend integrated conclusion flow (AC: 2, 3)
  - [x] Add server-owned decision actions for Party Mode integration request and acceptance; reject stale, forged, disabled, or non-latest decision actions.
  - [x] Generate an integrated conclusion from Party Mode history using the existing provider gateway and session message path; no live provider calls in tests.
  - [x] Persist conclusion message metadata: `ai_generated`, `party_mode_integration`, source round/message pointers, framework summary metadata, and `[AI Generated]` visible label.
  - [x] Let users ask follow-up questions after integration by keeping Party Mode active until they explicitly accept the conclusion.
  - [x] On acceptance, append the conclusion to the active report draft with `sourceMessageId`, AI label metadata, and provider metadata, then return to normal workflow.
- [x] Frontend workflow-embedded controls (AC: 2, 3)
  - [x] Extend existing `AdvisoryChatMessage` decision controls; do not add a standalone Party Mode page or navigation entry.
  - [x] Render integration conclusion as an assistant message in the same conversation column with visible `[AI Generated]` labeling and accessible decision controls.
  - [x] Support follow-up entry before accept without clearing Party Mode state incorrectly.
  - [x] On accept, update the live document drawer from the server append result and keep workflow focus/keyboard behavior intact.
- [x] Regression boundaries (AC: 1, 2, 3)
  - [x] Preserve Story 5.1 Party Mode feature flag, latest decision validation, rollback cleanup, and `return-to-workflow`.
  - [x] Preserve Story 5.2 advisor persona loading/selection and sanitized metadata source boundaries.
  - [x] Preserve Story 5.3 serial expert discussion, current-speaker SSE, addressed expert replies, and stream rollback behavior.
  - [x] Do not implement Story 5.5 budget enforcement, timeouts, retries, partial failure telemetry, or resource dashboards.
- [x] Verification (AC: 1, 2, 3)
  - [x] Run focused backend Party Mode/session/output tests and `cd backend && npx tsc --noEmit`.
  - [x] Run focused frontend AdvisoryChatMessage/WorkspaceShell/streaming tests and `cd frontend && npx tsc --noEmit`.
  - [x] Update code review, traceability, gate, story status, and sprint status artifacts after implementation.

## Dev Notes

### Source Requirements

- Epic 5 defines Party Mode as a workflow-embedded multi-advisor discussion. Story 5.4 owns differentiated frameworks/lenses and final synthesis; it builds directly on Story 5.3 serial messages. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5 / Story 5.4]
- FR24 requires multiple advisor perspectives. FR26 requires each Agent analysis to force a different analysis framework so the outputs are meaningfully differentiated. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - Party Mode]
- FR33 and NFR10 require all AI-generated reports, analyses, Party Mode outputs, and advisor replies to include visible `[AI Generated]` labeling plus metadata. [Source: `_bmad-output/planning-artifacts/thinktank-prd.md` - AI 内容合规 / NFR10]
- UX-DR16 and Journey 4 require Party Mode to remain an in-workflow option. After the user accepts the integrated conclusion, the conclusion is written into the document and normal workflow resumes. [Source: `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - Journey 4]

### Existing Code To Reuse

- Backend orchestration remains in the existing advisory session/message path: `backend/src/modules/advisory/sessions/advisory-session.service.ts`, `AdvisoryConversationMessageRepository`, and the existing `sessions/:sessionId/messages` plus `messages/stream` endpoints.
- Reuse Story 5.3 Party Mode seams: `isPartyModeDiscussionReady`, `createPartyModeAdvisors`, `createPartyModeAdvisorOrder`, `resolvePartyModeAddressedAdvisor`, `getNextPartyModeRound`, `withPartyModeTurnLock`, `createPartyModeAdvisorSystemPrompt`, `collectPartyModeAdvisorResponse`, `createPartyModeSerialTurn`, `streamPartyModeSerialTurn`, and `deletePartyModeMessages`.
- Reuse the existing active draft append path rather than writing a second report updater: backend `appendWorkflowOutputSection`/`resolveOutputSourceMessage`; frontend `appendThinkTankWorkflowOutputSection` and `appendAssistantOutputSection`.
- Reuse `returnToWorkflowFromPartyMode()` for the final transition after acceptance. The user may still choose the existing `return-to-workflow` escape action, but accepting the integration must append the conclusion first.
- Frontend changes belong in `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`, `frontend/components/advisory/AdvisoryChatMessage.tsx`, and `frontend/lib/advisory/streaming.ts` only where needed. Do not introduce a standalone `/advisory/party-mode` route.

### Suggested Party Mode 5.4 Contract

- Framework assignment should be deterministic and testable. A conservative default set is enough for MVP, for example:
  - product/value lens for product or PM advisors,
  - technical/architecture lens for architect or engineering advisors,
  - risk/governance lens for QA, compliance, or operations advisors,
  - customer/UX lens for design or research advisors,
  - strategy/market lens for analyst or strategy advisors.
- Store lens metadata as scalar message metadata such as `party_mode_analysis_framework` and `party_mode_framework_instruction`. Keep raw prompt text out of persisted metadata when it contains system-only language.
- The final advisor message in a discussion round should expose decision options that include "进入观点整合" and the existing "返回工作流"; normal advisor follow-ups must remain available through free text and reply-to-expert.
- The integration message should expose decision options for "接受整合结论" and "继续追问". Free-text follow-up keeps Party Mode active and should produce another serial/integration-aware turn rather than appending the report.
- Accepting an integrated conclusion should use the conclusion assistant message as `sourceMessageId`; this gives output append the same tenant/session/source validation as normal workflow sections.

### AI Label and Metadata Requirements

- The integrated conclusion content must visibly include `[AI Generated]` or be rendered with an equivalent visible label that is persisted with the message/output metadata.
- Output append must provide `aiLabelMetadata: { label: "AI Generated", visibleLabel: "[AI Generated]" }` and preserve provider metadata from the conclusion message.
- Message metadata should include enough traceability for tests and audit without leaking sensitive content: `party_mode_integration: true`, `party_mode_integration_status`, `party_mode_source_round`, `party_mode_source_message_ids` or a bounded pointer, and conclusion source message id.

### Previous Story Intelligence

- Story 5.1 made Party Mode availability server-owned through `THINKTANK_PARTY_MODE_ENABLED` and `THINKTANK_PARTY_MODE_TENANTS`. Do not trust browser-provided Party Mode state.
- Story 5.1 validates only latest assistant decision options and cleans up orphaned user/assistant messages after failed start/return attempts. New integration/accept actions need the same latest-option and cleanup discipline.
- Story 5.2 loads advisors from approved `_bmad/{bmm,cis,tea}/agents/**` sources and persists only sanitized source pointers/hashes. Story 5.4 must not reveal raw persona file content in prompts surfaced to users, message metadata, provider metadata, or telemetry.
- Story 5.3 added one Party Mode user turn followed by serial advisor messages, current-speaker SSE events, addressed expert validation, per-session async locking, and rollback cleanup. Integration must work with that lock and not create duplicate turns under concurrent submissions.
- Story 5.3 deliberately disabled prompt cache for Party Mode advisor calls to avoid source refs/hashes crossing provider cache boundaries. Keep this behavior unless a separate safe cache policy is implemented outside this story.

### Scope Boundaries

| Capability | Owner |
| --- | --- |
| Start Party Mode from workflow decision controls | Story 5.1 |
| Load/select personas and explain selected/omitted advisors | Story 5.2 |
| Serial advisor messages, current speaker state, expert identity UI, reply-to-expert | Story 5.3 |
| Differentiated framework/lens assignment and integrated conclusion/report append | Story 5.4 |
| Budget enforcement, timeout/retry/partial failure telemetry | Story 5.5 |

### Testing Requirements

- Follow TDD: create the ATDD artifact and failing tests before production changes.
- Backend focused commands:
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand`
  - `cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts --runInBand`
  - `cd backend && npx tsc --noEmit`
- Frontend focused commands:
  - `cd frontend && npm run test -- components/advisory/AdvisoryChatMessage --runInBand`
  - `cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell --runInBand`
  - `cd frontend && npm run test -- lib/advisory/streaming --runInBand`
  - `cd frontend && npx tsc --noEmit`
- No tests may depend on live GLM/network/provider calls. Use fake provider chunks and deterministic fixtures.
- Tests should use role, label, visible text, and accessible names. Do not add production `data-testid`.

### Project Structure Notes

- Keep implementation close to existing `advisory-session.service.ts` seams unless extraction clearly reduces complexity. If extraction is needed, use a focused service under `backend/src/modules/advisory/sessions/` or `backend/src/modules/advisory/party-mode/` and register it in `advisory.module.ts`.
- Keep output append behavior server-validated by tenant/session/source message. Do not let the browser send arbitrary report content on accept.
- Evidence artifacts belong under `_bmad-output/test-artifacts/`; this folder is ignored by default and needs `git add -f` during checkpoint commit.

### Latest Technical Information

- No external dependency or version research is required for this story. Use the checked-in NestJS, Next.js, TypeScript, shadcn/ui/Tailwind, existing provider gateway, and existing advisory session/output APIs.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 5 and Story 5.4 acceptance criteria.
- `_bmad-output/planning-artifacts/thinktank-prd.md` - FR24, FR26, FR33, NFR10.
- `_bmad-output/planning-artifacts/ux-design-specification-thinktank.md` - UX-DR16, Journey 4, Party Mode serial discussion and integration return.
- `_bmad-output/planning-artifacts/architecture-thinktank.md` - Advisory session/runtime/output organization and SSE/API boundaries.
- `_bmad-output/implementation-artifacts/5-1-party-mode-entry-from-workflow.md` - start/return/latest decision/rollback guardrails.
- `_bmad-output/implementation-artifacts/5-2-advisor-persona-loading-and-selection.md` - selected advisor metadata and sanitized source boundaries.
- `_bmad-output/implementation-artifacts/5-3-serial-expert-discussion-experience.md` - serial turn, current-speaker, addressed reply, and stream rollback contract.
- `backend/src/modules/advisory/sessions/advisory-session.service.ts` - Party Mode orchestration and output append seams.
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx` - decision actions, streaming state, output append, document drawer.
- `frontend/components/advisory/AdvisoryChatMessage.tsx` - message rendering and decision controls.
- `frontend/lib/advisory/streaming.ts` - SSE event parser and submit payload contract.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-22: Story context created from Epic 5 Story 5.4, Story 5.1/5.2/5.3 handoffs, PRD FR24/FR26/FR33, UX Journey 4, and existing advisory session/output architecture.

### Completion Notes List

- Implemented deterministic Party Mode analysis framework assignment with per-turn deduplication and scalar-safe advisor/provider metadata.
- Added Party Mode integration decision actions: `integrate-party-mode` creates an AI-generated integrated conclusion, and `accept-party-mode-conclusion` appends the accepted conclusion to the active report draft before returning to workflow.
- Preserved follow-up-before-accept behavior by keeping Party Mode active after integration and exposing a `deepen` follow-up option beside accept/return controls.
- Fixed code review findings for integration SSE event ordering, stale/source-bound decision validation, idempotent output append, metadata privacy, and frontend refresh error wording.
- Completed ATDD, code review, traceability, and PASS gate artifacts for Story 5.4.

### File List

- `_bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-5-4-differentiated-frameworks-and-integrated-conclusion.md`
- `_bmad-output/test-artifacts/code-review-story-5-4-differentiated-frameworks-and-integrated-conclusion.md`
- `_bmad-output/test-artifacts/traceability-story-5-4-differentiated-frameworks-and-integrated-conclusion-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-5-4-differentiated-frameworks-and-integrated-conclusion.md`
- `_bmad-output/test-artifacts/gate-decision-story-5-4-differentiated-frameworks-and-integrated-conclusion.yaml`
- `backend/src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts`
- `backend/src/modules/advisory/sessions/advisory-session.service.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.ts`
- `backend/src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts`
- `frontend/components/advisory/AdvisoryChatMessage.tsx`
- `frontend/components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx`
- `frontend/lib/advisory/streaming.ts`

## Change Log

- 2026-05-22: Created Story 5.4 implementation context and marked ready-for-dev.
- 2026-05-22: Completed Story 5.4 implementation, review fixes, traceability, and PASS gate; marked story done.
