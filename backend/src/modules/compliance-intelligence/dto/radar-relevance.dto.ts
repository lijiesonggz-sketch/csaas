import { IsOptional, IsUUID } from 'class-validator'

export class CalculateRadarRelevanceDto {
  @IsUUID()
  organizationId: string

  @IsUUID()
  contentId: string

  @IsOptional()
  @IsUUID()
  surveyResponseId?: string
}

export const RADAR_RELEVANCE_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type RadarRelevancePriority = (typeof RADAR_RELEVANCE_PRIORITIES)[number]
export const RADAR_RELEVANCE_SUGGESTED_CHECK_TYPES = [
  'QUESTION',
  'REMEDIATION',
  'CLAUSE',
  'CASE',
] as const
export type RadarRelevanceSuggestedCheckType =
  (typeof RADAR_RELEVANCE_SUGGESTED_CHECK_TYPES)[number]

export type RadarRelevanceMatchedControlDto = {
  controlId: string
  controlCode: string
  controlName: string
  reason: string
}

export type RadarRelevanceMatchedCaseDto = {
  controlId: string
  caseId: string
  caseCode: string
  caseTitle: string | null
  sourceOrg: string | null
  authorityName: string | null
}

export type RadarRelevanceMatchedClauseDto = {
  controlId: string
  clauseId: string
  clauseCode: string
  articleNo: string | null
  clauseSummary: string | null
  sourceName: string | null
}

export type RadarRelevanceSuggestedCheckDto = {
  controlId: string
  controlCode: string
  checkType: RadarRelevanceSuggestedCheckType
  sourceId: string | null
  sourceCode: string | null
  title: string
  detail: string | null
  priority: RadarRelevancePriority
}

export type RadarRelevanceResponseDto = {
  relevanceScore: number
  priority: RadarRelevancePriority
  matchedControls: RadarRelevanceMatchedControlDto[]
  matchedCases: RadarRelevanceMatchedCaseDto[]
  matchedClauses: RadarRelevanceMatchedClauseDto[]
  suggestedChecks: RadarRelevanceSuggestedCheckDto[]
}
