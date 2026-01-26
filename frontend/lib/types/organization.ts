/**
 * Organization type definitions for Radar Service
 *
 * Story 1.1 - System automatically creates organization and associates projects
 * Phase 3 - Task 3.1: Update TypeScript type definitions
 */

/**
 * Organization entity
 * Represents a user's organization for multi-tenant Radar Service
 */
export interface Organization {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  memberCount?: number
}

/**
 * Organization Member entity
 * Represents a user's membership in an organization
 */
export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'admin' | 'member'
  createdAt: string
  organization?: Organization
  user?: UserBasicInfo
}

/**
 * User basic info (for OrganizationMember)
 */
export interface UserBasicInfo {
  id: string
  name: string
  email: string
}

/**
 * Weakness Snapshot entity
 * Represents a weakness identified during assessment
 */
export interface WeaknessSnapshot {
  id: string
  organizationId: string
  projectId: string
  category: string
  level: number
  description: string
  projectIds: string[]
  createdAt: string
}

/**
 * Aggregated Weakness
 * Result of aggregating weaknesses by category
 */
export interface AggregatedWeakness {
  category: string
  level: number
  description: string
  projectIds: string[]
}

/**
 * Paginated response wrapper
 * Standard response format for paginated data
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Organization Statistics
 * Statistical information about an organization
 */
export interface OrganizationStats {
  id: string
  memberCount: number
  projectCount: number
  weaknessSnapshotCount: number
}

/**
 * Create Organization DTO
 */
export interface CreateOrganizationDto {
  name: string
}

/**
 * Update Organization DTO
 */
export interface UpdateOrganizationDto {
  name?: string
}

/**
 * Add Organization Member DTO
 */
export interface AddMemberDto {
  userId: string
  role?: 'admin' | 'member'
}

/**
 * Link Project to Organization DTO
 */
export interface LinkProjectDto {
  projectId: string
}
