# Code Review: Story 5.4 Differentiated Frameworks and Integrated Conclusion

Date: 2026-05-22

## Scope

- Diff source: uncommitted Story 5.4 working tree changes.
- Spec: `_bmad-output/implementation-artifacts/5-4-differentiated-frameworks-and-integrated-conclusion.md`
- Review layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor.

## Findings And Disposition

| Finding | Category | Disposition |
| --- | --- | --- |
| Integration SSE emitted no `message.started` until provider completion and did not forward deltas | patch | Fixed. Streaming branch now emits `message.started`, replays integration `message.delta`, then emits `message.completed`; covered by `[5.4-BE-006]`. |
| Framework assignment could collapse multiple advisors onto the same lens | patch | Fixed. Advisor framework assignment now deduplicates within a turn; covered by `[5.4-BE-005]`. |
| Framework instruction was persisted in message/provider metadata | patch | Fixed. Instruction remains in system prompt only; persisted metadata keeps scalar framework name. |
| Accept retry could duplicate output section if return finalization failed after append | patch | Fixed. Output append is idempotent by source message id; covered by `[5.4-BE-007]`. |
| Integration action could target a stale or partial advisor round | patch | Fixed. Integration validates the option message is the latest advisor message for the latest round; optional source message id is enforced when provided. |
| Accept action could target a different latest integration than the clicked UI message | patch | Fixed. Frontend passes the clicked decision message id; backend enforces it when provided. |
| Frontend refresh failure after successful accept was reported as append failure | patch | Fixed. UI now reports output refresh failure without claiming the server append failed. |
| Integration conclusion controls lacked explicit follow-up-before-accept affordance | patch | Fixed. Integration decision options now include `继续追问` using the existing deepen/focus behavior while Party Mode stays active. |
| Provider output could include hidden prompt/source paths | defer | Existing system prompt forbids disclosure and metadata source boundaries are tested. Full content safety filtering is broader than Story 5.4. |
| Story status still showed `ready-for-dev` during implementation | reject | Expected intermediate state during pipeline; story and sprint status are updated after review and trace gates. |
| Report append ignores `party_mode_output_id` | reject | Repository enforces one active draft per session; append uses tenant/session validated active draft and source message. No wrong-output path is introduced by this story. |
| Accept option remains visible in already-rendered history after successful return | defer | Backend latest-option validation rejects repeated acceptance; UI receives returned workflow message as latest decision state. Historical message mutation is not required for AC3. |

## Summary

- Intent gaps: 0
- Bad spec: 0
- Patch findings: 8, all fixed
- Deferred findings: 2
- Rejected/noise findings: 2

## Verification After Fixes

```bash
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-integration.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-serial.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.outputs.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.messages.controller.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand
cd backend && npx tsc --noEmit
cd frontend && npm run test -- components/advisory/AdvisoryChatMessage.party-mode.atdd.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell.resume-session.test.tsx --runInBand
cd frontend && npm run test -- components/advisory/AdvisoryWorkspaceShell --runInBand
cd frontend && npm run test -- lib/advisory/streaming.party-mode.atdd.test.ts --runInBand
cd frontend && npx tsc --noEmit
```

Result: pass.
