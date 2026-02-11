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

    // API返回: { organization: {...}, role: "admin" }
    // apiFetch已经提取了result.data，所以response就是data对象
    const orgData = (response as any).organization

    return orgData
  }

  /**
   * Get organization by ID
   * GET /organizations/:id
   */
  async getOrganizationById(id: string): Promise<Organization> {
    return apiFetch(`/organizations/${id}`)
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
    return apiFetch(`/organizations/${id}/stats`)
  }

  /**
   * Get organization weaknesses
   * GET /organizations/:id/weaknesses
   */
  async getOrganizationWeaknesses(
    organizationId: string,
  ): Promise<WeaknessSnapshot[]> {
    return apiFetch(`/organizations/${organizationId}/weaknesses`)
  }

  /**
   * Get aggregated weaknesses for an organization
   * GET /organizations/:id/weaknesses/aggregated
   */
  async getAggregatedWeaknesses(
    organizationId: string,
  ): Promise<AggregatedWeakness[]> {
    return apiFetch(`/organizations/${organizationId}/weaknesses/aggregated`)
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
    return apiFetch(`/organizations/${organizationId}/projects?${params}`)
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
    return apiFetch(`/organizations/${organizationId}/members?${params}`)
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
    return apiFetch(`/organizations/${organizationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    })
  }

  /**
   * Remove a member from organization
   * DELETE /organizations/:id/members/:userId
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    await apiFetch(`/organizations/${organizationId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Update a member's role in organization
   * PATCH /organizations/:id/members/:userId
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<any> {
    return apiFetch(`/organizations/${organizationId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  }

  /**
   * Lookup a user by email address
   * GET /organizations/users/lookup?email=xxx
   */
  async lookupUserByEmail(email: string): Promise<{ id: string; name: string; email: string }> {
    return apiFetch(`/organizations/users/lookup?email=${encodeURIComponent(email)}`)
  }

  /**
   * Add a member to organization by email
   * First looks up user by email, then adds to organization
   */
  async addMemberByEmail(
    organizationId: string,
    email: string,
    role: 'admin' | 'member' = 'member',
  ): Promise<any> {
    const user = await this.lookupUserByEmail(email)
    return apiFetch(`/organizations/${organizationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, role }),
    })
  }

  /**
   * Link project to user's organization
   * POST /organizations/link-project
   */
  async linkProject(projectId: string): Promise<{ message: string }> {
    return apiFetch('/organizations/link-project', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
  }

  /**
   * Update organization
   * PUT /organizations/:id
   */
  async updateOrganization(
    id: string,
    data: { name?: string },
  ): Promise<Organization> {
    return apiFetch(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
}

// Export singleton instance
export const organizationsApi = new OrganizationsApi()
