/**
 * Organizations API Client
 *
 * Provides methods to interact with the Organizations API
 * Story 1.1 - Phase 3 - Task 3.2
 *
 * @module frontend/lib/api/organizations
 */

import { PaginatedResponse, Organization, WeaknessSnapshot, AggregatedWeakness } from '../types/organization'

/**
 * Organizations API Client
 */
export class OrganizationsApi {
  private readonly baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  }

  /**
   * Get auth headers for API requests
   */
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') {
      // Server-side: no auth headers needed
      return {}
    }

    // Client-side: include credentials for cookies
    return {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'API request failed' }))
      throw new Error(error.message || 'API request failed')
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'API request failed')
    }

    return result.data
  }

  /**
   * Get current user's organization
   * GET /organizations/me
   */
  async getUserOrganizations(): Promise<Organization[]> {
    const response = await fetch(`${this.baseUrl}/organizations/me`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    })

    return this.handleResponse<Organization[]>(response)
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
