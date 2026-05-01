import { apiFetch } from '../utils/api'

export type TaxonomyRolloutState =
  | 'legacy-primary'
  | 'it04-on-new-interface'
  | 'domain-shadow'
  | 'domain-compare'
  | 'domain-primary'
  | 'legacy-off'

export interface TaxonomyRolloutPolicyListItem {
  id: string | null
  l1Code: string
  rolloutState: TaxonomyRolloutState
  allowLegacyFallback: boolean
  killSwitchEnabled: boolean
  activeClassifierVersion: string | null
  primaryThreshold: number
  shadowWindowDays: number
  stateChangedAt: string | null
  stateAllowsPrimary: boolean
  stateAllowsLegacyFallback: boolean
  hasRetirementEvidence: boolean
}

export interface TaxonomyRolloutPolicyDetail extends TaxonomyRolloutPolicyListItem {
  mappingOwner: string
  rulebookOwner: string
  benchmarkOwner: string
  gateApprover: string
  rollbackApprover: string
  cutoverThresholdsJson: Record<string, unknown>
  retirementThresholdsJson: Record<string, unknown>
  retirementEvidenceJson: {
    lastCutoverAt: string | null
    lastCutoverReleaseId: string | null
    lastLegacyOffAt: string | null
    lastLegacyOffReleaseId: string | null
    lastKillSwitchDrillAt: string | null
    lastRollbackVerifiedAt: string | null
    lastReclassifyVerifiedAt: string | null
    lastBackfillVerifiedAt: string | null
    lastSmokeVerifiedAt: string | null
    lastRetirementReportPath: string | null
  }
  updatedAt: string | null
}

export async function fetchRolloutPolicies(): Promise<TaxonomyRolloutPolicyListItem[]> {
  return apiFetch<TaxonomyRolloutPolicyListItem[]>(
    '/api/admin/knowledge-graph/taxonomy-rollout/policies'
  )
}

export async function fetchRolloutPolicyByL1Code(
  l1Code: string
): Promise<TaxonomyRolloutPolicyDetail> {
  return apiFetch<TaxonomyRolloutPolicyDetail>(
    `/api/admin/knowledge-graph/taxonomy-rollout/policies/${l1Code}`
  )
}
