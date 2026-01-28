/**
 * Organizations API Client
 *
 * Provides methods to interact with the Organizations API
 * Story 1.1 - Phase 3 - Task 3.2
 *
 * @module frontend/lib/api/organizations
 */

import { apiFetch } from '../utils/api'
import { PaginatedResponse, Organization, WeaknessSnapshot, AggregatedWeakness } from '../types/organization'

/**
 * Organizations API Client
 */
export class OrganizationsApi {
  /**
   * Get current user's organization
   * GET /organizations/me
   */
  async getUserOrganizations(): Promise<Organization> {
    const response = await apiFetch('/organizations/me')

    console.log('[OrganizationsApi] /organizations/me response:', response)

    // API返回: { organization: {...}, role: "admin" }
    // apiFetch已经提取了result.data，所以response就是data对象
    const orgData = (response as any).organization

    console.log('[OrganizationsApi] Extracted organization:', orgData)

    return orgData
  }

  /**
   * Get organization by ID
   * GET /organizations/:id
   */
  async getOrganizationById(id: string): Promise<Organization> {
    const response = await fetch(`${this.baseUrl}/organizations/${id}`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    })

    return this.handleResponse<Organization>(response)
  }

  /**
   * Get organization statistics
   * GET /organizations/:id/stats
   */
  async getOrganizationStats(id: string): Promise<{
    id: string
    memberCount: number
    projectCount: number
    weaknessSnapshotCount: number
  }> {
    const response = await fetch(`${this.baseUrl}/organizations/${id}/stats`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Get organization weaknesses
   * GET /organizations/:id/weaknesses
   */
  async getOrganizationWeaknesses(
    organizationId: string,
  ): Promise<WeaknessSnapshot[]> {
    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/weaknesses`,
      {
        headers: this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    return this.handleResponse<WeaknessSnapshot[]>(response)
  }

  /**
   * Get aggregated weaknesses for an organization
   * GET /organizations/:id/weaknesses/aggregated
   */
  async getAggregatedWeaknesses(
    organizationId: string,
  ): Promise<AggregatedWeakness[]> {
    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/weaknesses/aggregated`,
      {
        headers: this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    return this.handleResponse<AggregatedWeakness[]>(response)
  }

  /**
   * Get organization projects with pagination
   * GET /organizations/:id/projects
   */
  async getOrganizationProjects(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })

    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/projects?${params}`,
      {
        headers: this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    return this.handleResponse<PaginatedResponse<any>>(response)
  }

  /**
   * Get organization members with pagination
   * GET /organizations/:id/members
   */
  async getOrganizationMembers(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })

    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/members?${params}`,
      {
        headers: this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    return this.handleResponse<PaginatedResponse<any>>(response)
  }

  /**
   * Add a member to organization
   * POST /organizations/:id/members
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: 'admin' | 'member' = 'member',
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/members`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ userId, role }),
      },
    )

    return this.handleResponse<any>(response)
  }

  /**
   * Remove a member from organization
   * DELETE /organizations/:id/members/:userId
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/organizations/${organizationId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    return this.handleResponse<void>(response)
  }

  /**
   * Link project to user's organization
   * POST /organizations/link-project
   */
  async linkProject(projectId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/organizations/link-project`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ projectId }),
    })

    return this.handleResponse<{ message: string }>(response)
  }

  /**
   * Update organization
   * PUT /organizations/:id
   */
  async updateOrganization(
    id: string,
    data: { name?: string },
  ): Promise<Organization> {
    const response = await fetch(`${this.baseUrl}/organizations/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    })

    return this.handleResponse<Organization>(response)
  }
}

// Export singleton instance
export const organizationsApi = new OrganizationsApi()
