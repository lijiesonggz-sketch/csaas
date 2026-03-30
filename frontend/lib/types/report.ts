export type ControlReportGapStatus = 'COMPLIANT' | 'PARTIAL' | 'INCOMPLETE'
export type ControlReportGapLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ControlReportClauseDto {
  clauseId: string
  clauseCode: string
  articleNo: string | null
  clauseSummary: string | null
  sourceName: string | null
}

export interface ControlReportCaseDto {
  caseId: string
  caseCode: string
  caseTitle: string | null
  sourceOrg: string | null
  authorityName: string | null
}

export interface ControlReportEvidenceDto {
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

export interface ControlReportRecommendationDto {
  controlId: string
  remediationActionId: string
  actionCode: string
  actionTitle: string
  actionDesc: string | null
  priority: string | null
  effortLevel?: string | null
  currentStatus: ControlReportGapStatus
  gapLevel: ControlReportGapLevel
  expectedBenefit: string | null
}

export interface ControlReportMatchedControlReference {
  controlId: string
  controlName: string
  packSource: string
  priority: string
}

export interface ControlReportControlNodeDto {
  controlId: string
  controlCode: string
  controlName: string
  currentStatus: ControlReportGapStatus
  gapLevel: ControlReportGapLevel
  clauses: ControlReportClauseDto[]
  cases: ControlReportCaseDto[]
  evidences: ControlReportEvidenceDto[]
  recommendations: ControlReportRecommendationDto[]
  matchedControls: ControlReportMatchedControlReference[]
  sourceModule: 'report'
  sourceRecordId: string
  sourceRoute: string
}

export interface ControlReportL2SectionDto {
  l2Code: string
  l2Name: string
  controls: ControlReportControlNodeDto[]
}

export interface ControlReportSectionDto {
  l1Code: string
  l1Name: string
  l2Sections: ControlReportL2SectionDto[]
}
