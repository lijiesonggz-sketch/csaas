/**
 * TenantEntity Interface
 *
 * Base interface for all entities that support multi-tenant data isolation.
 * All entities that include a tenantId field should implement this interface.
 *
 * This interface is used as a generic constraint in BaseRepository to ensure
 * type safety when performing tenant-scoped queries.
 *
 * @module backend/src/database/interfaces/tenant-entity.interface
 * @story 6-1A
 */
export interface TenantEntity {
  /**
   * Primary key - UUID v4
   */
  id: string

  /**
   * Tenant ID (Consulting Company)
   *
   * Foreign key to the Tenant table. Used for multi-tenant data isolation.
   */
  tenantId: string
}
