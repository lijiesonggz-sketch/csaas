import { apiFetch } from '../utils/api'

export type ResolveControlsScene = 'quick-gap-analysis' | 'survey' | 'radar' | 'report'
export type ResolutionPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ResolveControlsRequest {
  organizationId: string
  scene?: ResolveControlsScene
}

export interface ResolveControlsDebugTraceEntry {
  field: string
  op: string
  expectedValue?: boolean | number | string | string[]
  actualValue: unknown
  matched: boolean
  logicalPath: string[]
}

export interface ResolveControlsDebugEntry {
  ruleCode: string
  targetType: 'pack' | 'control'
  targetCode: string
  ruleType: 'include' | 'exclude' | 'strengthen' | 'recommend'
  matched: boolean
  traceEntries: ResolveControlsDebugTraceEntry[]
  appliedEffect: {
    addedPackCodes: string[]
    addedControlCodes: string[]
    strengthenedControlCodes: string[]
    excludedControlCodes: string[]
    noOpReason?: string
  }
}

export interface ResolvedControl {
  controlId: string
  controlCode: string
  controlName: string
  controlFamily: string
  mandatory: boolean
  priority: ResolutionPriority
  matchedPacks: string[]
  matchedRules: string[]
  reasons: string[]
  questionPackCodes: string[]
  evidencePackCodes: string[]
  remediationPackCodes: string[]
}

export interface ResolveControlsResponse {
  organizationId: string
  scene?: ResolveControlsScene
  influencingProfileFields: string[]
  matchedPacks: string[]
  matchedRules: string[]
  controls: ResolvedControl[]
  summary: {
    totalControls: number
    mandatoryCount: number
    matchedPacks: number
    matchedRules: number
    excludedControls: number
  }
  debugLog: ResolveControlsDebugEntry[]
}

export async function resolveControls(
  payload: ResolveControlsRequest,
): Promise<ResolveControlsResponse> {
  return apiFetch('/applicability-engine/resolve-controls', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
