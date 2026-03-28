import { IsOptional, IsUUID } from 'class-validator'
import type {
  ControlContext,
  MatchedControlReference,
  SourceModule,
} from './unified-control-context.dto'

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

export type RadarRelevanceResponseDto = ControlContext & {
  relevanceScore: number
  priority: RadarRelevancePriority
  matchedControls: RadarRelevanceMatchedControlDto[]
  matchedCases: RadarRelevanceMatchedCaseDto[]
  matchedClauses: RadarRelevanceMatchedClauseDto[]
  suggestedChecks: RadarRelevanceSuggestedCheckDto[]
}

/**
 * 转换 RadarRelevanceMatchedControlDto 为 MatchedControlReference
 */
export function toMatchedControlReference(
  control: RadarRelevanceMatchedControlDto,
): MatchedControlReference {
  return {
    controlId: control.controlId,
    controlName: control.controlName,
    packSource: control.reason || 'radar', // 从 reason 提取或默认
    priority: 'HIGH', // 默认优先级，实际应根据业务逻辑计算
  }
}

/**
 * 为 Radar 相关性响应添加上下文字段
 */
export function enrichRadarResponseWithContext(
  response: Omit<RadarRelevanceResponseDto, keyof ControlContext>,
  contentId: string,
): RadarRelevanceResponseDto {
  // 当有多个控制点时，controlId 为 null
  const controlId =
    response.matchedControls.length === 1
      ? response.matchedControls[0].controlId
      : null

  // 转换 matchedControls 为 MatchedControlReference 格式
  const matchedControlsRef: MatchedControlReference[] =
    response.matchedControls.map(toMatchedControlReference)

  return {
    ...response,
    controlId,
    matchedControls: matchedControlsRef,
    sourceModule: 'radar' as SourceModule,
    sourceRecordId: contentId,
    sourceRoute: `/radar/compliance/${contentId}`,
  }
}
