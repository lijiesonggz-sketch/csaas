# Code Review - Story 1.5 Governed AI Provider Gateway

**Date:** 2026-05-19
**Scope:** Current Story 1.5 backend and BMAD artifact changes
**Mode:** Full review against `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md`

## Result

PASS after one patch finding was fixed.

## Findings

### Fixed

1. **Streaming fake path did not expose deterministic token/cost metadata**
   - Category: patch
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter.ts`
   - Detail: The first implementation streamed deterministic chunks but the final fake stream chunk did not include deterministic usage/cost metadata, so gateway streaming telemetry had to estimate usage from output text. Story 1.5 explicitly requires scripted streaming plus token/cost metadata for no-network tests.
   - Resolution: Added deterministic usage/cost/model metadata to the final fake stream chunk, updated gateway streaming telemetry to prefer chunk-provided usage/cost, and added a regression assertion in `thinktank-provider-gateway.service.spec.ts`.

## Verification After Fix

- `PASS cd backend && npm run test -- thinktank-provider advisory-event thinktank-event --runInBand` (5 suites, 22 tests)
- `PASS cd backend && npx tsc --noEmit`
- `PASS cd backend && npm run orm:entities:parity`
- `KNOWN UNRELATED FAILURES cd backend && npm test -- --runInBand`:
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-003]`
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-007]`
  - `taxonomy-domain-gate.atdd-8-2.spec.ts` `[8.2-SVC-003][P1]`

## Final Review Conclusion

No blocking Story 1.5 review findings remain.

---

# Re-Review - Story 1.5 Governed AI Provider Gateway

**Date:** 2026-05-20
**Scope:** Re-review of Story 1.5 implementation at `e0525bf^..e0525bf` plus current HEAD code state
**Mode:** Full review against `_bmad-output/implementation-artifacts/1-5-governed-ai-provider-gateway.md`

## Result

PASS after automatic fixes for all HIGH and MEDIUM findings.

## Findings Fixed

1. **Streaming gateway bypassed retry and timeout governance**
   - Severity: High
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
   - Resolution: Streaming now uses the gateway retry loop, per-read timeout, abort signaling, retry telemetry before first chunk, failed telemetry on terminal error, and completed telemetry after normal exhaustion.

2. **Provider timeout did not abort the underlying request**
   - Severity: High
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`, `thinktank-provider-gateway.types.ts`, `providers/anthropic-glm-provider.adapter.ts`
   - Resolution: Adapter contract now accepts `AbortSignal`; gateway aborts on timeout; Anthropic GLM adapter passes the signal into SDK request options.

3. **Telemetry persistence failure could turn a successful provider call into a business failure**
   - Severity: High
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
   - Resolution: Provider telemetry emission is now best-effort and logs failures without changing provider success/error outcomes.

4. **Fake streaming ignored scripted failure/timeout behavior**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter.ts`
   - Resolution: Fake streaming consumes the same script state as non-streaming calls, covering success, retryable failure, failure, and timeout.

5. **Failed/retried provider telemetry omitted token metadata**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
   - Resolution: `call_failed` and `call_retried` now include deterministic `estimatedTokens: 0` when usage is unavailable.

6. **Validation errors could be misclassified as provider errors**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service.ts`
   - Resolution: Gateway boundary validation now returns stable `THINKTANK_PROVIDER_INVALID_REQUEST` errors for missing tenant/actor/model, empty message content, invalid `maxTokens`, and invalid `temperature`.

7. **GLM live mode could silently target Anthropic default endpoint**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config.ts`, `providers/anthropic-glm-provider.adapter.ts`
   - Resolution: GLM live mode now requires explicit `GLM_API_KEY` and `GLM_BASE_URL`; Anthropic env fallback was removed; adapter is disabled unless live GLM config is complete.

8. **Live adapter exposed provider error message details and accepted empty text success**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter.ts`
   - Resolution: Normalized GLM errors use a fixed safe message; empty text responses are converted to normalized provider failure.

9. **Live adapter declared fake streaming by wrapping non-streaming completion**
   - Severity: Medium
   - Location: `backend/src/modules/advisory/provider-gateway/providers/anthropic-glm-provider.adapter.ts`
   - Resolution: Removed the live adapter `stream()` shim so the gateway fallback path is explicit until real live streaming is implemented.

## Verification After Fix

- `PASS cd backend && npm run test -- thinktank-provider advisory-event thinktank-event --runInBand` (5 suites, 30 tests)
- `PASS cd backend && npx tsc --noEmit`
- `PASS cd backend && npm run orm:entities:parity`
- `KNOWN UNRELATED FAILURES cd backend && npm test -- --runInBand`:
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-003]`
  - `taxonomy-domain-gate.automation.spec.ts` `[P0][6.5-AUTO-007]`
  - `taxonomy-domain-gate.atdd-8-2.spec.ts` `[8.2-SVC-003][P1]`

## Final Re-Review Conclusion

No blocking Story 1.5 review findings remain after the automatic fix pass.
