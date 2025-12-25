/**
 * AI生成API客户端
 */

import { GenerateResponse, GetResultResponse } from '../types/ai-generation'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface GenerateSummaryRequest {
  taskId: string
  standardDocument: string
  temperature?: number
  maxTokens?: number
}

export class AIGenerationAPI {
  /**
   * 生成综述
   */
  static async generateSummary(request: GenerateSummaryRequest): Promise<GenerateResponse> {
    const response = await fetch(`${API_BASE_URL}/ai-generation/summary`, {
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

    return response.json()
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
