import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator'

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

export type ControlReportControlNodeDto = {
  controlId: string
  controlCode: string
  controlName: string
  currentStatus: ControlReportGapStatus
  gapLevel: ControlReportGapLevel
  clauses: ControlReportClauseDto[]
  cases: ControlReportCaseDto[]
  evidences: ControlReportEvidenceDto[]
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
