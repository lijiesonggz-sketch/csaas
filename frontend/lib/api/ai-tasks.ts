/**
 * AI Tasks API Client
 * 与后端 AITasks 模块交互
 */

import { getAuthHeadersAsync } from '@/lib/utils/jwt'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface CreateAITaskRequest {
  projectId: string
  type: 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan' | 'standard_interpretation' | 'standard_related_search' | 'standard_version_compare'
  input: any
}

export interface AITask {
  id: string
  projectId: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input: any
  result: any
  progress: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  backupResult?: any
  clusterGenerationStatus?: {
    totalClusters: number
    completedClusters: string[]
    failedClusters: string[]
    pendingClusters: string[]
    clusterProgress: Record<string, {
      clusterId: string
      clusterName: string
      status: 'pending' | 'generating' | 'completed' | 'failed'
      questionsGenerated: number
      questionsExpected: number
      startedAt?: string
      completedAt?: string
      error?: string
    }>
  }
}

export class AITasksAPI {
  /**
   * 获取认证headers
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    return getAuthHeadersAsync()
  }

  /**
   * 创建AI任务
   */
  static async createTask(request: CreateAITaskRequest): Promise<AITask> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create task')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取任务详情
   */
  static async getTask(taskId: string): Promise<AITask> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to get task')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取任务状态（包含细粒度进度信息）
   */
  static async getTaskStatus(taskId: string): Promise<{
    status: string
    stage: string
    progress: {
      gpt4?: { status: string; message: string; error?: string; duration_ms?: number; tokens?: number; cost?: number }
      claude?: { status: string; message: string; error?: string; duration_ms?: number; tokens?: number; cost?: number }
      domestic?: { status: string; message: string; error?: string; duration_ms?: number; tokens?: number; cost?: number }
      validation_stage?: string
      aggregation_stage?: string
      total_elapsed_ms?: number
    }
    message: string
  }> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/status`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to get task status')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取项目的所有任务
   */
  static async getTasksByProject(projectId: string): Promise<AITask[]> {
    console.log('🌐 [AITasksAPI] 正在获取项目任务:', projectId)
    const response = await fetch(`${API_BASE_URL}/ai-tasks/project/${projectId}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      console.error('❌ [AITasksAPI] API请求失败:', response.status, response.statusText)
      throw new Error('Failed to get tasks')
    }

    const result = await response.json()
    console.log('✅ [AITasksAPI] 获取到任务数:', result.data?.length || 0)
    return result.data
  }

  /**
   * 重试失败任务
   */
  static async retryTask(taskId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/retry`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to retry task')
    }
  }

  /**
   * 获取改进措施的详细列表（从 action_plan_measures 表）
   */
  static async getActionPlanMeasures(taskId: string): Promise<any[]> {
    console.log('🌐 [AITasksAPI] 正在获取改进措施详情:', taskId)
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/measures`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      console.error('❌ [AITasksAPI] 获取措施失败:', response.status, response.statusText)
      throw new Error('Failed to get action plan measures')
    }

    const result = await response.json()
    console.log('✅ [AITasksAPI] 获取到措施数:', result.data?.length || 0)
    return result.data || []
  }

  /**
   * ✅ 获取问卷任务的聚类生成状态
   */
  static async getClusterGenerationStatus(taskId: string): Promise<{
    totalClusters: number
    completedClusters: string[]
    failedClusters: string[]
    pendingClusters: string[]
    clusterProgress: Record<string, {
      clusterId: string
      clusterName: string
      status: 'pending' | 'generating' | 'completed' | 'failed'
      questionsGenerated: number
      questionsExpected: number
      startedAt?: string
      completedAt?: string
      error?: string
    }>
  }> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/cluster-status`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to get cluster generation status')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * ✅ 继续生成问卷（从上次中断的位置）
   */
  static async resumeQuestionnaireGeneration(taskId: string): Promise<{
    newTaskId: string
    originalTaskId: string
    clustersToGenerate: string[]
    totalClusters: number
    completedClusters: string[]
    nextClusterId: string
    message: string
  }> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/resume`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to resume questionnaire generation')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * ✅ 重新生成单个聚类的问题
   */
  static async regenerateCluster(taskId: string, clusterId: string): Promise<{
    newTaskId: string
    originalTaskId: string
    clusterId: string
    clusterName: string
    message: string
  }> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks/${taskId}/regenerate-cluster`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ clusterId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to regenerate cluster')
    }

    const result = await response.json()
    return result.data
  }
}
