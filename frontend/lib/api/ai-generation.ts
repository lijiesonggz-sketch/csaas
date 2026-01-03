/**
 * AI生成API客户端
 */

import { GenerateResponse, GetResultResponse } from '../types/ai-generation'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// AI生成任务的超时时间（20分钟 = 1200000ms）
// 比后端的15分钟超时更长，确保前端不会先超时
const GENERATION_TIMEOUT = 20 * 60 * 1000

/**
 * 创建带超时的fetch请求
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = GENERATION_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`请求超时（${timeout / 60000}分钟）`)
    }
    throw error
  }
}

export interface GenerateSummaryRequest {
  taskId: string
  standardDocument: string
  temperature?: number
  maxTokens?: number
}

export interface StandardDocument {
  id: string
  name: string
  content: string
}

export interface GenerateClusteringRequest {
  taskId: string
  documents: StandardDocument[]
  projectId?: string // 可选的项目ID
  temperature?: number
  maxTokens?: number
}

export interface GenerateMatrixRequest {
  taskId: string
  clusteringResult: any // ClusteringGenerationOutput from backend
  temperature?: number
  maxTokens?: number
}

export interface GenerateQuestionnaireRequest {
  taskId: string
  matrixTaskId: string // 矩阵任务ID（从数据库获取矩阵结果，避免HTTP请求体过大）
  temperature?: number
  maxTokens?: number
}

export interface GenerateActionPlanRequest {
  taskId: string
  matrixTaskId: string // 矩阵任务ID
  surveyResponseId: string // 问卷填写记录ID（包含用户答案）
  temperature?: number
  maxTokens?: number
}

export class AIGenerationAPI {
  /**
   * 生成综述
   */
  static async generateSummary(request: GenerateSummaryRequest): Promise<GenerateResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ai-generation/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate summary')
    }

    return response.json()
  }

  /**
   * 生成聚类（多文档合并）
   */
  static async generateClustering(request: GenerateClusteringRequest): Promise<GenerateResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ai-generation/clustering`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate clustering')
    }

    return response.json()
  }

  /**
   * 获取生成结果
   */
  static async getResult(taskId: string): Promise<GetResultResponse> {
    const response = await fetch(`${API_BASE_URL}/ai-generation/result/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get result')
    }

    const result = await response.json()
    return result
  }

  /**
   * 获取最终结果（考虑人工修改）
   */
  static async getFinalResult(taskId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/ai-generation/final-result/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get final result')
    }

    return response.json()
  }

  /**
   * 生成成熟度矩阵
   */
  static async generateMatrix(request: GenerateMatrixRequest): Promise<GenerateResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ai-generation/matrix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate matrix')
    }

    return response.json()
  }

  /**
   * 生成调研问卷
   */
  static async generateQuestionnaire(request: GenerateQuestionnaireRequest): Promise<GenerateResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ai-generation/questionnaire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate questionnaire')
    }

    return response.json()
  }

  /**
   * 生成落地措施
   */
  static async generateActionPlan(request: GenerateActionPlanRequest): Promise<GenerateResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ai-generation/action-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate action plan')
    }

    return response.json()
  }

  /**
   * 更新审核状态
   */
  static async updateReviewStatus(
    resultId: string,
    reviewStatus: 'APPROVED' | 'MODIFIED' | 'REJECTED',
    reviewedBy: string,
    modifiedResult?: Record<string, any>,
    reviewNotes?: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai-generation/review/${resultId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reviewStatus,
        reviewedBy,
        modifiedResult,
        reviewNotes,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update review status')
    }
  }
}
