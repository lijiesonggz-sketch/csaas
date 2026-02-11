/**
 * Projects API Client
 */

import { getAuthHeadersAsync, getUserIdFromSessionAsync } from '@/lib/utils/jwt'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// 获取通用headers
async function getHeaders(): Promise<Record<string, string>> {
  const userId = await getUserIdFromSessionAsync()
  return {
    'Content-Type': 'application/json',
    ...(userId && { 'x-user-id': userId }),
  }
}

export interface Project {
  id: string
  name: string
  description?: string
  clientName?: string
  standardName?: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  progress: number
  createdAt: string
  updatedAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  organizationId?: string // Story 1.1: Organization association
}

export interface CreateProjectRequest {
  name: string
  description?: string
  clientName?: string
  standardName?: string
  organizationId?: string // Story 1.1: Optional organization association
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  clientName?: string
  standardName?: string
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  metadata?: Record<string, any>
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
  addedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface AddProjectMemberRequest {
  userId: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
}

export interface RerunTaskRequest {
  type: 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan'
}

export interface RollbackTaskRequest {
  type: 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan'
}

export class ProjectsAPI {
  /**
   * 获取认证headers
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    return getAuthHeadersAsync()
  }

  /**
   * 创建项目
   */
  static async createProject(request: CreateProjectRequest): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create project')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取项目列表
   */
  static async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch projects')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取项目详情
   */
  static async getProject(projectId: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch project')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 更新项目
   */
  static async updateProject(
    projectId: string,
    request: UpdateProjectRequest,
  ): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'PATCH',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update project')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 删除项目
   */
  static async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete project')
    }
  }

  /**
   * 获取项目成员列表
   */
  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch project members')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 添加项目成员
   */
  static async addProjectMember(
    projectId: string,
    request: AddProjectMemberRequest,
  ): Promise<ProjectMember> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to add project member')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 更新成员角色
   */
  static async updateMemberRole(
    projectId: string,
    userId: string,
    role: 'OWNER' | 'EDITOR' | 'VIEWER',
  ): Promise<ProjectMember> {
    const response = await fetch(
      `${API_BASE_URL}/projects/${projectId}/members/${userId}`,
      {
        method: 'PATCH',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ role }),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update member role')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 移除项目成员
   */
  static async removeMember(projectId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/projects/${projectId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to remove member')
    }
  }

  /**
   * 重跑任务（with备份）
   */
  static async rerunTask(
    projectId: string,
    request: RerunTaskRequest,
  ): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/rerun`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to rerun task')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 回退到备份版本
   */
  static async rollbackTask(
    projectId: string,
    request: RollbackTaskRequest,
  ): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/rollback`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to rollback task')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取备份信息
   */
  static async getBackupInfo(projectId: string, taskType: string): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/projects/${projectId}/backup/${taskType}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch backup info')
    }

    const result = await response.json()
    return result.data
  }
}
