/**
 * 问卷填写API客户端
 */

import { apiFetch } from '../utils/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface CreateSurveyRequest {
  questionnaireTaskId: string
  respondentName: string
  respondentEmail?: string
  respondentDepartment?: string
  respondentPosition?: string
}

export interface SaveDraftRequest {
  answers: Record<string, any>
  progressPercentage?: number
  totalScore?: number
  maxScore?: number
}

export interface SubmitSurveyRequest {
  answers: Record<string, any>
  totalScore: number
  maxScore: number
  notes?: string
}

export interface SurveyResponse {
  id: string
  questionnaireTaskId: string
  respondentName: string
  respondentEmail: string | null
  respondentDepartment: string | null
  respondentPosition: string | null
  status: 'draft' | 'submitted' | 'completed'
  answers: Record<string, any>
  progressPercentage: number
  totalScore: number | null
  maxScore: number | null
  startedAt: string
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  notes: string | null
}

export type ProjectQuestionnaireSnapshotLifecycleStatus = 'draft' | 'published' | 'superseded'

export interface ProjectQuestionnaireSnapshotOption {
  option_id: string
  text: string
  score: number
  level?: string
  description?: string
}

export interface ProjectQuestionnaireSnapshotQuestion {
  question_id: string
  question_template_id: string | null
  source_question_id?: string | null
  control_id: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING'
  options: ProjectQuestionnaireSnapshotOption[]
  required: boolean
  guidance: string
  display_order: number
  scoring_rule: Record<string, unknown> | null
  is_project_custom: boolean
}

export interface ProjectQuestionnaireSnapshotResponse {
  projectId: string
  organizationId: string
  questionnaireTaskId: string
  generatedAt: string
  snapshotVersion: number
  resolvedControlSetVersion: string
  questionSetVersion: string
  sourceControlIds: string[]
  missingQuestionControlIds: string[]
  reusedExisting: boolean
  lifecycleStatus: ProjectQuestionnaireSnapshotLifecycleStatus
  publishedSnapshotTaskId: string | null
  baseSnapshotTaskId: string | null
  editVersion: number
  lastEditedAt: string | null
  lastEditedBy: string | null
  questions: ProjectQuestionnaireSnapshotQuestion[]
}

export interface SaveProjectQuestionnaireSnapshotDraftRequest {
  questions: Array<{
    questionId?: string
    questionTemplateId?: string | null
    controlId: string
    questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING'
    questionText: string
    options: Array<{
      optionId?: string
      text: string
      score: number
      level?: string
      description?: string
    }>
    scoringRule?: Record<string, unknown> | null
    required: boolean
    displayOrder: number
  }>
}

export interface ProjectQuestionnairePublishImpactResponse {
  projectId: string
  questionnaireTaskId: string
  publishedSnapshotTaskId: string | null
  requiresDownstreamRefresh: boolean
  staleTargets: Array<'gap-analysis' | 'action-plan' | 'report'>
  changeTypes: Array<
    | 'question_text'
    | 'option_text'
    | 'option_score'
    | 'scoring_rule'
    | 'question_added'
    | 'question_removed'
    | 'required'
    | 'display_order'
  >
  message: string
}

export interface ProjectQuestionnaireFreshnessResponse {
  projectId: string
  surveyResponseId: string
  questionnaireTaskId: string
  latestPublishedSnapshotTaskId: string | null
  isStale: boolean
  staleTargets: Array<'gap-analysis' | 'action-plan' | 'report'>
  changeTypes: Array<
    | 'question_text'
    | 'option_text'
    | 'option_score'
    | 'scoring_rule'
    | 'question_added'
    | 'question_removed'
    | 'required'
    | 'display_order'
  >
  message: string | null
}

export class SurveyAPI {
  static async createProjectQuestionnaireSnapshot(request: {
    projectId: string
    regenerate?: boolean
  }): Promise<ProjectQuestionnaireSnapshotResponse> {
    return apiFetch('/survey/project-questionnaire-snapshot', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  static async getProjectQuestionnaireSnapshot(
    projectId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponse> {
    return apiFetch(`/survey/project-questionnaire-snapshot/${projectId}`)
  }

  static async saveProjectQuestionnaireSnapshotDraft(
    projectId: string,
    request: SaveProjectQuestionnaireSnapshotDraftRequest,
  ): Promise<ProjectQuestionnaireSnapshotResponse> {
    return apiFetch(`/survey/project-questionnaire-snapshot/${projectId}/draft`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })
  }

  static async publishProjectQuestionnaireSnapshot(
    projectId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponse> {
    return apiFetch(`/survey/project-questionnaire-snapshot/${projectId}/publish`, {
      method: 'POST',
    })
  }

  static async getProjectQuestionnairePublishImpact(
    projectId: string,
  ): Promise<ProjectQuestionnairePublishImpactResponse> {
    return apiFetch(`/survey/project-questionnaire-snapshot/${projectId}/publish-impact`)
  }

  static async getQuestionnaireFreshness(
    surveyResponseId: string,
  ): Promise<ProjectQuestionnaireFreshnessResponse> {
    return apiFetch(`/survey/questionnaire-freshness/${surveyResponseId}`)
  }

  /**
   * 创建新的问卷填写记录
   */
  static async createSurvey(request: CreateSurveyRequest): Promise<{ success: boolean; data: SurveyResponse }> {
    const response = await fetch(`${API_BASE_URL}/survey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create survey')
    }

    return response.json()
  }

  /**
   * 保存问卷草稿
   */
  static async saveDraft(surveyId: string, request: SaveDraftRequest): Promise<{ success: boolean; data: SurveyResponse }> {
    const response = await fetch(`${API_BASE_URL}/survey/${surveyId}/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to save draft')
    }

    return response.json()
  }

  /**
   * 提交问卷
   */
  static async submitSurvey(surveyId: string, request: SubmitSurveyRequest): Promise<{ success: boolean; data: SurveyResponse }> {
    const response = await fetch(`${API_BASE_URL}/survey/${surveyId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to submit survey')
    }

    return response.json()
  }

  /**
   * 获取问卷填写记录
   */
  static async getSurvey(surveyId: string): Promise<{ success: boolean; data: SurveyResponse }> {
    const response = await fetch(`${API_BASE_URL}/survey/${surveyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get survey')
    }

    return response.json()
  }

  /**
   * 获取问卷任务的所有填写记录
   */
  static async getSurveysByQuestionnaireTask(questionnaireTaskId: string): Promise<{ success: boolean; data: SurveyResponse[] }> {
    const response = await fetch(`${API_BASE_URL}/survey/by-questionnaire/${questionnaireTaskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get surveys')
    }

    return response.json()
  }

  /**
   * 删除问卷填写记录
   */
  static async deleteSurvey(surveyId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/survey/${surveyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete survey')
    }
  }

  /**
   * 分析问卷成熟度
   */
  static async analyzeSurvey(surveyId: string): Promise<{ success: boolean; data: any; message: string }> {
    const response = await fetch(`${API_BASE_URL}/survey/${surveyId}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to analyze survey')
    }

    return response.json()
  }

  /**
   * 上传并分析问卷答案（用于差距分析）
   */
  static async uploadAndAnalyze(request: {
    projectId: string
    questionnaireData: {
      respondentInfo: {
        name: string
        department?: string
        position?: string
        submittedAt: string
      }
      answers: Record<string, string>
      totalScore: number
      maxScore: number
    }
  }): Promise<{ success: boolean; data: any; message: string }> {
    const response = await fetch(`${API_BASE_URL}/survey/upload-and-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to upload and analyze')
    }

    return response.json()
  }
}
