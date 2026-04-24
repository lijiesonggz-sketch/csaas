import type {
  TaxonomyDomainProfile,
  TaxonomyDomainReadiness,
  TaxonomyFallbackPolicy,
  TaxonomyGatePolicy,
} from '../contracts/classification-result.contract'

export const DEFAULT_GATE_POLICY: TaxonomyGatePolicy =
  'requires-domain-rollout-policy'
export const DEFAULT_FALLBACK_POLICY: TaxonomyFallbackPolicy =
  'legacy-fallback-when-rollout-enabled'
export const DEFAULT_RUNTIME_READINESS_STAGE = 'runtime-classifier-ready'

type BuildDomainProfileArgs = Omit<
  TaxonomyDomainProfile,
  'scoreGapStrategy' | 'gatePolicy' | 'fallbackPolicy'
>

export function buildDomainProfile(
  args: BuildDomainProfileArgs,
): TaxonomyDomainProfile {
  return {
    ...args,
    scoreGapStrategy: 'default',
    gatePolicy: DEFAULT_GATE_POLICY,
    fallbackPolicy: DEFAULT_FALLBACK_POLICY,
  }
}

export function buildDomainReadiness(
  l1Code: string,
): TaxonomyDomainReadiness {
  return {
    stage: DEFAULT_RUNTIME_READINESS_STAGE,
    verifiableEntryPoint: `TAXONOMY_DOMAIN_REGISTRY.${l1Code}`,
  }
}
