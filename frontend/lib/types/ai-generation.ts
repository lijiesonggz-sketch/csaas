/**
 * AI生成相关的TypeScript类型定义
 */

export type GenerationType = 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type SelectedModel = 'gpt4' | 'claude' | 'domestic'

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED'

export interface QualityScores {
  structural: number
  semantic: number
  detail: number
}

export interface ConsistencyReport {
  agreements: string[]
  disagreements: string[]
  highRiskDisagreements: string[]
}

export interface CoverageReport {
  totalClauses: number
  coveredClauses: string[]
  missingClauses: string[]
  coverageRate: number
}

export interface SummaryResult {
  title: string
  overview: string
  key_areas: Array<{
    name: string
    description: string
    importance: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  scope: string
  key_requirements: string[]
  compliance_level: string
}

export interface GenerationResult {
  id: string
  taskId: string
  generationType: GenerationType
  selectedResult: Record<string, any>
  selectedModel: SelectedModel
  confidenceLevel: ConfidenceLevel
  qualityScores: QualityScores
  consistencyReport: ConsistencyReport
  coverageReport?: CoverageReport
  reviewStatus: ReviewStatus
  version: number
  createdAt: string
}

export interface GenerateResponse {
  success: boolean
  data: {
    taskId: string
    selectedResult: Record<string, any>
    selectedModel: SelectedModel
    confidenceLevel: ConfidenceLevel
    qualityScores: QualityScores
  }
}

export interface GetResultResponse {
  success: boolean
  data: GenerationResult
}
