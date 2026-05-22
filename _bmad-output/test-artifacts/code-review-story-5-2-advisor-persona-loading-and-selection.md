---
storyId: 5-2-advisor-persona-loading-and-selection
reviewedAt: '2026-05-22T11:22:05+08:00'
result: PASS
---

# Code Review: Story 5.2 Advisor Persona Loading and Selection

## Review Layers

- Blind Hunter: completed.
- Edge Case Hunter: completed.
- Acceptance Auditor: completed.

## Findings Resolved

| Finding | Category | Resolution |
| --- | --- | --- |
| Team roster allowlist could fail open to every manifest advisor when rows lacked source paths. | MEDIUM | Team rows now resolve name-only entries through the manifest and do not fall back to all manifest advisors when team rosters contain invalid rows. |
| Party Mode could start without advisor selection if the persona service was missing. | MEDIUM | Party Mode start now requires `ThinkTankPartyModeAdvisorPersonaService` and fails closed if it is unavailable. |
| Persona source-load failures were swallowed too broadly. | PATCH | Only recoverable file-not-found/unreadable/empty errors become omissions; source boundary and unsupported-source errors propagate. |
| Integration mock permitted impossible advisor state. | PATCH | Omitted-advisor service test mock now includes the three viable selected advisors. |
| Invalid target/minimum advisor counts were not guarded. | PATCH | Invalid counts are rejected before file loading. |
| CSV source paths could point to non-agent approved runtime files. | PATCH | Loaded advisor sources must resolve under `_bmad/{bmm,cis,tea}/agents/**` with supported agent definition extensions. |
| Advisor metadata could collide with internal Party Mode metadata. | PATCH | Session metadata now picks a whitelist of scalar-safe advisor keys. |
| Advisor selection did not use step/message relevance. | ACCEPTANCE | Candidate ordering now combines workflow preference with context relevance from workflow key, step label/source ref, latest user message, capabilities, role, identity, and principles. |
| Omission text could overclaim that the same perspective was covered. | ACCEPTANCE | Omission text is neutral and does not claim equivalent perspective coverage. |
| Invalid roster rows were silently dropped. | ACCEPTANCE | Invalid roster rows are recorded as visible omissions when the viable advisor set remains. |

## Verification

Passed:

```bash
cd backend && npm run test -- src/modules/advisory/runtime/party-mode-advisor-persona.service.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.party-mode-entry.atdd.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/runtime --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/advisory-session.repository.spec.ts --runInBand
cd backend && npm run test -- src/modules/advisory/sessions/dto/submit-advisory-message.dto.spec.ts --runInBand
cd backend && npx tsc --noEmit
```

## Result

No blocking findings remain. Story 5.2 can proceed to trace/gate and done marking.
