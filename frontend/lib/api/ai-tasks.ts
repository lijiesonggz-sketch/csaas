/**
 * AI Tasks API Client
 * 与后端 AITasks 模块交互
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// 默认用户ID（测试用）
const DEFAULT_USER_ID = '65fefcd7-3b4b-49d7-a56f-8db474314c62'

export interface CreateAITaskRequest {
  projectId: string
  type: 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan'
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
}

export class AITasksAPI {
  /**
   * 获取认证headers
   */
  private static getAuthHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-user-id': DEFAULT_USER_ID,
    }
  }

  /**
   * 创建AI任务
   */
  static async createTask(request: CreateAITaskRequest): Promise<AITask> {
    const response = await fetch(`${API_BASE_URL}/ai-tasks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      console.error('❌ [AITasksAPI] 获取措施失败:', response.status, response.statusText)
      throw new Error('Failed to get action plan measures')
    }

    const result = await response.json()
    console.log('✅ [AITasksAPI] 获取到措施数:', result.data?.length || 0)
    return result.data || []
  }
}
