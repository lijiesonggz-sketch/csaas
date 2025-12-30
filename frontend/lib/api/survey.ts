/**
 * 问卷填写API客户端
 */

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

export class SurveyAPI {
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
}
