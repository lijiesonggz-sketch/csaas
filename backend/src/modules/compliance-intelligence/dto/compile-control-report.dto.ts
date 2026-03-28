import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator'
import type {
  ControlContext,
  MatchedControlReference,
  SourceModule,
} from './unified-control-context.dto'

export class CompileControlReportDto {
  @IsUUID()
  organizationId: string

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  controlIds: string[]

  @IsUUID()
  surveyResponseId: string
}

export type ControlReportGapStatus = 'COMPLIANT' | 'PARTIAL' | 'INCOMPLETE'
export type ControlReportGapLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type ControlReportClauseDto = {
  clauseId: string
  clauseCode: string
  articleNo: string | null
  clauseSummary: string | null
  sourceName: string | null
}

export type ControlReportCaseDto = {
  caseId: string
  caseCode: string
  caseTitle: string | null
  sourceOrg: string | null
  authorityName: string | null
}

export type ControlReportEvidenceDto = {
  id: string
  evidenceId: string
  evidenceCode: string
  evidenceName: string
  evidenceDesc: string | null
  evidenceCategory: string | null
  status: string
  requiredLevel: string
  notes: string | null
}

export type ControlReportRecommendationDto = {
  controlId: string
  remediationActionId: string
  actionCode: string
  actionTitle: string
  actionDesc: string | null
  priority: string | null
  currentStatus: ControlReportGapStatus
  gapLevel: ControlReportGapLevel
  expectedBenefit: string | null
}

export type ControlReportControlNodeDto = ControlContext & {
  controlId: string
  controlCode: string
  controlName: string
  currentStatus: ControlReportGapStatus
  gapLevel: ControlReportGapLevel
  clauses: ControlReportClauseDto[]
  cases: ControlReportCaseDto[]
  evidences: ControlReportEvidenceDto[]
  recommendations: ControlReportRecommendationDto[]
}

/**
 * 为控制报告节点添加上下文字段
 */
export function enrichControlNodeWithContext(
  node: Omit<ControlReportControlNodeDto, keyof ControlContext>,
  reportId: string,
): ControlReportControlNodeDto {
  // 单个控制点节点，controlId 直接使用节点的 controlId
  const controlId = node.controlId

  // 从节点构造单元素 matchedControls 数组
  const matchedControlsRef: MatchedControlReference[] = [
    {
      controlId: node.controlId,
      controlName: node.controlName,
      packSource: 'report', // 默认来源，可根据业务需求调整
      priority: node.gapLevel, // 使用 gapLevel 作为优先级
    },
  ]

  return {
    ...node,
    controlId,
    matchedControls: matchedControlsRef,
    sourceModule: 'report' as SourceModule,
    sourceRecordId: reportId,
    sourceRoute: `/reports/${reportId}`,
  }
}

export type ControlReportL2SectionDto = {
  l2Code: string
  l2Name: string
  controls: ControlReportControlNodeDto[]
}

export type ControlReportSectionDto = {
  l1Code: string
  l1Name: string
  l2Sections: ControlReportL2SectionDto[]
}

export type CompileControlReportResponseDto = {
  sections: ControlReportSectionDto[]
}
